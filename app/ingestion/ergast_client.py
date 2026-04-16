"""
app/ingestion/ergast_client.py — Synchronous Ergast/Jolpica API client.

Fetches historical F1 data: race calendars, race results, qualifying results.
Rate limit: 4 req/sec — enforces 0.25 s sleep between HTTP calls.
Raw responses are cached as Parquet in data/cache/{season}/ so repeated
calls (e.g. re-runs of seed_db) skip the network entirely.
"""
from __future__ import annotations

import logging
import time
from pathlib import Path

import pandas as pd
import requests

from app.config import settings

_log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
_BASE_URL = "https://api.jolpi.ca/ergast/f1"
_PAGE_SIZE = 200        # max items per API request
_RATE_SLEEP = 0.25      # 4 req/sec budget
_TIMEOUT = 30           # seconds per request
_MAX_RETRIES = 3

# Static overtake difficulty for circuits that appear in 2018-2024 calendar.
# Scale 0.0–1.0: 1.0 = very hard to overtake (Monaco), 0.0 = easy (Monza).
CIRCUIT_OVERTAKE_DIFFICULTY: dict[str, float] = {
    "monaco": 1.0,
    "hungaroring": 0.85,
    "singapore": 0.80,
    "zandvoort": 0.75,
    "albert_park": 0.65,
    "marina_bay": 0.80,
    "red_bull_ring": 0.40,
    "spa": 0.45,
    "monza": 0.30,
    "interlagos": 0.35,
    "bahrain": 0.40,
    "yas_marina": 0.50,
    "circuit_of_the_americas": 0.50,
    "suzuka": 0.60,
    "silverstone": 0.45,
    "barcelona": 0.70,
    "baku": 0.55,
    "sochi": 0.60,
    "portimao": 0.55,
    "mugello": 0.50,
    "nurburgring": 0.45,
    "imola": 0.65,
    "istanbul": 0.55,
    "losail": 0.50,
    "jeddah": 0.60,
    "miami": 0.55,
    "las_vegas": 0.45,
    "rodriguez": 0.55,
    "villeneuve": 0.50,
    "shanghai": 0.50,
}

# Track type classification.
CIRCUIT_TRACK_TYPE: dict[str, str] = {
    "monaco": "street",
    "singapore": "street",
    "baku": "street",
    "jeddah": "street",
    "las_vegas": "street",
    "villeneuve": "street",
    "albert_park": "street",
    "miami": "street",
    "losail": "permanent",
    "hungaroring": "permanent",
    "zandvoort": "permanent",
    "spa": "permanent",
    "monza": "permanent",
    "interlagos": "permanent",
    "bahrain": "permanent",
    "yas_marina": "permanent",
    "red_bull_ring": "permanent",
    "circuit_of_the_americas": "permanent",
    "suzuka": "permanent",
    "silverstone": "permanent",
    "barcelona": "permanent",
    "portimao": "permanent",
    "mugello": "permanent",
    "nurburgring": "permanent",
    "imola": "permanent",
    "istanbul": "permanent",
    "sochi": "street",
    "rodriguez": "permanent",
    "shanghai": "permanent",
}

# Weather variability per circuit: 0=always dry, 1=highly variable.
CIRCUIT_WEATHER_VARIABILITY: dict[str, float] = {
    "spa": 0.90,
    "interlagos": 0.75,
    "suzuka": 0.65,
    "silverstone": 0.70,
    "nurburgring": 0.80,
    "istanbul": 0.60,
    "hungaroring": 0.30,
    "monaco": 0.40,
    "singapore": 0.50,
    "bahrain": 0.05,
    "yas_marina": 0.05,
    "losail": 0.05,
    "jeddah": 0.10,
    "baku": 0.20,
    "monza": 0.30,
    "albert_park": 0.40,
    "barcelona": 0.25,
    "red_bull_ring": 0.45,
    "circuit_of_the_americas": 0.50,
    "portimao": 0.45,
    "imola": 0.40,
    "zandvoort": 0.50,
    "miami": 0.35,
    "las_vegas": 0.10,
    "mugello": 0.30,
    "sochi": 0.20,
    "rodriguez": 0.40,
    "shanghai": 0.45,
    "villeneuve": 0.45,
}

# Approximate lap counts.
CIRCUIT_LAP_COUNT: dict[str, int] = {
    "monaco": 78, "hungaroring": 70, "singapore": 61, "zandvoort": 72,
    "albert_park": 58, "red_bull_ring": 71, "spa": 44, "monza": 53,
    "interlagos": 71, "bahrain": 57, "yas_marina": 58,
    "circuit_of_the_americas": 56, "suzuka": 53, "silverstone": 52,
    "barcelona": 66, "baku": 51, "sochi": 53, "portimao": 66,
    "mugello": 59, "nurburgring": 60, "imola": 63, "istanbul": 58,
    "losail": 57, "jeddah": 50, "miami": 57, "las_vegas": 50,
    "rodriguez": 71, "villeneuve": 70, "shanghai": 56,
}

# DNF status keywords → cause category.
_MECHANICAL_KEYWORDS = frozenset([
    "engine", "gearbox", "hydraulic", "power unit", "mechanical",
    "oil", "fuel", "brake", "suspension", "turbo", "exhaust",
    "driveshaft", "electrical", "overheating", "clutch", "wheel",
    "cooling", "throttle", "pneumatic", "tyre", "puncture",
])
_CRASH_KEYWORDS = frozenset([
    "accident", "collision", "crash", "spin", "damage", "contact",
])


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _cache_dir(season: int) -> Path:
    path = settings.cache_dir / str(season)
    path.mkdir(parents=True, exist_ok=True)
    return path


def _get_json(url: str) -> dict:
    """HTTP GET with exponential backoff on 429/5xx."""
    for attempt in range(_MAX_RETRIES):
        try:
            resp = requests.get(url, timeout=_TIMEOUT)
            if resp.status_code == 429:
                wait = 2 ** attempt
                _log.warning("Rate limited; sleeping %ds", wait)
                time.sleep(wait)
                continue
            resp.raise_for_status()
            time.sleep(_RATE_SLEEP)
            return resp.json()
        except requests.RequestException as exc:
            if attempt == _MAX_RETRIES - 1:
                raise
            _log.warning("Request error %s, retry %d/%d", exc, attempt + 1, _MAX_RETRIES)
            time.sleep(1.0)
    raise RuntimeError(f"Failed to fetch {url} after {_MAX_RETRIES} attempts")


def _paginate(base_url: str, table_key: str, items_key: str) -> list[dict]:
    """Collect all pages from a paginated Ergast endpoint."""
    all_items: list[dict] = []
    offset = 0
    while True:
        url = f"{base_url}.json?limit={_PAGE_SIZE}&offset={offset}"
        data = _get_json(url)
        mr = data["MRData"]
        table = mr[table_key]
        items = table.get(items_key, [])
        all_items.extend(items)
        total = int(mr.get("total", 0))
        offset += _PAGE_SIZE
        if offset >= total:
            break
    return all_items


def _classify_dnf(status: str) -> tuple[bool, str | None]:
    """Return (is_dnf, dnf_cause) from an Ergast status string."""
    if status == "Finished":
        return False, None
    # "+N Laps" classified finishes are not DNFs.
    if status.startswith("+") or "lap" in status.lower():
        return False, None
    # Otherwise it's a DNF.
    s = status.lower()
    if any(k in s for k in _MECHANICAL_KEYWORDS):
        return True, "mechanical"
    if any(k in s for k in _CRASH_KEYWORDS):
        return True, "crash"
    return True, "other"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def fetch_season_races(season: int) -> pd.DataFrame:
    """
    Return a DataFrame of all races in a season.

    Columns: round, season, race_name, circuit_ref, circuit_name,
             country, locality, date, overtake_difficulty,
             weather_variability, track_type, lap_count
    """
    cache = _cache_dir(season) / "ergast_races.parquet"
    if cache.exists():
        _log.debug("Cache hit: %s", cache)
        return pd.read_parquet(cache)

    _log.info("Fetching races for season %d from Ergast", season)
    races = _paginate(f"{_BASE_URL}/{season}/races", "RaceTable", "Races")

    rows = []
    for race in races:
        circ = race["Circuit"]
        circuit_ref = circ["circuitId"]
        rows.append({
            "round": int(race["round"]),
            "season": int(race["season"]),
            "race_name": race["raceName"],
            "circuit_ref": circuit_ref,
            "circuit_name": circ["circuitName"],
            "country": circ["Location"]["country"],
            "locality": circ["Location"]["locality"],
            "date": race.get("date", ""),
            "overtake_difficulty": CIRCUIT_OVERTAKE_DIFFICULTY.get(circuit_ref, 0.5),
            "weather_variability": CIRCUIT_WEATHER_VARIABILITY.get(circuit_ref, 0.3),
            "track_type": CIRCUIT_TRACK_TYPE.get(circuit_ref, "permanent"),
            "lap_count": CIRCUIT_LAP_COUNT.get(circuit_ref, 55),
        })

    df = pd.DataFrame(rows)
    df.to_parquet(cache, index=False)
    _log.info("Fetched %d races for %d", len(df), season)
    return df


def fetch_season_results(season: int) -> pd.DataFrame:
    """
    Return a DataFrame of all race results for a season.

    Columns: round, season, driver_id, driver_name, driver_abbr,
             driver_nationality, constructor_id, constructor_name,
             grid, position, points, status, dnf, dnf_cause,
             fastest_lap, race_time_ms
    """
    cache = _cache_dir(season) / "ergast_results.parquet"
    if cache.exists():
        _log.debug("Cache hit: %s", cache)
        return pd.read_parquet(cache)

    _log.info("Fetching race results for season %d from Ergast", season)
    races = _paginate(f"{_BASE_URL}/{season}/results", "RaceTable", "Races")

    rows = []
    for race in races:
        rnd = int(race["round"])
        for res in race.get("Results", []):
            is_dnf, dnf_cause = _classify_dnf(res.get("status", "Finished"))
            position_str = res.get("position", "")
            rows.append({
                "round": rnd,
                "season": season,
                "driver_id": res["Driver"]["driverId"],
                "driver_name": (
                    f"{res['Driver']['givenName']} {res['Driver']['familyName']}"
                ),
                "driver_abbr": res["Driver"].get("code", "")[:3],
                "driver_nationality": res["Driver"].get("nationality", ""),
                "constructor_id": res["Constructor"]["constructorId"],
                "constructor_name": res["Constructor"]["name"],
                "grid": int(res.get("grid", 0)),
                "position": int(position_str) if position_str.isdigit() else None,
                "points": float(res.get("points", 0)),
                "status": res.get("status", "Finished"),
                "dnf": is_dnf,
                "dnf_cause": dnf_cause,
                "fastest_lap": res.get("FastestLap", {}).get("rank") == "1",
                "race_time_ms": (
                    int(res["Time"]["millis"])
                    if "Time" in res and "millis" in res["Time"]
                    else None
                ),
            })

    df = pd.DataFrame(rows)
    df.to_parquet(cache, index=False)
    _log.info("Fetched %d results for %d", len(df), season)
    return df


def fetch_season_qualifying(season: int) -> pd.DataFrame:
    """
    Return a DataFrame of qualifying results for a season.

    Columns: round, season, driver_id, position, q1, q2, q3
    """
    cache = _cache_dir(season) / "ergast_qualifying.parquet"
    if cache.exists():
        _log.debug("Cache hit: %s", cache)
        return pd.read_parquet(cache)

    _log.info("Fetching qualifying for season %d from Ergast", season)
    races = _paginate(f"{_BASE_URL}/{season}/qualifying", "RaceTable", "Races")

    rows = []
    for race in races:
        rnd = int(race["round"])
        for qual in race.get("QualifyingResults", []):
            rows.append({
                "round": rnd,
                "season": season,
                "driver_id": qual["Driver"]["driverId"],
                "position": int(qual["position"]),
                "q1": qual.get("Q1", ""),
                "q2": qual.get("Q2", ""),
                "q3": qual.get("Q3", ""),
            })

    df = pd.DataFrame(rows)
    df.to_parquet(cache, index=False)
    _log.info("Fetched %d qualifying rows for %d", len(df), season)
    return df
