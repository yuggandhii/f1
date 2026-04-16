"""
app/analytics/what_if.py — What-if scenario engine.

Applies a list of modifications to driver ratings and/or circuits before
re-running the Monte Carlo simulation.

Supported modification types:
  - {"type": "remove_driver",    "driver_id": "max_verstappen"}
  - {"type": "reliability",      "driver_id": "...", "multiplier": 2.0}
  - {"type": "pace_adjustment",  "driver_id": "...", "delta": -0.1}
  - {"type": "set_weather",      "circuit_ref": "monaco", "weather": "wet"}
"""
from __future__ import annotations

from dataclasses import replace

from app.simulation.performance_model import DriverRating
from app.simulation.race_simulator import CircuitInfo


def apply_modifications(
    ratings: list[DriverRating],
    circuits: list[CircuitInfo],
    modifications: list[dict],
) -> tuple[list[DriverRating], list[CircuitInfo], dict]:
    """
    Apply scenario modifications to ratings and circuits.

    Returns:
        modified_ratings:  updated driver list
        modified_circuits: updated circuit list
        summary:           {"applied": [description strings]}
    """
    mod_ratings = list(ratings)
    mod_circuits = list(circuits)
    applied: list[str] = []

    for mod in modifications:
        t = mod.get("type", "")

        if t == "remove_driver":
            driver_id = mod["driver_id"]
            before = len(mod_ratings)
            mod_ratings = [r for r in mod_ratings if r.driver_id != driver_id]
            if len(mod_ratings) < before:
                applied.append(f"removed driver {driver_id!r}")

        elif t == "reliability":
            driver_id = mod["driver_id"]
            multiplier = float(mod.get("multiplier", 1.0))
            mod_ratings = [
                replace(r, dnf_rate=min(0.95, r.dnf_rate * multiplier))
                if r.driver_id == driver_id
                else r
                for r in mod_ratings
            ]
            applied.append(f"reliability x{multiplier} for {driver_id!r}")

        elif t == "pace_adjustment":
            driver_id = mod["driver_id"]
            delta = float(mod.get("delta", 0.0))
            mod_ratings = [
                replace(r, base_pace=max(0.0, min(1.0, r.base_pace + delta)))
                if r.driver_id == driver_id
                else r
                for r in mod_ratings
            ]
            applied.append(f"pace {delta:+.2f} for {driver_id!r}")

        elif t == "set_weather":
            circuit_ref = mod["circuit_ref"]
            # Force weather_variability=1.0 so the circuit always rolls as wet
            mod_circuits = [
                replace(c, weather_variability=1.0)
                if c.circuit_ref == circuit_ref
                else c
                for c in mod_circuits
            ]
            weather = mod.get("weather", "wet")
            applied.append(f"weather={weather!r} forced at {circuit_ref!r}")

    return mod_ratings, mod_circuits, {"applied": applied}
