"""
app/ingestion/fastf1_client.py — Synchronous FastF1 data client.

Fetches lap telemetry, sector times, speed trap, pit stop data, and weather.
FastF1 is a synchronous library — do NOT call from async route handlers.
Call only from Celery tasks or seeding scripts.

Cache layout:
    data/cache/{season}/{round}/fastf1_laps.parquet      — lap times, compound, position
    data/cache/{season}/{round}/fastf1_telemetry.parquet — sector bests + speed trap per driver
    data/cache/{season}/{round}/fastf1_pitstops.parquet  — pit counts, pit time, SC laps
    data/cache/{season}/{round}/fastf1_weather.txt       — dominant weather string
"""
from __future__ import annotations

import logging
from pathlib import Path

import numpy as np
import pandas as pd

from app.config import settings

_log = logging.getLogger(__name__)

try:
    import fastf1  # type: ignore[import]

    _FF1_AVAILABLE = True
except ImportError:  # pragma: no cover
    _FF1_AVAILABLE = False
    _log.warning("fastf1 not installed — FastF1 client will return empty frames")


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _ensure_cache() -> None:
    if not _FF1_AVAILABLE:
        return
    cache_dir = settings.f1_cache_dir
    cache_dir.mkdir(parents=True, exist_ok=True)
    fastf1.Cache.enable_cache(str(cache_dir))


def _parquet_dir(season: int, round_number: int) -> Path:
    path = settings.cache_dir / str(season) / str(round_number)
    path.mkdir(parents=True, exist_ok=True)
    return path


def _load_session(season: int, round_number: int, identifier: str = "R"):  # type: ignore[return]
    """Load a FastF1 race session, returning None on any failure."""
    if not _FF1_AVAILABLE:
        return None
    _ensure_cache()
    try:
        session = fastf1.get_session(season, round_number, identifier)
        session.load(laps=True, weather=True, telemetry=False, messages=False)
        return session
    except Exception as exc:
        _log.warning(
            "FastF1 failed to load session %d/%d/%s: %s", season, round_number, identifier, exc
        )
        return None


def _timedelta_s(col: pd.Series) -> pd.Series:
    """Convert a timedelta64 column to float seconds, NaN on missing."""
    try:
        return col.dt.total_seconds()
    except AttributeError:
        return pd.Series(np.nan, index=col.index)


# ---------------------------------------------------------------------------
# Public API — per-round fetchers
# ---------------------------------------------------------------------------

def fetch_race_laps(season: int, round_number: int) -> pd.DataFrame:
    """
    Return cleaned race-lap data for one session.

    Columns:
        driver_id    str   FastF1 three-letter abbreviation (e.g. "HAM")
        lap_number   int
        lap_time_s   float  Lap time in seconds (NaN for inlap/outlap)
        compound     str   SOFT / MEDIUM / HARD / INTER / WET / UNKNOWN
        stint        int   Stint number (1-indexed)
        is_accurate  bool  FastF1 accuracy flag
        track_status str   TrackStatus string ("1"=clear, "4"=SC, "5"=VSC, …)
        position     float Race position at end of lap (NaN if unavailable)

    Cached to data/cache/{season}/{round}/fastf1_laps.parquet.
    Old cached files without track_status/position are returned as-is; callers
    check for column existence before use.
    """
    cache = _parquet_dir(season, round_number) / "fastf1_laps.parquet"
    if cache.exists():
        _log.debug("Cache hit: %s", cache)
        return pd.read_parquet(cache)

    session = _load_session(season, round_number)
    if session is None:
        _log.warning("No FastF1 session for %d/%d — returning empty laps", season, round_number)
        return pd.DataFrame(
            columns=[
                "driver_id", "lap_number", "lap_time_s",
                "compound", "stint", "is_accurate", "track_status", "position",
            ]
        )

    laps = session.laps.copy()

    frame_dict: dict = {
        "driver_id": laps["Driver"].astype(str),
        "lap_number": laps["LapNumber"].astype(int),
        "lap_time_s": _timedelta_s(laps["LapTime"]).replace({np.nan: None}),
        "compound": laps["Compound"].fillna("UNKNOWN").str.upper(),
        "stint": laps["Stint"].fillna(1).astype(int),
        "is_accurate": laps["IsAccurate"].fillna(False).astype(bool),
    }

    if "TrackStatus" in laps.columns:
        frame_dict["track_status"] = laps["TrackStatus"].fillna("1").astype(str)
    else:
        frame_dict["track_status"] = pd.Series("1", index=laps.index, dtype=str)

    if "Position" in laps.columns:
        frame_dict["position"] = pd.to_numeric(laps["Position"], errors="coerce")
    else:
        frame_dict["position"] = pd.Series(np.nan, index=laps.index)

    rows = pd.DataFrame(frame_dict)
    if rows.empty:
        _log.warning(
            "FastF1 returned 0 laps for %d/%d — skipping cache write so next run retries",
            season, round_number,
        )
        return rows
    rows.to_parquet(cache, index=False)
    _log.info("Fetched %d laps for %d/%d", len(rows), season, round_number)
    return rows


def fetch_race_telemetry(season: int, round_number: int) -> pd.DataFrame:
    """
    Per-driver best sector times and max speed trap for a race.

    Columns:
        driver_id       str   FastF1 three-letter abbreviation
        sector1_best_s  float Best Sector 1 time in seconds
        sector2_best_s  float Best Sector 2 time in seconds
        sector3_best_s  float Best Sector 3 time in seconds
        speed_trap_max  float Maximum speed trap reading in km/h

    Cached to data/cache/{season}/{round}/fastf1_telemetry.parquet.
    """
    _EMPTY_COLS = ["driver_id", "sector1_best_s", "sector2_best_s", "sector3_best_s", "speed_trap_max"]
    cache = _parquet_dir(season, round_number) / "fastf1_telemetry.parquet"
    if cache.exists():
        _log.debug("Cache hit: %s", cache)
        return pd.read_parquet(cache)

    session = _load_session(season, round_number)
    if session is None or session.laps is None or session.laps.empty:
        return pd.DataFrame(columns=_EMPTY_COLS)

    laps = session.laps
    rows = []

    for driver in laps["Driver"].dropna().unique():
        drv = laps[laps["Driver"] == driver]

        s1 = _timedelta_s(drv["Sector1Time"]).dropna() if "Sector1Time" in drv.columns else pd.Series(dtype=float)
        s2 = _timedelta_s(drv["Sector2Time"]).dropna() if "Sector2Time" in drv.columns else pd.Series(dtype=float)
        s3 = _timedelta_s(drv["Sector3Time"]).dropna() if "Sector3Time" in drv.columns else pd.Series(dtype=float)
        speed = pd.to_numeric(drv["SpeedST"], errors="coerce").dropna() if "SpeedST" in drv.columns else pd.Series(dtype=float)

        rows.append({
            "driver_id": driver,
            "sector1_best_s": float(s1.min()) if not s1.empty else None,
            "sector2_best_s": float(s2.min()) if not s2.empty else None,
            "sector3_best_s": float(s3.min()) if not s3.empty else None,
            "speed_trap_max": float(speed.max()) if not speed.empty else None,
        })

    df = pd.DataFrame(rows) if rows else pd.DataFrame(columns=_EMPTY_COLS)
    df.to_parquet(cache, index=False)
    _log.info(
        "Fetched telemetry for %d drivers in %d/%d", len(df), season, round_number
    )
    return df


def fetch_race_pitstops(season: int, round_number: int) -> pd.DataFrame:
    """
    Per-driver pit stop data and race safety car lap count.

    Columns:
        driver_id        str  FastF1 three-letter abbreviation
        pit_count        int  Number of pit stops made
        pit_time_total_s float Total pit loss time in seconds
        safety_car_laps  int  SC + VSC laps in the race (same value for all drivers)

    Cached to data/cache/{season}/{round}/fastf1_pitstops.parquet.
    """
    _EMPTY_COLS = ["driver_id", "pit_count", "pit_time_total_s", "safety_car_laps"]
    cache = _parquet_dir(season, round_number) / "fastf1_pitstops.parquet"
    if cache.exists():
        _log.debug("Cache hit: %s", cache)
        return pd.read_parquet(cache)

    session = _load_session(season, round_number)
    if session is None or session.laps is None or session.laps.empty:
        return pd.DataFrame(columns=_EMPTY_COLS)

    laps = session.laps

    # Count safety car and VSC laps (unique lap numbers with status 4 or 5)
    sc_laps = 0
    if "TrackStatus" in laps.columns:
        sc_mask = laps["TrackStatus"].astype(str).str.contains("[45]", regex=True, na=False)
        sc_laps = int(laps.loc[sc_mask, "LapNumber"].nunique())

    rows = []
    for driver in laps["Driver"].dropna().unique():
        drv = laps[laps["Driver"] == driver].copy()
        pit_count = 0
        pit_time_s = 0.0

        if "PitInTime" in drv.columns and "PitOutTime" in drv.columns:
            pit_in_laps = drv[drv["PitInTime"].notna()].copy()
            out_laps = drv[drv["PitOutTime"].notna()].copy()
            pit_count = len(pit_in_laps)

            for _, pit_row in pit_in_laps.iterrows():
                next_out = out_laps[out_laps["LapNumber"] > pit_row["LapNumber"]]
                if next_out.empty:
                    continue
                out_row = next_out.iloc[0]
                try:
                    delta = (out_row["PitOutTime"] - pit_row["PitInTime"]).total_seconds()
                    if 5.0 <= delta <= 120.0:
                        pit_time_s += delta
                except (TypeError, AttributeError):
                    pass

        rows.append({
            "driver_id": driver,
            "pit_count": pit_count,
            "pit_time_total_s": pit_time_s,
            "safety_car_laps": sc_laps,
        })

    df = pd.DataFrame(rows) if rows else pd.DataFrame(columns=_EMPTY_COLS)
    df.to_parquet(cache, index=False)
    _log.info(
        "Fetched pitstops for %d drivers in %d/%d (SC laps: %d)",
        len(df), season, round_number, sc_laps,
    )
    return df


def fetch_race_weather(season: int, round_number: int) -> str:
    """
    Return the dominant weather condition for a race session.

    Returns one of: 'dry', 'wet', 'mixed'.
    Falls back to 'dry' if session or weather data is unavailable.
    Cached to data/cache/{season}/{round}/fastf1_weather.txt.
    """
    cache_file = _parquet_dir(season, round_number) / "fastf1_weather.txt"
    if cache_file.exists():
        return cache_file.read_text().strip()

    session = _load_session(season, round_number)
    if session is None or session.weather_data is None or session.weather_data.empty:
        result = "dry"
    else:
        weather = session.weather_data
        if "Rainfall" not in weather.columns:
            result = "dry"
        else:
            rain_fraction = weather["Rainfall"].astype(bool).mean()
            if rain_fraction > 0.6:
                result = "wet"
            elif rain_fraction > 0.2:
                result = "mixed"
            else:
                result = "dry"

    cache_file.write_text(result)
    return result


# ---------------------------------------------------------------------------
# Public API — season-level batch fetchers
# ---------------------------------------------------------------------------

def fetch_season_laps(season: int, round_numbers: list[int]) -> dict[int, pd.DataFrame]:
    """Fetch lap data for multiple rounds. Dict: round → DataFrame."""
    result: dict[int, pd.DataFrame] = {}
    total = len(round_numbers)
    for i, rnd in enumerate(round_numbers, 1):
        cache = _parquet_dir(season, rnd) / "fastf1_laps.parquet"
        hit = "(cached)" if cache.exists() else "(downloading...)"
        _log.info("[%d] Round %2d/%d %s", season, i, total, hit)
        try:
            result[rnd] = fetch_race_laps(season, rnd)
        except Exception as exc:
            _log.error("Error fetching laps %d/round %d: %s", season, rnd, exc)
            result[rnd] = pd.DataFrame(
                columns=[
                    "driver_id", "lap_number", "lap_time_s",
                    "compound", "stint", "is_accurate", "track_status", "position",
                ]
            )
    total_rows = sum(len(df) for df in result.values())
    _log.info("[%d] Laps done: %d rounds, %d lap rows total", season, total, total_rows)
    return result


def fetch_season_telemetry(season: int, round_numbers: list[int]) -> dict[int, pd.DataFrame]:
    """Fetch sector/speed telemetry for multiple rounds. Dict: round → DataFrame."""
    result: dict[int, pd.DataFrame] = {}
    _EMPTY = ["driver_id", "sector1_best_s", "sector2_best_s", "sector3_best_s", "speed_trap_max"]
    for rnd in round_numbers:
        try:
            result[rnd] = fetch_race_telemetry(season, rnd)
        except Exception as exc:
            _log.error("Error fetching telemetry %d/round %d: %s", season, rnd, exc)
            result[rnd] = pd.DataFrame(columns=_EMPTY)
    _log.info("[%d] Telemetry done: %d rounds", season, len(result))
    return result


def fetch_season_pitstops(season: int, round_numbers: list[int]) -> dict[int, pd.DataFrame]:
    """Fetch pit stop data for multiple rounds. Dict: round → DataFrame."""
    result: dict[int, pd.DataFrame] = {}
    _EMPTY = ["driver_id", "pit_count", "pit_time_total_s", "safety_car_laps"]
    for rnd in round_numbers:
        try:
            result[rnd] = fetch_race_pitstops(season, rnd)
        except Exception as exc:
            _log.error("Error fetching pitstops %d/round %d: %s", season, rnd, exc)
            result[rnd] = pd.DataFrame(columns=_EMPTY)
    _log.info("[%d] Pitstops done: %d rounds", season, len(result))
    return result


def try_get_cached_season_laps(season: int) -> dict[int, pd.DataFrame]:
    """
    Return cached lap DataFrames for a season without triggering downloads.
    Used by the transformer pipeline to load prior-season data for wet_skill.
    """
    if not _FF1_AVAILABLE:
        return {}
    result: dict[int, pd.DataFrame] = {}
    season_dir = settings.cache_dir / str(season)
    if not season_dir.exists():
        return {}
    for rnd_dir in season_dir.iterdir():
        if not rnd_dir.is_dir():
            continue
        try:
            rnd = int(rnd_dir.name)
        except ValueError:
            continue
        cache = rnd_dir / "fastf1_laps.parquet"
        if cache.exists():
            try:
                result[rnd] = pd.read_parquet(cache)
            except Exception:
                pass
    return result


def try_get_cached_season_weather(season: int) -> dict[int, str]:
    """
    Return cached weather strings for a season without triggering downloads.
    """
    result: dict[int, str] = {}
    season_dir = settings.cache_dir / str(season)
    if not season_dir.exists():
        return {}
    for rnd_dir in season_dir.iterdir():
        if not rnd_dir.is_dir():
            continue
        try:
            rnd = int(rnd_dir.name)
        except ValueError:
            continue
        cache = rnd_dir / "fastf1_weather.txt"
        if cache.exists():
            try:
                result[rnd] = cache.read_text().strip()
            except Exception:
                pass
    return result
