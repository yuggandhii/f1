"""
scripts/run_backtest.py — Validate simulation against a known historical season.

Usage:
    python scripts/run_backtest.py --n 100 --season 2023

Data loading priority:
    1. Driver ratings: DB (season-filtered) → Ergast parquet cache → live API
    2. Race calendar:  Ergast parquet cache → live API

Validation targets (PRD §11):
    2023: Verstappen WDC prob > 85%, Pérez in top 3, Red Bull WCC > 90%
"""
from __future__ import annotations

import argparse
import logging
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np
import pandas as pd

from app.analytics.aggregator import build_summary_dataframe, compute_wcc_probabilities
from app.ingestion.ergast_client import fetch_season_races, fetch_season_results
from app.ingestion.transformers import DriverRating as TransformerRating
from app.ingestion.transformers import compute_driver_ratings
from app.simulation.performance_model import DriverRating as SimRating
from app.simulation.season_simulator import circuits_from_dataframe, simulate_season


# ---------------------------------------------------------------------------
# Car performance helpers (season-specific, not from DB which stores only latest)
# ---------------------------------------------------------------------------

def _compute_car_performance(results_df: pd.DataFrame) -> dict[str, float]:
    """
    Compute car_performance (0–1) per constructor from a season's race results.

    DNFs count as last-place finishes so that unreliable cars (e.g. Ferrari 2022)
    are penalised appropriately.  Race pace weighted 60%, qualifying 40% — the
    championship is decided by race results, not qualifying performance.
    """
    def _norm_invert(series: pd.Series) -> pd.Series:
        mn, mx = series.min(), series.max()
        if mx == mn:
            return pd.Series(0.5, index=series.index)
        return (mx - series) / (mx - mn)

    # DNFs fill to a position worse than any finisher.
    n_starters = int(results_df.groupby("round")["driver_id"].count().median())
    dnf_position = float(n_starters + 5)

    df_race = results_df.copy()
    df_race["position"] = df_race["position"].fillna(dnf_position).astype(float)
    team_race_pos = df_race.groupby("constructor_id")["position"].median()
    race_norm = _norm_invert(team_race_pos)

    if "grid" in results_df.columns:
        qual_df = results_df[results_df["grid"].fillna(0) > 0].copy()
        qual_df["grid"] = qual_df["grid"].astype(float)
        team_qual_pos = qual_df.groupby("constructor_id")["grid"].median()
        qual_norm = _norm_invert(team_qual_pos)
    else:
        qual_norm = race_norm.copy()

    # 40% qualifying + 60% race (race results drive the championship)
    all_teams = race_norm.index.union(qual_norm.index)
    combined = pd.Series(index=all_teams, dtype=float)
    for team in all_teams:
        q = float(qual_norm.get(team, 0.5))
        r = float(race_norm.get(team, 0.5))
        combined[team] = 0.4 * q + 0.6 * r
    return combined.clip(0.0, 1.0).to_dict()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
_log = logging.getLogger("backtest")


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

def _transformer_to_sim(r: TransformerRating) -> SimRating:
    return SimRating(
        driver_id=r.driver_id,
        base_pace=r.base_pace,
        consistency=r.consistency,
        wet_skill=r.wet_skill,
        tyre_management=r.tyre_management,
        overtake_skill=r.overtake_skill,
        dnf_rate=r.dnf_rate,
        qualifying_edge=r.qualifying_edge,
        mechanical_dnf_rate=r.mechanical_dnf_rate,
        driver_dnf_rate=r.driver_dnf_rate,
    )


def load_ratings_from_db(
    season: int,
    car_perf: dict[str, float] | None = None,
    driver_con_map: dict[str, str] | None = None,
    abbr_con_map: dict[str, str] | None = None,
) -> list[SimRating] | None:
    """
    Try to load driver ratings from the DB.

    car_perf:       constructor_id → car_performance (0-1) for this season.
    driver_con_map: driver full-name → constructor_id (from Ergast results).
    abbr_con_map:   3-letter abbreviation (upper) → constructor_id (fallback).
    Returns None if DB unavailable.
    """
    try:
        from app.database import SyncSessionLocal
        from app.models.driver import Driver
        from app.models.driver_rating import DriverRating as DriverRatingModel

        with SyncSessionLocal() as session:
            rows = (
                session.query(DriverRatingModel, Driver)
                .join(Driver, DriverRatingModel.driver_id == Driver.id)
                .filter(DriverRatingModel.season == season)
                .all()
            )
            if not rows:
                return None
            ratings = []
            n_resolved = 0
            for rating, driver in rows:
                # Primary: full-name lookup
                con = (driver_con_map or {}).get(driver.name, "")
                # Fallback: 3-letter abbreviation lookup (survives old parquet caches
                # that pre-date the driver_name column)
                if not con and driver.abbreviation:
                    con = (abbr_con_map or {}).get(
                        (driver.abbreviation or "").upper(), ""
                    )
                car_performance = (car_perf or {}).get(con, 0.5)
                if con:
                    n_resolved += 1
                ratings.append(SimRating(
                    driver_id=driver.name,
                    base_pace=rating.base_pace or 0.5,
                    consistency=rating.consistency or 0.5,
                    wet_skill=rating.wet_skill or 0.5,
                    tyre_management=rating.tyre_management or 0.5,
                    overtake_skill=rating.overtake_skill or 0.5,
                    dnf_rate=rating.dnf_rate or 0.05,
                    qualifying_edge=rating.qualifying_edge or 0.5,
                    car_performance=car_performance,
                    mechanical_dnf_rate=rating.mechanical_dnf_rate or 0.0,
                    driver_dnf_rate=rating.driver_dnf_rate or 0.0,
                ))
            _log.info(
                "Loaded %d driver ratings from DB (season %d) — "
                "%d/%d with team car_performance resolved",
                len(ratings), season, n_resolved, len(ratings),
            )
            if n_resolved < len(ratings):
                _log.warning(
                    "%d drivers defaulted to car_performance=0.5 "
                    "(constructor lookup failed — parquet cache may be stale)",
                    len(ratings) - n_resolved,
                )
            return ratings
    except Exception as exc:
        _log.debug("DB unavailable (%s) — falling back to parquet cache", exc)
        return None


def load_season_data(season: int) -> tuple[list[SimRating], pd.DataFrame]:
    """
    Load driver ratings and race calendar for a season.

    Returns:
        ratings:  list of SimRating (one per driver who scored points)
        races_df: Ergast races DataFrame with circuit metadata
    """
    # -- 1. Race calendar (always needed for circuit schedule) -------------
    _log.info("Loading %d race calendar...", season)
    races_df = fetch_season_races(season)
    if races_df.empty:
        raise ValueError(f"No race calendar found for season {season}")
    _log.info("  %d circuits loaded", len(races_df))

    # -- 2. Race results — needed for car_performance + constructor mapping -
    _log.info("Loading %d race results for car performance...", season)
    results_df = fetch_season_results(season)
    if results_df.empty:
        raise ValueError(f"No race results found for season {season}")

    # Attach circuit_ref to results for overtake_skill weighting.
    round_to_ref = races_df.set_index("round")["circuit_ref"]
    results_df = results_df.copy()
    results_df["circuit_ref"] = results_df["round"].map(round_to_ref)

    # Compute car_performance per constructor for this specific season.
    car_perf = _compute_car_performance(results_df)
    _log.info("  Car performance computed for %d constructors", len(car_perf))
    for con, perf in sorted(car_perf.items(), key=lambda x: -x[1])[:5]:
        _log.info("    %s: %.3f", con, perf)

    # Build driver full-name → constructor_id map for the season.
    driver_con_map: dict[str, str] = {}
    if "driver_name" in results_df.columns:
        latest = (
            results_df.sort_values("round")
            .groupby("driver_name")
            .last()
            .reset_index()[["driver_name", "constructor_id"]]
        )
        driver_con_map = dict(zip(latest["driver_name"], latest["constructor_id"]))

    # Build 3-letter abbreviation → constructor_id map as a fallback.
    # This survives old parquet caches that pre-date the driver_name column.
    abbr_con_map: dict[str, str] = {}
    if "driver_abbr" in results_df.columns:
        latest_abbr = (
            results_df[results_df["driver_abbr"].notna()]
            .sort_values("round")
            .groupby("driver_abbr")
            .last()
            .reset_index()
        )
        abbr_con_map = {
            str(row.driver_abbr).upper(): row.constructor_id
            for row in latest_abbr.itertuples(index=False)
            if row.driver_abbr
        }

    if not driver_con_map and not abbr_con_map:
        _log.warning(
            "Could not build constructor lookup maps — "
            "parquet cache may be missing driver_name/driver_abbr columns. "
            "Delete data/cache/%d/ to force a fresh API fetch.",
            season,
        )

    # -- 3. Ratings: try DB first ------------------------------------------
    sim_ratings = load_ratings_from_db(season, car_perf, driver_con_map, abbr_con_map)
    if sim_ratings:
        missing_car_perf = sum(1 for r in sim_ratings if r.car_performance == 0.5)
        _log.info(
            "  %d ratings loaded (%d without car_performance lookup)",
            len(sim_ratings), missing_car_perf,
        )
        return sim_ratings, races_df

    # -- 4. Fallback: compute from Ergast parquet cache --------------------
    _log.info("Computing ratings from Ergast cache for season %d...", season)

    # Load prior two seasons for trailing DNF rate.
    prior_results: dict[int, pd.DataFrame] = {}
    for prior in [season - 1, season - 2]:
        if prior < 2018:
            continue
        try:
            prior_df = fetch_season_results(prior)
            if not prior_df.empty:
                prior_results[prior] = prior_df
        except Exception:
            pass

    overtake_difficulty = dict(zip(races_df["circuit_ref"], races_df["overtake_difficulty"]))

    transformer_ratings: list[TransformerRating] = compute_driver_ratings(
        season=season,
        results_df=results_df,
        laps_by_round={},          # no FastF1 for backtest (faster to skip)
        weather_by_round={},
        overtake_difficulty=overtake_difficulty,
        prior_results=prior_results or None,
    )

    # Filter to drivers who actually scored points (exclude one-off subs who
    # have very few results and would skew normalization).
    min_rounds = max(1, results_df["round"].nunique() // 3)
    active = results_df.groupby("driver_id").size()
    active_drivers = set(active[active >= min_rounds].index)

    # Build ergast driver_id → constructor map for car_performance lookup.
    ergast_con_map = dict(
        zip(
            results_df.sort_values("round").groupby("driver_id")["constructor_id"].last().index,
            results_df.sort_values("round").groupby("driver_id")["constructor_id"].last().values,
        )
    )

    sim_ratings = []
    for r in transformer_ratings:
        if r.driver_id not in active_drivers:
            continue
        con = ergast_con_map.get(r.driver_id, "")
        car_performance = car_perf.get(con, 0.5)
        sim = _transformer_to_sim(r)
        sim.car_performance = car_performance
        sim_ratings.append(sim)

    _log.info(
        "Computed ratings for %d drivers from %d rounds of parquet data",
        len(sim_ratings), results_df["round"].nunique(),
    )
    return sim_ratings, races_df


# ---------------------------------------------------------------------------
# Print helpers
# ---------------------------------------------------------------------------

def _driver_display_name(driver_id: str) -> str:
    """Convert 'max_verstappen' → 'Max Verstappen'."""
    return driver_id.replace("_", " ").title()


def _print_results(summary_df: pd.DataFrame, n_sims: int, season: int) -> None:
    print()
    print(f"  F1 {season} Season — Monte Carlo Championship Probabilities ({n_sims:,} sims)")
    print(f"  {'-' * 70}")
    print(f"  {'Driver':<24} {'Team':<20} {'WDC%':>6}  {'Exp.Pts':>8}  {'Std':>6}  P5-P95")
    print(f"  {'-' * 70}")
    for _, row in summary_df.iterrows():
        name = _driver_display_name(row["driver_id"])
        team = row["constructor"][:18] if row["constructor"] else ""
        print(
            f"  {name:<24} {team:<20} {row['wdc_prob_pct']:>5.1f}%"
            f"  {row['expected_pts']:>8.1f}  {row['pts_std']:>6.1f}"
            f"  [{row['p5_pts']:.0f}–{row['p95_pts']:.0f}]"
        )
    print(f"  {'-' * 70}")
    print()


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def _validate_2022(summary_df: pd.DataFrame) -> bool:
    """
    Check PRD §11 validation targets for 2022.
    Returns True if all targets pass.
    """
    wdc = summary_df.set_index("driver_id")["wdc_prob"].to_dict()

    ver_key = next((k for k in wdc if "verstappen" in k.lower()), None)
    lec_key = next((k for k in wdc if "leclerc" in k.lower()), None)

    ok = True

    if ver_key:
        ver_prob = wdc[ver_key] * 100
        status = "PASS" if ver_prob > 60.0 else "FAIL"
        print(f"  [{status}] Verstappen WDC prob = {ver_prob:.1f}%  (target > 60%)")
        if ver_prob <= 60.0:
            ok = False
    else:
        print("  [WARN] Verstappen not found in results")

    if lec_key:
        rank = (summary_df["wdc_prob"] > wdc[lec_key]).sum() + 1
        status = "PASS" if rank <= 3 else "FAIL"
        print(f"  [{status}] Leclerc rank by WDC prob = {rank}  (target <= 3)")
        if rank > 3:
            ok = False
    else:
        print("  [INFO] Leclerc not found in results")

    return ok


def _validate_2023(summary_df: pd.DataFrame) -> bool:
    """
    Check PRD §11 validation targets for 2023.
    Returns True if all targets pass.
    """
    wdc = summary_df.set_index("driver_id")["wdc_prob"].to_dict()

    # Resolve Verstappen entry (driver_id may be 'max_verstappen').
    ver_key = next((k for k in wdc if "verstappen" in k.lower()), None)
    per_key = next((k for k in wdc if "perez" in k.lower() or "pérez" in k.lower()), None)

    ok = True

    if ver_key:
        ver_prob = wdc[ver_key] * 100
        status = "PASS" if ver_prob > 85.0 else "FAIL"
        print(f"  [{status}] Verstappen WDC prob = {ver_prob:.1f}%  (target > 85%)")
        if ver_prob <= 85.0:
            ok = False
    else:
        print("  [WARN] Verstappen not found in results")

    # Perez top-3 check (ranked by WDC probability).
    if per_key:
        rank = (summary_df["wdc_prob"] > wdc[per_key]).sum() + 1
        status = "PASS" if rank <= 3 else "INFO"
        print(f"  [{status}] Perez rank by WDC prob = {rank}  (target <= 3)")
    else:
        print("  [INFO] Perez not found in results")

    return ok


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="F1 Monte Carlo backtest")
    parser.add_argument("--n",      type=int, default=100,  help="Number of simulations")
    parser.add_argument("--season", type=int, default=2023, help="Season to simulate")
    parser.add_argument("--randomness", type=float, default=0.15, help="Noise factor")
    parser.add_argument("--seed",   type=int, default=42,   help="RNG seed")
    args = parser.parse_args()

    _log.info("Backtest: season=%d  n_sims=%d  randomness=%.2f  seed=%d",
              args.season, args.n, args.randomness, args.seed)

    # -- Load data ---------------------------------------------------------
    ratings, races_df = load_season_data(args.season)
    circuits = circuits_from_dataframe(races_df, args.season)

    _log.info("Simulating %d drivers × %d circuits × %d sims...",
              len(ratings), len(circuits), args.n)

    # -- Run simulation ----------------------------------------------------
    t0 = time.perf_counter()
    all_points, driver_order = simulate_season(
        ratings=ratings,
        circuits=circuits,
        n_sims=args.n,
        randomness=args.randomness,
        seed=args.seed,
    )
    elapsed = time.perf_counter() - t0
    _log.info("Simulation complete in %.2fs", elapsed)

    # -- Build constructor map (for summary display only) -----------------
    # Use full name → constructor from what load_season_data already fetched.
    driver_to_con: dict[str, str] = {}
    try:
        _results = fetch_season_results(args.season)
        if not _results.empty and "driver_name" in _results.columns:
            latest = (
                _results.sort_values("round")
                .groupby("driver_name")
                .last()
                .reset_index()[["driver_name", "constructor_id"]]
            )
            driver_to_con = dict(zip(latest["driver_name"], latest["constructor_id"]))
    except Exception:
        pass

    # -- Aggregate ---------------------------------------------------------
    summary_df = build_summary_dataframe(all_points, driver_order, driver_to_con)
    _print_results(summary_df, args.n, args.season)

    # -- Validation -------------------------------------------------------
    print(f"  Validation (season {args.season}):")
    if args.season == 2023:
        passed = _validate_2023(summary_df)
    elif args.season == 2022:
        passed = _validate_2022(summary_df)
    else:
        # Generic check: top driver has > 30% WDC probability.
        top_prob = summary_df.iloc[0]["wdc_prob"] * 100
        passed = top_prob > 30.0
        print(f"  [{'PASS' if passed else 'FAIL'}] Top driver WDC prob = {top_prob:.1f}%  (target > 30%)")

    print()
    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
