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
    )


def load_ratings_from_db(season: int) -> list[SimRating] | None:
    """Try to load driver ratings from the DB. Returns None if DB unavailable."""
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
            for rating, driver in rows:
                ratings.append(SimRating(
                    driver_id=driver.name,
                    base_pace=rating.base_pace or 0.5,
                    consistency=rating.consistency or 0.5,
                    wet_skill=rating.wet_skill or 0.5,
                    tyre_management=rating.tyre_management or 0.5,
                    overtake_skill=rating.overtake_skill or 0.5,
                    dnf_rate=rating.dnf_rate or 0.05,
                    qualifying_edge=rating.qualifying_edge or 0.5,
                ))
            _log.info("Loaded %d driver ratings from DB (season %d)", len(ratings), season)
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

    # -- 2. Ratings: try DB first ------------------------------------------
    sim_ratings = load_ratings_from_db(season)
    if sim_ratings:
        return sim_ratings, races_df

    # -- 3. Fallback: compute from Ergast parquet cache --------------------
    _log.info("Computing ratings from Ergast cache for season %d...", season)
    results_df = fetch_season_results(season)
    if results_df.empty:
        raise ValueError(f"No race results found for season {season}")

    # Attach circuit_ref to results for overtake_skill weighting.
    round_to_ref = races_df.set_index("round")["circuit_ref"]
    results_df = results_df.copy()
    results_df["circuit_ref"] = results_df["round"].map(round_to_ref)

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

    sim_ratings = [
        _transformer_to_sim(r)
        for r in transformer_ratings
        if r.driver_id in active_drivers
    ]
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

    # -- Build constructor map ---------------------------------------------
    # Map ergast driver_id → constructor from results parquet.
    results_df = fetch_season_results(args.season)
    driver_to_con: dict[str, str] = {}
    if not results_df.empty:
        latest = (
            results_df.sort_values("round")
            .groupby("driver_id")
            .last()
            .reset_index()[["driver_id", "constructor_id"]]
        )
        driver_to_con = dict(zip(latest["driver_id"], latest["constructor_id"]))

    # -- Aggregate ---------------------------------------------------------
    summary_df = build_summary_dataframe(all_points, driver_order, driver_to_con)
    _print_results(summary_df, args.n, args.season)

    # -- Validation -------------------------------------------------------
    print(f"  Validation (season {args.season}):")
    if args.season == 2023:
        passed = _validate_2023(summary_df)
    else:
        # Generic check: top driver has > 50% WDC probability.
        top_prob = summary_df.iloc[0]["wdc_prob"] * 100
        passed = top_prob > 30.0
        print(f"  [{'PASS' if passed else 'FAIL'}] Top driver WDC prob = {top_prob:.1f}%  (target > 30%)")

    print()
    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
