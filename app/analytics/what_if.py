"""
app/analytics/what_if.py — What-If Scenario Engine.

Six scenario types (case-insensitive, also accepted as legacy snake_case):
  DRIVER_SWAP      — driver takes own skills, gets target team's car_performance
  RELIABILITY_FIX  — zero mechanical_dnf_rate for all drivers of a team
  REMOVE_DRIVER    — remove driver entirely from the field
  WEATHER_CHANGE   — force a weather condition on specified circuits
  TEAM_ORDERS_FREE — equalise car_performance for both drivers of a team
  REMAINING_SEASON — trim calendar to rounds after current_round, inject standings

Legacy modification types (backwards compat):
  remove_driver, reliability, pace_adjustment, set_weather
"""
from __future__ import annotations

from dataclasses import replace
from typing import Any

from app.simulation.performance_model import DriverRating
from app.simulation.race_simulator import CircuitInfo


# ---------------------------------------------------------------------------
# Scenario templates — returned by GET /scenarios/templates
# ---------------------------------------------------------------------------

SCENARIO_TEMPLATES: list[dict] = [
    {
        "type": "DRIVER_SWAP",
        "description": "Move a driver to a different team's car",
        "params": {
            "driver_id": "max_verstappen",
            "to_team": "ferrari",
        },
        "example_prompt": "What if Verstappen drove for Ferrari?",
    },
    {
        "type": "RELIABILITY_FIX",
        "description": "Eliminate mechanical failures for a team",
        "params": {
            "team": "ferrari",
            "mechanical_dnf_rate": 0.01,
        },
        "example_prompt": "What if Ferrari had fixed their reliability issues in 2022?",
    },
    {
        "type": "REMOVE_DRIVER",
        "description": "Remove a driver from the rest of the season",
        "params": {
            "driver_id": "max_verstappen",
        },
        "example_prompt": "What if Verstappen retired from the season?",
    },
    {
        "type": "WEATHER_CHANGE",
        "description": "Force wet or dry conditions at specified circuits",
        "params": {
            "weather": "wet",
            "circuits": ["monaco", "silverstone"],
        },
        "example_prompt": "What if Monaco was always wet?",
    },
    {
        "type": "TEAM_ORDERS_FREE",
        "description": "Both teammates get equal car development",
        "params": {
            "team": "red_bull",
        },
        "example_prompt": "What if Red Bull gave both drivers equal machinery?",
    },
    {
        "type": "REMAINING_SEASON",
        "description": "Simulate only remaining races from current standings",
        "params": {
            "current_round": 10,
            "current_standings": {
                "max_verstappen": 195,
                "sergio_perez": 144,
                "fernando_alonso": 109,
            },
        },
        "example_prompt": "Who will win the championship from this point?",
    },
]


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

_REQUIRED_PARAMS: dict[str, list[str]] = {
    "DRIVER_SWAP": ["driver_id", "to_team"],
    "RELIABILITY_FIX": ["team"],
    "REMOVE_DRIVER": ["driver_id"],
    "WEATHER_CHANGE": ["weather"],
    "TEAM_ORDERS_FREE": ["team"],
    "REMAINING_SEASON": ["current_round"],
    # legacy
    "remove_driver": ["driver_id"],
    "reliability": ["driver_id"],
    "pace_adjustment": ["driver_id"],
    "set_weather": ["circuit_ref"],
}

_VALID_WEATHER = {"wet", "dry", "mixed", "historical", "random"}


def validate_scenario(scenario: dict) -> list[str]:
    """
    Return a list of validation error strings (empty = valid).
    """
    errors: list[str] = []
    t = (scenario.get("type") or "").upper()
    legacy_t = scenario.get("type", "")

    norm_type = t if t in _REQUIRED_PARAMS else legacy_t
    required = _REQUIRED_PARAMS.get(norm_type) or _REQUIRED_PARAMS.get(t, [])

    for field in required:
        if field not in scenario or scenario[field] is None:
            errors.append(f"Missing required field: {field!r}")

    if norm_type in ("WEATHER_CHANGE", "set_weather"):
        w = scenario.get("weather", "")
        if w and w not in _VALID_WEATHER:
            errors.append(f"Invalid weather {w!r}; must be one of {sorted(_VALID_WEATHER)}")

    return errors


def describe_scenario(scenario: dict) -> str:
    """Return a human-readable one-line description of a scenario."""
    t = (scenario.get("type") or "").upper()

    if t == "DRIVER_SWAP":
        return (
            f"Driver swap: {scenario.get('driver_id')} moves to "
            f"{scenario.get('to_team')}"
        )
    if t == "RELIABILITY_FIX":
        rate = scenario.get("mechanical_dnf_rate", 0.01)
        return f"Reliability fix: {scenario.get('team')} mechanical DNF rate = {rate}"
    if t == "REMOVE_DRIVER":
        return f"Remove driver: {scenario.get('driver_id')} withdrawn from season"
    if t == "WEATHER_CHANGE":
        circuits = scenario.get("circuits") or ["all circuits"]
        return f"Weather change: {scenario.get('weather')} at {circuits}"
    if t == "TEAM_ORDERS_FREE":
        return f"Team orders free: both {scenario.get('team')} drivers get equal car"
    if t == "REMAINING_SEASON":
        rnd = scenario.get("current_round", 0)
        n = len(scenario.get("current_standings") or {})
        return f"Remaining season from round {rnd} with {n} driver standings"
    # legacy
    lt = scenario.get("type", "")
    if lt == "remove_driver":
        return f"Remove driver: {scenario.get('driver_id')}"
    if lt == "reliability":
        return f"Reliability x{scenario.get('multiplier', 1.0)} for {scenario.get('driver_id')}"
    if lt == "pace_adjustment":
        return f"Pace {scenario.get('delta', 0):+.2f} for {scenario.get('driver_id')}"
    if lt == "set_weather":
        return f"Force {scenario.get('weather', 'wet')} at {scenario.get('circuit_ref')}"
    return f"Unknown scenario type: {scenario.get('type')}"


# ---------------------------------------------------------------------------
# Core apply_scenario
# ---------------------------------------------------------------------------

def apply_scenario(
    ratings: list[DriverRating],
    circuits: list[CircuitInfo],
    scenario: dict,
    driver_teams: dict[str, str] | None = None,
    team_car_perf: dict[str, float] | None = None,
) -> tuple[list[DriverRating], list[CircuitInfo], dict[str, float] | None, str]:
    """
    Apply one scenario to ratings and circuits.

    Args:
        ratings:       Current driver rating list.
        circuits:      Season circuit calendar.
        scenario:      Scenario dict with 'type' and type-specific fields.
        driver_teams:  driver_id → constructor_id (needed for DRIVER_SWAP, RELIABILITY_FIX, TEAM_ORDERS_FREE).
        team_car_perf: constructor_id → car_performance (needed for DRIVER_SWAP, TEAM_ORDERS_FREE).

    Returns:
        (modified_ratings, modified_circuits, starting_points, description)
        starting_points is non-None only for REMAINING_SEASON.
    """
    t = (scenario.get("type") or "").upper()
    mod_ratings = list(ratings)
    mod_circuits = list(circuits)
    starting_points: dict[str, float] | None = None

    # ── DRIVER_SWAP ───────────────────────────────────────────────────────────    # ✨ DRIVER_SWAP ✨
    if t == "DRIVER_SWAP":
        driver_id = scenario["driver_id"]
        to_team = scenario["to_team"].lower()
        new_car_perf = (team_car_perf or {}).get(to_team, 0.5)

        # Find the source driver's original team and car performance
        from_team = None
        source_car_perf = 0.5
        for r_id, t_name in list(driver_teams.items()):
            if _match_driver(r_id, driver_id):
                from_team = t_name
                break
        if from_team:
            source_car_perf = team_car_perf.get(from_team, 0.5)

        # Evaluate the best driver in the destination team to swap out
        best_dest_driver = None
        best_rating = -1.0
        for r in mod_ratings:
            d_id = r.driver_id.lower().replace(" ", "_")
            if driver_teams.get(d_id) == to_team and not _match_driver(d_id, driver_id):
                # higher total base pace and consistency + qualifying edge = better driver
                rating = r.base_pace + r.consistency + r.qualifying_edge
                if rating > best_rating:
                    best_rating = rating
                    best_dest_driver = r.driver_id

        for i, r in enumerate(mod_ratings):
            if _match_driver(r.driver_id, driver_id):
                # Source driver gets destination car
                mod_ratings[i] = replace(r, car_performance=new_car_perf)
            elif best_dest_driver and _match_driver(r.driver_id, best_dest_driver):
                # The swapped-out team leader gets the source driver's original car
                mod_ratings[i] = replace(r, car_performance=source_car_perf)

    # ── RELIABILITY_FIX ───────────────────────────────────────────────────────
    elif t == "RELIABILITY_FIX":
        team = scenario["team"].lower()
        target_rate = float(scenario.get("mechanical_dnf_rate", 0.01))
        team_drivers = _drivers_for_team(mod_ratings, team, driver_teams)
        mod_ratings = [
            replace(r,
                    mechanical_dnf_rate=target_rate,
                    dnf_rate=target_rate + r.driver_dnf_rate)
            if r.driver_id in team_drivers
            else r
            for r in mod_ratings
        ]

    # ── REMOVE_DRIVER ─────────────────────────────────────────────────────────
    elif t == "REMOVE_DRIVER":
        driver_id = scenario["driver_id"]
        mod_ratings = [r for r in mod_ratings if not _match_driver(r.driver_id, driver_id)]

    # ── WEATHER_CHANGE ────────────────────────────────────────────────────────
    elif t == "WEATHER_CHANGE":
        weather = scenario.get("weather", "wet")
        target_circuits: list[str] = [c.lower() for c in (scenario.get("circuits") or [])]
        mod_circuits = [
            replace(c, predicted_weather=weather)
            if (not target_circuits or c.circuit_ref in target_circuits)
            else c
            for c in mod_circuits
        ]

    # ── TEAM_ORDERS_FREE ──────────────────────────────────────────────────────
    elif t == "TEAM_ORDERS_FREE":
        team = scenario["team"].lower()
        team_drivers = _drivers_for_team(mod_ratings, team, driver_teams)
        car_perfs = [
            r.car_performance for r in mod_ratings if r.driver_id in team_drivers
        ]
        if car_perfs:
            avg_perf = sum(car_perfs) / len(car_perfs)
            mod_ratings = [
                replace(r, car_performance=avg_perf)
                if r.driver_id in team_drivers
                else r
                for r in mod_ratings
            ]

    # ── REMAINING_SEASON ─────────────────────────────────────────────────────
    elif t == "REMAINING_SEASON":
        current_round = int(scenario.get("current_round", 0))
        raw_standings: dict[str, Any] = scenario.get("current_standings") or {}
        starting_points = {k: float(v) for k, v in raw_standings.items()}
        mod_circuits = [c for c in mod_circuits if c.round > current_round]

    # ── Legacy types (backwards compat) ──────────────────────────────────────
    else:
        lt = scenario.get("type", "")
        if lt == "remove_driver":
            driver_id = scenario["driver_id"]
            mod_ratings = [r for r in mod_ratings if not _match_driver(r.driver_id, driver_id)]
        elif lt == "reliability":
            driver_id = scenario["driver_id"]
            multiplier = float(scenario.get("multiplier", 1.0))
            mod_ratings = [
                replace(r, dnf_rate=min(0.95, r.dnf_rate * multiplier))
                if _match_driver(r.driver_id, driver_id)
                else r
                for r in mod_ratings
            ]
        elif lt == "pace_adjustment":
            driver_id = scenario["driver_id"]
            delta = float(scenario.get("delta", 0.0))
            mod_ratings = [
                replace(r, base_pace=max(0.0, min(1.0, r.base_pace + delta)))
                if _match_driver(r.driver_id, driver_id)
                else r
                for r in mod_ratings
            ]
        elif lt == "set_weather":
            circuit_ref = scenario["circuit_ref"]
            weather = scenario.get("weather", "wet")
            mod_circuits = [
                replace(c, predicted_weather=weather)
                if c.circuit_ref == circuit_ref
                else c
                for c in mod_circuits
            ]

    desc = describe_scenario(scenario)
    return mod_ratings, mod_circuits, starting_points, desc


# ---------------------------------------------------------------------------
# apply_modifications — backward-compatible wrapper
# ---------------------------------------------------------------------------

def apply_modifications(
    ratings: list[DriverRating],
    circuits: list[CircuitInfo],
    modifications: list[dict],
    driver_teams: dict[str, str] | None = None,
    team_car_perf: dict[str, float] | None = None,
) -> tuple[list[DriverRating], list[CircuitInfo], dict]:
    """
    Apply a list of scenario dicts sequentially.

    Returns (modified_ratings, modified_circuits, summary_dict).
    Note: starting_points from REMAINING_SEASON are not surfaced here;
    use apply_scenario() directly when you need them.
    """
    mod_ratings = list(ratings)
    mod_circuits = list(circuits)
    applied: list[str] = []

    for mod in modifications:
        mod_ratings, mod_circuits, _sp, desc = apply_scenario(
            mod_ratings, mod_circuits, mod, driver_teams, team_car_perf
        )
        applied.append(desc)

    return mod_ratings, mod_circuits, {"applied": applied}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _match_driver(rating_id: str, target: str) -> bool:
    """Fuzzy match: exact, slug-normalised, or suffix match."""
    r = rating_id.lower().replace(" ", "_")
    t = target.lower().replace(" ", "_")
    return r == t or r.endswith(t) or t.endswith(r)


def _drivers_for_team(
    ratings: list[DriverRating],
    team: str,
    driver_teams: dict[str, str] | None,
) -> set[str]:
    """Return driver_ids belonging to a team slug."""
    if not driver_teams:
        return set()
    result: set[str] = set()
    for r in ratings:
        con = (driver_teams.get(r.driver_id) or "").lower().replace(" ", "_")
        if con == team or con.endswith(team) or team.endswith(con):
            result.add(r.driver_id)
    return result
