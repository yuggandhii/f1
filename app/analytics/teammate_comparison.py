"""
app/analytics/teammate_comparison.py — Teammate comparison index computation.

For each driver in each season, computes:
    teammate_index = (driver_pace - teammate_pace) / max(driver_pace, teammate_pace)

Positive = driver is faster than their teammate.
Negative = driver is slower than their teammate.
Range: approximately [-1, +1], normalized across all pairs.

The metric is based on base_pace from driver_ratings, which already incorporates
lap time data, qualifying results, and race performance.
"""
from __future__ import annotations

import logging

import pandas as pd

_log = logging.getLogger(__name__)


def compute_teammate_index(
    driver_paces: dict[str, float],   # driver_id (ergast) → base_pace [0,1]
    driver_teams: dict[str, str],     # driver_id → constructor_id
) -> dict[str, float]:
    """
    Compute teammate_index for all drivers in a season.

    Args:
        driver_paces: Mapping of ergast driver_id → base_pace rating (0–1).
        driver_teams: Mapping of ergast driver_id → constructor_id.

    Returns:
        Mapping of driver_id → teammate_index (float, roughly [-1, +1]).
        Drivers without a teammate receive 0.0.
    """
    # Group drivers by team
    team_drivers: dict[str, list[str]] = {}
    for driver, team in driver_teams.items():
        if driver not in driver_paces:
            continue
        team_drivers.setdefault(team, []).append(driver)

    indices: dict[str, float] = {}

    for team, drivers in team_drivers.items():
        if len(drivers) < 2:
            # Solo driver — no comparison possible
            for d in drivers:
                indices[d] = 0.0
            continue

        if len(drivers) > 2:
            # More than 2 drivers in a team (rare, e.g. mid-season swaps)
            # Compare each driver to the best teammate
            paces = {d: driver_paces.get(d, 0.5) for d in drivers}
            for d in drivers:
                others = [o for o in drivers if o != d]
                best_other = max(others, key=lambda o: paces[o])
                dp = paces[d]
                tp = paces[best_other]
                denom = max(dp, tp, 1e-9)
                indices[d] = (dp - tp) / denom
        else:
            d1, d2 = drivers
            p1 = driver_paces.get(d1, 0.5)
            p2 = driver_paces.get(d2, 0.5)
            denom = max(p1, p2, 1e-9)
            indices[d1] = (p1 - p2) / denom
            indices[d2] = (p2 - p1) / denom

    # Normalize to [-1, +1] across the full driver pool
    if indices:
        vals = pd.Series(indices)
        max_abs = vals.abs().max()
        if max_abs > 1e-9:
            vals = vals / max_abs
        indices = vals.clip(-1.0, 1.0).to_dict()

    return indices


def compute_teammate_index_from_db(
    session,        # SQLAlchemy sync Session
    season: int,
) -> dict[str, float]:
    """
    Load base_pace ratings + team assignments from DB and compute teammate_index.

    Returns ergast-style driver_id → teammate_index mapping.
    Requires that driver_ratings and race_results are already seeded for the season.
    """
    from sqlalchemy import text

    # Load driver ratings for the season
    rows = session.execute(
        text("""
            SELECT
                d.name            AS driver_name,
                dr.base_pace      AS base_pace,
                rr.constructor_id AS constructor_id
            FROM driver_ratings dr
            JOIN drivers d ON d.id = dr.driver_id
            JOIN (
                SELECT DISTINCT ON (driver_id)
                    driver_id,
                    constructor_id
                FROM race_results
                WHERE season = :season
                ORDER BY driver_id, round DESC
            ) rr ON rr.driver_id = d.id
            WHERE dr.season = :season
              AND dr.base_pace IS NOT NULL
        """),
        {"season": season},
    ).fetchall()

    if not rows:
        _log.warning("No driver ratings found for season %d in DB", season)
        return {}

    # Build ergast-style ID (snake_case name) → pace / team
    driver_paces: dict[str, float] = {}
    driver_teams: dict[str, str] = {}
    name_to_id: dict[str, str] = {}

    for row in rows:
        ergast_id = row.driver_name.lower().replace(" ", "_")
        name_to_id[row.driver_name] = ergast_id
        driver_paces[ergast_id] = float(row.base_pace)
        driver_teams[ergast_id] = row.constructor_id

    return compute_teammate_index(driver_paces, driver_teams)


def get_teammate_comparison(
    session,        # SQLAlchemy sync Session
    season: int,
) -> list[dict]:
    """
    Return a ranked list of drivers by teammate_index for a given season.

    Used by the API endpoint GET /api/v1/analytics/teammate-comparison.
    """
    from sqlalchemy import text

    rows = session.execute(
        text("""
            SELECT
                d.name            AS driver_name,
                dr.teammate_index AS teammate_index,
                dr.base_pace      AS base_pace,
                rr.constructor_id AS constructor_id
            FROM driver_ratings dr
            JOIN drivers d ON d.id = dr.driver_id
            JOIN (
                SELECT DISTINCT ON (driver_id)
                    driver_id,
                    constructor_id
                FROM race_results
                WHERE season = :season
                ORDER BY driver_id, round DESC
            ) rr ON rr.driver_id = d.id
            WHERE dr.season = :season
              AND dr.teammate_index IS NOT NULL
            ORDER BY dr.teammate_index DESC
        """),
        {"season": season},
    ).fetchall()

    return [
        {
            "driver": row.driver_name,
            "constructor": row.constructor_id,
            "teammate_index": round(float(row.teammate_index), 4),
            "base_pace": round(float(row.base_pace), 4),
        }
        for row in rows
    ]
