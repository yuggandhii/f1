"""
app/ingestion/fastf1_client.py — Synchronous FastF1 data client.

Fetches lap telemetry, tyre data, and weather for race sessions.
FastF1 is a synchronous library — do NOT call from async route handlers.
Call only from Celery tasks or seeding scripts.

Cache is stored at settings.f1_cache_dir (./data/fastf1_cache by default).
Processed Parquet output goes to data/cache/{season}/{round}/fastf1_laps.parquet
"""
from __future__ import annotations

import logging
from pathlib import Path

import numpy as np
import pandas as pd

from app.config import settings

_log = logging.getLogger(__name__)

# Import lazily to allow the module to load even when fastf1 is absent in CI.
try:
    import fastf1  # type: ignore[import]

    _FF1_AVAILABLE = True
except ImportError:  # pragma: no cover
    _ff1 = None  # type: ignore[assignment]
    _FF1_AVAILABLE = False
    _log.warning("fastf1 not installed — FastF1 client will return empty frames")


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _ensure_cache() -> None:
    """Enable FastF1's on-disk cache. Must be called before any session load."""
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
    """Load a FastF1 session, returning None on any failure."""
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


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def fetch_race_laps(season: int, round_number: int) -> pd.DataFrame:
    """
    Return a cleaned DataFrame of all race laps for a session.

    Columns:
        driver_id   str      FastF1 three-letter abbreviation (e.g. "HAM")
        lap_number  int
        lap_time_s  float    Lap time in seconds (NaN for inlap/outlap)
        compound    str      Tyre compound: SOFT / MEDIUM / HARD / INTER / WET
        stint       int      Stint number (1-indexed, reset after each pitstop)
        is_accurate bool     FastF1 accuracy flag (inlap/outlap = False)

    Returns empty DataFrame if session is unavailable (future/cancelled race).
    Result is cached to data/cache/{season}/{round_number}/fastf1_laps.parquet.
    """
    cache = _parquet_dir(season, round_number) / "fastf1_laps.parquet"
    if cache.exists():
        _log.debug("Cache hit: %s", cache)
        return pd.read_parquet(cache)

    session = _load_session(season, round_number)
    if session is None:
        _log.warning("No FastF1 session for %d/%d — returning empty laps", season, round_number)
        return pd.DataFrame(
            columns=["driver_id", "lap_number", "lap_time_s", "compound", "stint", "is_accurate"]
        )

    laps = session.laps.copy()

    # Build cleaned frame.
    rows = pd.DataFrame({
        "driver_id": laps["Driver"].astype(str),
        "lap_number": laps["LapNumber"].astype(int),
        "lap_time_s": (
            laps["LapTime"].dt.total_seconds().replace({np.nan: None})
        ),
        "compound": laps["Compound"].fillna("UNKNOWN").str.upper(),
        "stint": laps["Stint"].fillna(1).astype(int),
        "is_accurate": laps["IsAccurate"].fillna(False).astype(bool),
    })

    rows.to_parquet(cache, index=False)
    _log.info("Fetched %d laps for %d/%d", len(rows), season, round_number)
    return rows


def fetch_race_weather(season: int, round_number: int) -> str:
    """
    Return the dominant weather condition for a race session.

    Returns one of: 'dry', 'wet', 'mixed'.
    Falls back to 'dry' if session or weather data is unavailable.
    Result is cached to data/cache/{season}/{round}/fastf1_weather.txt so
    re-running seed_db.py never re-parses the FastF1 session disk cache.
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


def fetch_season_laps(season: int, round_numbers: list[int]) -> dict[int, pd.DataFrame]:
    """
    Fetch lap data for multiple rounds.  Returns dict: round → laps DataFrame.
    Failures for individual rounds are logged but do not abort the whole season.
    """
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
                columns=["driver_id", "lap_number", "lap_time_s", "compound", "stint", "is_accurate"]
            )
    laps_fetched = sum(len(df) for df in result.values())
    _log.info("[%d] Season laps done: %d rounds, %d lap rows total", season, total, laps_fetched)
    return result
