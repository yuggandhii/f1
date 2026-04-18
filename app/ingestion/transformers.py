"""
app/ingestion/transformers.py — Driver rating computation from raw data.

Takes cached Parquet DataFrames (Ergast + FastF1) and produces nine
normalised driver ratings.

All outputs are min-max normalised across the current driver pool (0.0–1.0).
This module is pure computation — no DB calls, no HTTP calls.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import pandas as pd

_log = logging.getLogger(__name__)

# Expected tyre stint lengths by compound (laps) for compound-aware normalisation.
_EXPECTED_STINT_LAPS: dict[str, float] = {
    "SOFT": 20.0,
    "MEDIUM": 30.0,
    "HARD": 40.0,
    "INTER": 25.0,
    "WET": 20.0,
}
_DEFAULT_EXPECTED_LAPS = 25.0

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
    tyre_management: float  # 0-1 (higher = longer relative stints)
    overtake_skill: float   # 0-1 (higher = better at gaining positions)
    dnf_rate: float         # 0-1 (lower is better — mech + driver sum, backwards compat)
    qualifying_edge: float  # 0-1 (higher = better qualifier)
    speed_rating: float = field(default=0.5)        # 0-1 (higher = higher top speed)
    pit_efficiency: float = field(default=0.5)      # 0-1 (higher = faster relative to team)
    mechanical_dnf_rate: float = field(default=0.0) # car-failure DNFs, team-averaged
    driver_dnf_rate: float = field(default=0.0)     # crash/error DNFs, individual


# ---------------------------------------------------------------------------
# Normalisation helpers
# ---------------------------------------------------------------------------

def _min_max_normalise(series: pd.Series, invert: bool = False) -> pd.Series:
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
    df = results_df[["driver_id", "driver_abbr"]].dropna(subset=["driver_abbr"])
    df = df.drop_duplicates("driver_abbr")
    return dict(zip(df["driver_abbr"].str.upper(), df["driver_id"]))


def _remap_lap_driver_ids(
    data_by_round: dict[int, pd.DataFrame],
    abbr_map: dict[str, str],
) -> dict[int, pd.DataFrame]:
    """Replace FastF1 3-letter codes in 'driver_id' column with ergast IDs."""
    remapped: dict[int, pd.DataFrame] = {}
    for rnd, df in data_by_round.items():
        if df.empty:
            remapped[rnd] = df
            continue
        df = df.copy()
        df["driver_id"] = (
            df["driver_id"].str.upper().map(abbr_map).fillna(df["driver_id"])
        )
        remapped[rnd] = df
    return remapped


# ---------------------------------------------------------------------------
# Individual rating components
# ---------------------------------------------------------------------------

def _compute_base_pace(
    results_df: pd.DataFrame,
    laps_by_round: dict[int, pd.DataFrame],
) -> pd.Series:
    """Median race lap time per driver, normalised (lower time = higher score)."""
    if laps_by_round:
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
            driver_pace = all_medians.groupby("driver_id")["lap_time_s"].mean()
            return _min_max_normalise(driver_pace, invert=True)

    _log.debug("No lap data — using finish position as pace proxy")
    finished = results_df[results_df["position"].notna()].copy()
    mean_pos = finished.groupby("driver_id")["position"].mean()
    return _min_max_normalise(mean_pos, invert=True)


def _compute_consistency(laps_by_round: dict[int, pd.DataFrame]) -> Optional[pd.Series]:
    """
    consistency = 1 - CV(lap_times) per driver.
    SC/VSC laps are excluded when TrackStatus data is available, so the
    coefficient of variation reflects clean-air pace variance only.
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

        # Exclude safety car / VSC laps where track_status is available
        if "track_status" in acc.columns:
            sc_mask = acc["track_status"].astype(str).str.contains("[45]", regex=True, na=False)
            clean = acc[~sc_mask]
            # Only use the filtered set if it retains at least half the laps
            if len(clean) >= max(3, len(acc) // 2):
                acc = clean

        frames.append(acc[["driver_id", "lap_time_s"]])

    if not frames:
        return None

    combined = pd.concat(frames)
    grp = combined.groupby("driver_id")["lap_time_s"]
    cv = grp.std() / grp.mean()
    raw = (1.0 - cv).clip(lower=0.0)
    return _min_max_normalise(raw)


def _compute_wet_skill_from_inter(
    laps_by_round: dict[int, pd.DataFrame],
) -> Optional[pd.Series]:
    """
    Fallback wet skill proxy using INTERMEDIATE compound laps.

    Computes each driver's median INTER lap time vs their median dry lap time.
    Drivers who go relatively fast on INTERs (ratio close to dry pace) score higher.
    Used when fewer than 2 wet/mixed weather rounds are available.
    """
    dry_frames: list[pd.DataFrame] = []
    inter_frames: list[pd.DataFrame] = []

    for laps in laps_by_round.values():
        if laps.empty or "compound" not in laps.columns:
            continue
        acc = laps[laps["is_accurate"] & laps["lap_time_s"].notna()].copy()
        if acc.empty:
            continue
        compound = acc["compound"].str.upper()
        inter_laps = acc[compound == "INTER"]
        dry_laps = acc[compound.isin(["SOFT", "MEDIUM", "HARD"])]
        if not inter_laps.empty:
            inter_frames.append(inter_laps[["driver_id", "lap_time_s"]])
        if not dry_laps.empty:
            dry_frames.append(dry_laps[["driver_id", "lap_time_s"]])

    if not inter_frames or not dry_frames:
        return None

    inter_median = pd.concat(inter_frames).groupby("driver_id")["lap_time_s"].median()
    dry_median = pd.concat(dry_frames).groupby("driver_id")["lap_time_s"].median()

    common = inter_median.index.intersection(dry_median.index)
    if len(common) < 3:
        return None

    # Ratio = dry_pace / inter_pace: closer to 1.0 → driver adapts well to INTER
    ratio = dry_median.loc[common] / inter_median.loc[common]
    return _min_max_normalise(ratio)


def _compute_wet_skill(
    results_df: pd.DataFrame,
    laps_by_round: dict[int, pd.DataFrame],
    weather_by_round: dict[int, str],
    prior_seasons_data: list[tuple[dict[int, pd.DataFrame], dict[int, str]]] | None = None,
) -> Optional[pd.Series]:
    """
    Wet skill = relative pace in wet vs dry conditions.
    Uses multi-season data when prior_seasons_data is supplied, fixing the
    0.5 fallback problem for seasons with few wet races.
    When wet rounds < 2 across all available data, falls back to INTER compound
    lap proxy so no driver defaults to the neutral 0.5.
    """
    if not laps_by_round and not prior_seasons_data:
        return None

    # Merge all seasons into a single pool, using offset keys to avoid collisions
    all_laps: dict[int, pd.DataFrame] = dict(laps_by_round)
    all_weather: dict[int, str] = {rnd: weather_by_round.get(rnd, "dry") for rnd in laps_by_round}

    if prior_seasons_data:
        offset = 10_000
        for prior_laps, prior_weather in prior_seasons_data:
            for rnd, laps in prior_laps.items():
                all_laps[offset + rnd] = laps
                all_weather[offset + rnd] = prior_weather.get(rnd, "dry")
            offset += 10_000

    wet_rounds = {rnd for rnd, w in all_weather.items() if w in ("wet", "mixed")}
    dry_rounds = {rnd for rnd, w in all_weather.items() if w == "dry"}

    if len(wet_rounds) < 2:
        _log.debug(
            "Too few wet rounds (%d) — using INTER compound laps as wet_skill proxy",
            len(wet_rounds),
        )
        return _compute_wet_skill_from_inter(all_laps)

    def _median_by_driver(rounds: set[int]) -> pd.Series:
        f = []
        for rnd in rounds:
            laps = all_laps.get(rnd, pd.DataFrame())
            if laps.empty:
                continue
            acc = laps[laps["is_accurate"] & laps["lap_time_s"].notna()]
            if not acc.empty:
                f.append(acc.groupby("driver_id")["lap_time_s"].median())
        if not f:
            return pd.Series(dtype=float)
        return pd.concat(f).groupby(level=0).mean()

    wet_pace = _median_by_driver(wet_rounds)
    dry_pace = _median_by_driver(dry_rounds)

    common = wet_pace.index.intersection(dry_pace.index)
    if len(common) < 3:
        # Fall back to INTER proxy rather than returning None
        return _compute_wet_skill_from_inter(all_laps)

    # Higher ratio = driver goes faster (relatively) in wet than dry
    ratio = dry_pace.loc[common] / wet_pace.loc[common]
    return _min_max_normalise(ratio)


def _compute_tyre_management(laps_by_round: dict[int, pd.DataFrame]) -> Optional[pd.Series]:
    """
    tyre_management = avg stint length normalised by expected compound life.
    Compound-aware: a HARD stint of 40 laps ≈ a SOFT stint of 20 laps.
    Drivers who extend stints beyond the expected compound life score higher.
    """
    if not laps_by_round:
        return None

    frames: list[pd.DataFrame] = []
    for laps in laps_by_round.values():
        if laps.empty or "stint" not in laps.columns:
            continue
        acc = laps[laps["is_accurate"] & laps["lap_time_s"].notna()].copy()
        if acc.empty:
            continue

        try:
            stint_df = (
                acc.groupby(["driver_id", "stint"])
                .agg(
                    stint_len=("lap_time_s", "count"),
                    compound=(
                        "compound",
                        lambda x: str(x.dropna().mode().iloc[0])
                        if not x.dropna().empty
                        else "UNKNOWN",
                    ),
                )
                .reset_index()
            )
        except Exception:
            continue

        expected = (
            stint_df["compound"].str.upper()
            .map(_EXPECTED_STINT_LAPS)
            .fillna(_DEFAULT_EXPECTED_LAPS)
        )
        stint_df["normalised_len"] = stint_df["stint_len"] / expected
        frames.append(stint_df[["driver_id", "normalised_len"]])

    if not frames:
        return None

    combined = pd.concat(frames)
    avg_norm = combined.groupby("driver_id")["normalised_len"].mean()
    return _min_max_normalise(avg_norm)


def _compute_overtake_skill(
    results_df: pd.DataFrame,
    overtake_difficulty: dict[str, float],
    laps_by_round: dict[int, pd.DataFrame] | None = None,
) -> pd.Series:
    """
    overtake_skill from lap-by-lap position changes when available,
    falling back to grid-vs-finish delta weighted by circuit difficulty.
    """
    if laps_by_round:
        pos_frames: list[pd.Series] = []
        for rnd, laps in laps_by_round.items():
            if laps.empty or "position" not in laps.columns:
                continue
            pos_data = laps[laps["position"].notna()].copy()
            if pos_data.empty:
                continue
            pos_data = pos_data.sort_values(["driver_id", "lap_number"])
            pos_data["prev_pos"] = pos_data.groupby("driver_id")["position"].shift(1)
            pos_data["gained"] = (pos_data["prev_pos"] - pos_data["position"]).clip(lower=0)
            pos_frames.append(pos_data.groupby("driver_id")["gained"].sum())

        if pos_frames:
            season_gains = pd.concat(pos_frames, axis=1).sum(axis=1)
            return _min_max_normalise(season_gains)

    # Fallback: grid − finish delta, weighted by circuit overtake difficulty
    df = results_df[
        results_df["position"].notna() & (results_df["grid"] > 0)
    ].copy()
    df["positions_gained"] = df["grid"] - df["position"]

    if "circuit_ref" in df.columns:
        df["difficulty"] = df["circuit_ref"].map(overtake_difficulty).fillna(0.5)
        df["weighted_gain"] = df["positions_gained"] * df["difficulty"]
        per_driver = df.groupby("driver_id")["weighted_gain"].mean()
    else:
        per_driver = df.groupby("driver_id")["positions_gained"].mean()

    return _min_max_normalise(per_driver)


def _compute_dnf_rates(
    results_df: pd.DataFrame,
    prior_results: dict[int, pd.DataFrame] | None = None,
) -> tuple[pd.Series, pd.Series, pd.Series]:
    """
    Compute split DNF rates weighted across current + prior seasons.

    Returns (total, mechanical_pooled, driver_error) as pd.Series per driver.

    mechanical_pooled: car-failure DNFs averaged within the *current* season's
        constructor — Ferrari 2022's engine failures are shared equally between
        Leclerc and Sainz rather than accruing to Leclerc's personal rating.
    driver_error: crash / incident DNFs, kept individual.
    total: mechanical_pooled + driver_error (stored as dnf_rate for back-compat).
    """
    all_frames: list[tuple[pd.DataFrame, float]] = [(results_df, 0.5)]
    if prior_results:
        for s, w in zip(sorted(prior_results.keys(), reverse=True)[:2], [0.3, 0.2]):
            all_frames.append((prior_results[s], w))

    weighted_mech:  dict[str, float] = {}
    weighted_drv:   dict[str, float] = {}
    weighted_races: dict[str, float] = {}

    for df, weight in all_frames:
        started = df.groupby("driver_id").size()
        if "dnf_cause" in df.columns:
            mech_dnfs  = (
                df[df["dnf"] & (df["dnf_cause"] == "mechanical")]
                .groupby("driver_id").size()
            )
            crash_dnfs = (
                df[df["dnf"] & (df["dnf_cause"].isin(["crash", "other"]))]
                .groupby("driver_id").size()
            )
        else:
            # No cause data — split 70 % mechanical / 30 % driver (F1 historical avg)
            total_dnfs = df[df["dnf"]].groupby("driver_id").size()
            mech_dnfs  = (total_dnfs * 0.7).round().astype(int)
            crash_dnfs = total_dnfs - mech_dnfs

        for driver in started.index:
            weighted_mech[driver]  = weighted_mech.get(driver, 0)  + weight * mech_dnfs.get(driver, 0)
            weighted_drv[driver]   = weighted_drv.get(driver, 0)   + weight * crash_dnfs.get(driver, 0)
            weighted_races[driver] = weighted_races.get(driver, 0) + weight * started[driver]

    drivers = list(weighted_races)
    mech_rates = pd.Series(
        {d: weighted_mech.get(d, 0) / weighted_races[d] for d in drivers},
        dtype=float,
    ).clip(0.0, 1.0)
    drv_rates = pd.Series(
        {d: weighted_drv.get(d, 0) / weighted_races[d] for d in drivers},
        dtype=float,
    ).clip(0.0, 1.0)

    # Pool mechanical DNF rates within each team using the *current* season's
    # constructor mapping.  Car reliability is a factory issue — teammates share it.
    driver_team = (
        results_df[["driver_id", "constructor_id"]]
        .drop_duplicates("driver_id")
        .set_index("driver_id")["constructor_id"]
    )
    mech_df = mech_rates.rename("mech_rate").to_frame()
    mech_df["team"] = mech_df.index.map(driver_team)
    has_team = mech_df["team"].notna()
    if has_team.any():
        team_avg = mech_df.loc[has_team].groupby("team")["mech_rate"].transform("mean")
        mech_df.loc[has_team, "mech_rate"] = team_avg
    mech_pooled = mech_df["mech_rate"].clip(0.0, 1.0)

    total = (mech_pooled + drv_rates).clip(0.0, 1.0)
    return total, mech_pooled, drv_rates


def _compute_dnf_rate(
    results_df: pd.DataFrame,
    prior_results: dict[int, pd.DataFrame] | None = None,
) -> pd.Series:
    """Legacy wrapper — returns total dnf_rate for callers that only need the sum."""
    total, _, _ = _compute_dnf_rates(results_df, prior_results)
    return total


def _compute_qualifying_edge(
    results_df: pd.DataFrame,
    telemetry_by_round: dict[int, pd.DataFrame] | None = None,
) -> pd.Series:
    """
    When telemetry is available: best sector-sum score vs teammate.
    Fallback: median grid-position score normalised vs field size.
    """
    if telemetry_by_round:
        required = {"driver_id", "sector1_best_s", "sector2_best_s", "sector3_best_s"}
        frames: list[pd.DataFrame] = []
        for telem in telemetry_by_round.values():
            if telem.empty or not required.issubset(telem.columns):
                continue
            t = telem[list(required)].dropna().copy()
            if t.empty:
                continue
            t["sector_sum"] = (
                t["sector1_best_s"] + t["sector2_best_s"] + t["sector3_best_s"]
            )
            t = t[t["sector_sum"] > 0]
            frames.append(t[["driver_id", "sector_sum"]])

        if frames:
            combined = pd.concat(frames)
            season_avg = combined.groupby("driver_id")["sector_sum"].mean()

            driver_team = (
                results_df[["driver_id", "constructor_id"]]
                .drop_duplicates("driver_id")
                .set_index("driver_id")["constructor_id"]
            )
            season_df = season_avg.rename("sector_sum").to_frame()
            season_df["team"] = season_df.index.map(driver_team)
            team_min = season_df.groupby("team")["sector_sum"].transform("min")
            # Ratio: teammate_best / this_driver — 1.0 = team's fastest
            ratio = team_min / season_df["sector_sum"].clip(lower=1e-6)
            return _min_max_normalise(ratio)

    # Fallback: grid position
    df = results_df[results_df["grid"] > 0].copy()
    field_size = df.groupby("round")["driver_id"].transform("count")
    df["qual_score"] = 1.0 - (df["grid"] - 1) / (field_size - 1).clip(lower=1)
    per_driver = df.groupby("driver_id")["qual_score"].median()
    return per_driver.clip(0.0, 1.0)


def _compute_speed_rating(
    telemetry_by_round: dict[int, pd.DataFrame],
) -> Optional[pd.Series]:
    """
    speed_rating = max speed trap achieved across season, normalised vs field.
    Higher = driver runs at higher absolute top speeds.
    """
    frames: list[pd.DataFrame] = []
    for telem in telemetry_by_round.values():
        if telem.empty or "speed_trap_max" not in telem.columns:
            continue
        valid = telem[["driver_id", "speed_trap_max"]].dropna()
        if not valid.empty:
            frames.append(valid)

    if not frames:
        return None

    combined = pd.concat(frames)
    driver_speed = combined.groupby("driver_id")["speed_trap_max"].max()
    return _min_max_normalise(driver_speed)


def _compute_pit_efficiency(
    pitstops_by_round: dict[int, pd.DataFrame],
    results_df: pd.DataFrame,
) -> Optional[pd.Series]:
    """
    pit_efficiency = driver avg pit stop time vs constructor average.
    Higher = faster pit stops relative to the team.
    """
    frames: list[pd.DataFrame] = []
    for pits in pitstops_by_round.values():
        if pits.empty or "pit_count" not in pits.columns:
            continue
        active = pits[pits["pit_count"] > 0].copy()
        if active.empty:
            continue
        active["avg_stop_s"] = (
            active["pit_time_total_s"] / active["pit_count"].clip(lower=1)
        )
        # Sanity: reasonable pit stop range 10–90 s
        active = active[(active["avg_stop_s"] >= 10.0) & (active["avg_stop_s"] <= 90.0)]
        if not active.empty:
            frames.append(active[["driver_id", "avg_stop_s"]])

    if not frames:
        return None

    combined = pd.concat(frames)
    season_avg = combined.groupby("driver_id")["avg_stop_s"].mean()

    driver_team = (
        results_df[["driver_id", "constructor_id"]]
        .drop_duplicates("driver_id")
        .set_index("driver_id")["constructor_id"]
    )
    season_df = season_avg.rename("avg_stop_s").to_frame()
    season_df["team"] = season_df.index.map(driver_team)
    team_avg = season_df.groupby("team")["avg_stop_s"].transform("mean")
    # >1.0 = driver faster than team average (team stops slower → ratio >1)
    ratio = team_avg / season_df["avg_stop_s"].clip(lower=1.0)
    return _min_max_normalise(ratio)


# ---------------------------------------------------------------------------
# Main public function
# ---------------------------------------------------------------------------

def compute_driver_ratings(
    season: int,
    results_df: pd.DataFrame,
    laps_by_round: dict[int, pd.DataFrame],
    weather_by_round: dict[int, str],
    telemetry_by_round: dict[int, pd.DataFrame] | None = None,
    pitstops_by_round: dict[int, pd.DataFrame] | None = None,
    prior_seasons_data: list[tuple[dict[int, pd.DataFrame], dict[int, str]]] | None = None,
    overtake_difficulty: dict[str, float] | None = None,
    prior_results: dict[int, pd.DataFrame] | None = None,
) -> list[DriverRating]:
    """
    Compute normalised driver ratings for a season.

    Args:
        season: F1 season year.
        results_df: Ergast race results.
        laps_by_round: FastF1 lap data keyed by round number.
        weather_by_round: Weather string keyed by round number.
        telemetry_by_round: Sector times + speed trap per round (optional).
        pitstops_by_round: Pit stop data per round (optional).
        prior_seasons_data: List of (laps_by_round, weather_by_round) for prior
            seasons — used for multi-season wet_skill computation.
        overtake_difficulty: circuit_ref → difficulty (0-1).
        prior_results: Prior season results for trailing 3-season DNF weighting.
    """
    if overtake_difficulty is None:
        overtake_difficulty = {}

    drivers = results_df["driver_id"].unique().tolist()
    _log.info("Computing ratings for %d drivers in season %d", len(drivers), season)

    # Remap all FastF1 3-letter codes to ergast driver IDs
    abbr_map = _build_abbr_to_ergast_id(results_df)

    if laps_by_round:
        laps_by_round = _remap_lap_driver_ids(laps_by_round, abbr_map)
    if telemetry_by_round:
        telemetry_by_round = _remap_lap_driver_ids(telemetry_by_round, abbr_map)
    if pitstops_by_round:
        pitstops_by_round = _remap_lap_driver_ids(pitstops_by_round, abbr_map)
    if prior_seasons_data:
        prior_seasons_data = [
            (_remap_lap_driver_ids(laps, abbr_map), weather)
            for laps, weather in prior_seasons_data
        ]

    # Compute each component
    base_pace    = _compute_base_pace(results_df, laps_by_round)
    consistency  = _compute_consistency(laps_by_round)
    wet_skill    = _compute_wet_skill(results_df, laps_by_round, weather_by_round, prior_seasons_data)
    tyre_mgmt    = _compute_tyre_management(laps_by_round)
    overtake     = _compute_overtake_skill(results_df, overtake_difficulty, laps_by_round)
    dnf_total, dnf_mech, dnf_drv = _compute_dnf_rates(results_df, prior_results)
    qual_edge    = _compute_qualifying_edge(results_df, telemetry_by_round)
    speed_rating = _compute_speed_rating(telemetry_by_round) if telemetry_by_round else None
    pit_eff      = _compute_pit_efficiency(pitstops_by_round, results_df) if pitstops_by_round else None

    def _get(series: pd.Series | None, driver: str, default: float = 0.5) -> float:
        if series is None or driver not in series.index:
            return default
        val = series[driver]
        return float(val) if not pd.isna(val) else default

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
            dnf_rate=_get(dnf_total, driver, default=0.0),
            qualifying_edge=_get(qual_edge, driver),
            speed_rating=_get(speed_rating, driver),
            pit_efficiency=_get(pit_eff, driver),
            mechanical_dnf_rate=_get(dnf_mech, driver, default=0.0),
            driver_dnf_rate=_get(dnf_drv, driver, default=0.0),
        ))

    _log.info("Computed %d driver ratings for season %d", len(ratings), season)
    return ratings
