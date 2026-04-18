"""
app/ingestion/weather_client.py — OpenMeteo weather forecast client.

Fetches 7-day hourly precipitation forecast for a circuit's coordinates
using the free OpenMeteo API (no API key required).

API: https://api.open-meteo.com/v1/forecast
Docs: https://open-meteo.com/en/docs

Condition mapping:
    precipitation_probability < 20%  → 'dry'
    20% ≤ precipitation_probability < 60% → 'mixed'
    precipitation_probability ≥ 60%  → 'wet'

Celery beat task: f1sim.ingestion.fetch_weather_forecasts
Runs every Thursday to refresh forecasts for the upcoming race weekend.
"""
from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, timezone

import requests

_log = logging.getLogger(__name__)

_OPENMETEO_URL = "https://api.open-meteo.com/v1/forecast"
_TIMEOUT = 15
# F1 race starts are typically 14:00–15:00 local time; use 14:00 UTC as proxy
_RACE_HOUR_UTC = 14


def _condition_from_prob(prob: float) -> str:
    """Map precipitation probability (0–100) to dry/mixed/wet."""
    if prob < 20:
        return "dry"
    elif prob < 60:
        return "mixed"
    return "wet"


def fetch_race_weather_forecast(
    latitude: float,
    longitude: float,
    race_date: date,
) -> dict | None:
    """
    Fetch precipitation forecast for a specific race day and time.

    Args:
        latitude:  Circuit latitude.
        longitude: Circuit longitude.
        race_date: The Sunday race date.

    Returns:
        dict with keys: precipitation_probability (float), predicted_condition (str),
        or None if the fetch fails or the date is beyond the 7-day horizon.
    """
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": "precipitation_probability",
        "forecast_days": 7,
        "timezone": "UTC",
    }

    try:
        resp = requests.get(_OPENMETEO_URL, params=params, timeout=_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        _log.warning("OpenMeteo request failed: %s", exc)
        return None

    hourly = data.get("hourly", {})
    times = hourly.get("time", [])
    probs = hourly.get("precipitation_probability", [])

    if not times or not probs:
        _log.warning("OpenMeteo returned empty hourly data")
        return None

    # Find the slot for race_date at the target hour
    target_str = f"{race_date.isoformat()}T{_RACE_HOUR_UTC:02d}:00"
    for t, p in zip(times, probs):
        if t == target_str:
            if p is None:
                p = 0.0
            return {
                "precipitation_probability": float(p) / 100.0,
                "predicted_condition": _condition_from_prob(float(p)),
            }

    # Target hour not in the 7-day window
    _log.debug(
        "Race date %s not in OpenMeteo 7-day forecast window", race_date.isoformat()
    )
    return None


def upsert_weather_forecast(
    session,  # SQLAlchemy sync Session
    circuit_id: uuid.UUID,
    race_date: date,
    latitude: float,
    longitude: float,
) -> bool:
    """
    Fetch and persist a weather forecast for one race.

    Returns True if a forecast was saved, False otherwise.
    """
    from app.models.race_weather_forecast import RaceWeatherForecast

    forecast = fetch_race_weather_forecast(latitude, longitude, race_date)
    if forecast is None:
        _log.info(
            "No forecast available for circuit %s on %s (outside 7-day window or API error)",
            circuit_id, race_date,
        )
        return False

    existing = (
        session.query(RaceWeatherForecast)
        .filter_by(circuit_id=circuit_id, race_date=race_date)
        .first()
    )
    if existing:
        existing.precipitation_probability = forecast["precipitation_probability"]
        existing.predicted_condition = forecast["predicted_condition"]
        existing.fetched_at = datetime.now(timezone.utc)
    else:
        session.add(RaceWeatherForecast(
            id=uuid.uuid4(),
            circuit_id=circuit_id,
            race_date=race_date,
            precipitation_probability=forecast["precipitation_probability"],
            predicted_condition=forecast["predicted_condition"],
            fetched_at=datetime.now(timezone.utc),
        ))
    session.flush()

    _log.info(
        "Weather forecast for circuit %s on %s: %s (%.0f%%)",
        circuit_id, race_date,
        forecast["predicted_condition"],
        forecast["precipitation_probability"] * 100,
    )
    return True
