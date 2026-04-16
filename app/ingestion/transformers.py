"""
app/ingestion/transformers.py — Driver rating computation from raw data.

Takes cached Parquet DataFrames (Ergast + FastF1) and produces the seven
normalised driver ratings defined in PRD section 6.

All outputs are min-max normalised across the current driver pool (0.0–1.0).
This module is pure computation — no DB calls, no HTTP calls.
"""
from __future__ import annotations

import logging
from dataclasses import asdict, dataclass
from typing import Optional

import numpy as np
import pandas as pd

_log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Data contract (mirrors CLAUDE.md DriverRating)
# ---------------------------------------------------------------------------


@dataclass
class DriverRating:
    driver_id: str          # ergast driverId (e.g. "hamilton")
    season: int
    base_pace: float        # 0-1 (higher = faster)
    consistency: float      # 0-1 (higher = more consistent)
    wet_skill: float        # 0-1 (higher = better in wet)
    tyre_management: float  # 0-1 (higher = longer stints)
    overtake_skill: float   # 0-1 (higher = better at gaining positions)
    dnf_rate: float         # 0-1 (lower is better — historical DNF fraction)
    qualifying_edge: float  # 0-1 (higher = better qualifier)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _min_max_normalise(series: pd.Series, invert: bool = False) -> pd.Series:
    """Normalise a Series to [0, 1].  invert=True for metrics where lower = better."""
    mn, mx = series.min(), series.max()
    if mx == mn:
        return pd.Series(0.5, index=series.index)
    norm = (series - mn) / (mx - mn)
    return 1.0 - norm if invert else norm


def _safe_mean(vals: pd.Series) -> float:
    clean = vals.dropna()
    return float(clean.mean()) if len(clean) > 0 else 0.5


# ---------------------------------------------------------------------------
# Driver ID remapping helpers
# ---------------------------------------------------------------------------

def _build_abbr_to_ergast_id(results_df: pd.DataFrame) -> dict[str, str]:
    """
    Build a mapping from FastF1 3-letter abbreviation → Ergast driver_id.

    FastF1 lap data uses 'VER', 'HAM', etc. as driver identifiers; Ergast uses
    'max_verstappen', 'hamilton', etc.  results_df carries both via driver_abbr.
    """
    df = results_df[["driver_id", "driver_abbr"]].dropna(subset=["driver_abbr"])
    df = df.drop_duplicates("driver_abbr")
    return dict(zip(df["driver_abbr"].str.upper(), df["driver_id"]))


def _remap_lap_driver_ids(
    laps_by_round: dict[int, pd.DataFrame],
    abbr_map: dict[str, str],
) -> dict[int, pd.DataFrame]:
    """
    Replace FastF1 3-letter codes in the 'driver_id' column with Ergast IDs.
    Unmapped abbreviations are left as-is (they'll just get 0.5 fallback).
    """
    remapped: dict[int, pd.DataFrame] = {}
    for rnd, laps in laps_by_round.items():
        if laps.empty:
            remapped[rnd] = laps
            continue
        laps = laps.copy()
        laps["driver_id"] = (
            laps["driver_id"].str.upper().map(abbr_map).fillna(laps["driver_id"])
        )
        remapped[rnd] = laps
    return remapped


# ---------------------------------------------------------------------------
# Individual rating components
# ---------------------------------------------------------------------------

def _compute_base_pace(results_df: pd.DataFrame, laps_by_round: dict[int, pd.DataFrame]) -> pd.Series:
    """
    Median race lap time per driver, normalised (lower time = higher score).
    Falls back to race finish position inversion if no lap data is available.
    """
    if laps_by_round:
        # Aggregate accurate laps only, excluding outlap/inlap.
        frames: list[pd.DataFrame] = []
        for rnd, laps in laps_by_round.items():
            if laps.empty:
                continue
            acc = laps[laps["is_accurate"] & laps["lap_time_s"].notna()]
            if acc.empty:
                continue
            median_per_driver = (
                acc.groupby("driver_id")["lap_time_s"].median().rename("lap_time_s")
            )
            frames.append(median_per_driver.to_frame().assign(round=rnd))

        if frames:
            all_medians = pd.concat(frames)
            # Season median lap time per driver (mean of per-race medians).
            driver_pace = all_medians.groupby("driver_id")["lap_time_s"].mean()
            # Normalise: lower lap time → higher pace score.
            return _min_max_normalise(driver_pace, invert=True)

    # Fallback: use mean finish position from Ergast (lower = better).
    _log.debug("No lap data — using finish position as pace proxy")
    finished = results_df[results_df["position"].notna()].copy()
    mean_pos = finished.groupby("driver_id")["position"].mean()
    return _min_max_normalise(mean_pos, invert=True)


def _compute_consistency(laps_by_round: dict[int, pd.DataFrame]) -> Optional[pd.Series]:
    """
    consistency = 1 - (std_dev(lap_times) / mean(lap_times)) per driver.
    Returns None if no lap data.
    """
    if not laps_by_round:
        return None

    frames: list[pd.DataFrame] = []
    for laps in laps_by_round.values():
        if laps.empty:
            continue
        acc = laps[laps["is_accurate"] & laps["lap_time_s"].notna()]
        if acc.empty:
            continue
        frames.append(acc[["driver_id", "lap_time_s"]])

    if not frames:
        return None

    combined = pd.concat(frames)
    grp = combined.groupby("driver_id")["lap_time_s"]
    cv = grp.std() / grp.mean()  # coefficient of variation
    raw = (1.0 - cv).clip(lower=0.0)
    return _min_max_normalise(raw)


def _compute_wet_skill(
    results_df: pd.DataFrame,
    laps_by_round: dict[int, pd.DataFrame],
    weather_by_round: dict[int, str],
) -> Optional[pd.Series]:
    """
    Wet skill = relative pace improvement (or degradation) in wet vs dry.
    dry_pace / wet_pace — drivers that go faster relative to field in wet score higher.
    Returns None if not enough wet data (< 2 wet rounds).
    """
    if not laps_by_round or not weather_by_round:
        return None

    wet_rounds = {rnd for rnd, w in weather_by_round.items() if w in ("wet", "mixed")}
    dry_rounds = {rnd for rnd, w in weather_by_round.items() if w == "dry"}

    if len(wet_rounds) < 2:
        _log.debug("Too few wet rounds (%d) to compute wet_skill", len(wet_rounds))
        return None

    def _median_by_driver(rounds: set[int]) -> pd.Series:
        frames = []
        for rnd in rounds:
            laps = laps_by_round.get(rnd, pd.DataFrame())
            if laps.empty:
                continue
            acc = laps[laps["is_accurate"] & laps["lap_time_s"].notna()]
            if not acc.empty:
                frames.append(acc.groupby("driver_id")["lap_time_s"].median())
        if not frames:
            return pd.Series(dtype=float)
        return pd.concat(frames).groupby(level=0).mean()

    wet_pace = _median_by_driver(wet_rounds)
    dry_pace = _median_by_driver(dry_rounds)

    common = wet_pace.index.intersection(dry_pace.index)
    if len(common) < 3:
        return None

    # Lower lap time in wet relative to dry = better wet skill.
    # Ratio: dry_pace / wet_pace — higher = better in wet.
    ratio = dry_pace.loc[common] / wet_pace.loc[common]
    return _min_max_normalise(ratio)


def _compute_tyre_management(laps_by_round: dict[int, pd.DataFrame]) -> Optional[pd.Series]:
    """
    tyre_management = avg driver stint length / avg team stint length.
    Drivers who extend stints beyond team average score higher.
    Returns None if no lap data.
    """
    if not laps_by_round:
        return None

    frames = []
    for laps in laps_by_round.values():
        if laps.empty:
            continue
        if "stint" not in laps.columns:
            continue
        acc = laps[laps["is_accurate"] & laps["lap_time_s"].notna()]
        if acc.empty:
            continue
        frames.append(acc[["driver_id", "stint"]])

    if not frames:
        return None

    combined = pd.concat(frames)
    # We don't have constructor info in laps; use driver-level season stint lengths.
    # Stint length = number of laps per driver per stint group.
    stint_lengths = (
        combined.groupby(["driver_id", "stint"]).size().reset_index(name="stint_len")
    )
    avg_stint = stint_lengths.groupby("driver_id")["stint_len"].mean()
    return _min_max_normalise(avg_stint)


def _compute_overtake_skill(
    results_df: pd.DataFrame, overtake_difficulty: dict[str, float]
) -> pd.Series:
    """
    overtake_skill = mean(grid - finish) weighted by circuit overtake_difficulty.
    Positive = gained positions; more impressive at low-overtake circuits.
    """
    df = results_df[
        results_df["position"].notna() & (results_df["grid"] > 0)
    ].copy()
    df["positions_gained"] = df["grid"] - df["position"]

    # Map circuit overtake difficulty per round if available.
    if "circuit_ref" in df.columns:
        df["difficulty"] = df["circuit_ref"].map(overtake_difficulty).fillna(0.5)
        # Weight: more impressive to overtake on harder circuits.
        df["weighted_gain"] = df["positions_gained"] * df["difficulty"]
        per_driver = df.groupby("driver_id")["weighted_gain"].mean()
    else:
        per_driver = df.groupby("driver_id")["positions_gained"].mean()

    return _min_max_normalise(per_driver)


def _compute_dnf_rate(
    results_df: pd.DataFrame,
    prior_results: dict[int, pd.DataFrame] | None = None,
) -> pd.Series:
    """
    dnf_rate = weighted DNF fraction across trailing 3 seasons.
    Weights: current season 0.5, season-1 0.3, season-2 0.2.
    """
    all_frames: list[tuple[pd.DataFrame, float]] = [(results_df, 0.5)]
    if prior_results:
        seasons = sorted(prior_results.keys(), reverse=True)
        weights = [0.3, 0.2]
        for s, w in zip(seasons[:2], weights):
            all_frames.append((prior_results[s], w))

    weighted_dnf: dict[str, float] = {}
    weighted_races: dict[str, float] = {}

    for df, weight in all_frames:
        started = df.groupby("driver_id").size()
        dnfs = df[df["dnf"]].groupby("driver_id").size()
        for driver in started.index:
            dnf_count = dnfs.get(driver, 0)
            race_count = started[driver]
            weighted_dnf[driver] = weighted_dnf.get(driver, 0) + weight * dnf_count
            weighted_races[driver] = weighted_races.get(driver, 0) + weight * race_count

    drivers = list(set(weighted_races.keys()))
    rates = pd.Series(
        {d: weighted_dnf.get(d, 0) / weighted_races[d] for d in drivers},
        dtype=float,
    )
    # Return raw rates (0-1); DO NOT invert — lower is better, kept as-is.
    return rates.clip(0.0, 1.0)


def _compute_qualifying_edge(results_df: pd.DataFrame) -> pd.Series:
    """
    qualifying_edge = 1 - median(grid_position / field_size).
    1.0 = always on pole, 0.0 = always last.
    """
    df = results_df[results_df["grid"] > 0].copy()
    field_size = df.groupby("round")["driver_id"].transform("count")
    df["qual_score"] = 1.0 - (df["grid"] - 1) / (field_size - 1).clip(lower=1)
    per_driver = df.groupby("driver_id")["qual_score"].median()
    return per_driver.clip(0.0, 1.0)


# ---------------------------------------------------------------------------
# Main public function
# ---------------------------------------------------------------------------

def compute_driver_ratings(
    season: int,
    results_df: pd.DataFrame,
    laps_by_round: dict[int, pd.DataFrame],
    weather_by_round: dict[int, str],
    overtake_difficulty: dict[str, float] | None = None,
    prior_results: dict[int, pd.DataFrame] | None = None,
) -> list[DriverRating]:
    """
    Compute normalised driver ratings for a season.

    Args:
        season: F1 season year.
        results_df: Ergast race results (output of ergast_client.fetch_season_results).
        laps_by_round: FastF1 lap data keyed by round number.
        weather_by_round: Weather string ('dry'/'wet'/'mixed') keyed by round number.
        overtake_difficulty: dict mapping circuit_ref → difficulty (0-1).
        prior_results: Historical results for trailing 3-season DNF weighting.

    Returns:
        List of DriverRating dataclasses, one per active driver.
    """
    if overtake_difficulty is None:
        overtake_difficulty = {}

    drivers = results_df["driver_id"].unique().tolist()
    _log.info("Computing ratings for %d drivers in season %d", len(drivers), season)

    # FastF1 lap data uses 3-letter abbreviations; Ergast uses snake_case IDs.
    # Remap before passing to component functions so they all use the same key space.
    if laps_by_round:
        abbr_map = _build_abbr_to_ergast_id(results_df)
        laps_by_round = _remap_lap_driver_ids(laps_by_round, abbr_map)
        _log.debug("Remapped FastF1 abbreviations for %d drivers", len(abbr_map))

    # Compute each component.
    base_pace = _compute_base_pace(results_df, laps_by_round)
    consistency = _compute_consistency(laps_by_round)
    wet_skill = _compute_wet_skill(results_df, laps_by_round, weather_by_round)
    tyre_mgmt = _compute_tyre_management(laps_by_round)
    overtake = _compute_overtake_skill(results_df, overtake_difficulty)
    dnf_rate = _compute_dnf_rate(results_df, prior_results)
    qual_edge = _compute_qualifying_edge(results_df)

    # Default series for components without enough data.
    default = pd.Series(0.5, index=pd.Index(drivers, name="driver_id"))

    def _get(series: pd.Series | None, driver: str) -> float:
        if series is None or driver not in series.index:
            return 0.5
        val = series[driver]
        return float(val) if not pd.isna(val) else 0.5

    ratings: list[DriverRating] = []
    for driver in drivers:
        ratings.append(DriverRating(
            driver_id=driver,
            season=season,
            base_pace=_get(base_pace, driver),
            consistency=_get(consistency, driver),
            wet_skill=_get(wet_skill, driver),
            tyre_management=_get(tyre_mgmt, driver),
            overtake_skill=_get(overtake, driver),
            dnf_rate=_get(dnf_rate, driver),
            qualifying_edge=_get(qual_edge, driver),
        ))

    _log.info("Computed %d driver ratings for season %d", len(ratings), season)
    return ratings
