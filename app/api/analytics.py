"""app/api/analytics.py — Analytics endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import DBSession

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/head-to-head")
async def head_to_head(driver_a: str, driver_b: str, run_id: str) -> dict:
    """Head-to-head driver comparison."""
    return {"message": "Not yet implemented (Phase 5)", "driver_a": driver_a, "driver_b": driver_b}


@router.get("/team-comparison")
async def team_comparison(run_id: str) -> dict:
    return {"message": "Not yet implemented (Phase 5)", "run_id": run_id}


@router.get("/season-trajectory")
async def season_trajectory(run_id: str, driver_id: str) -> dict:
    return {"message": "Not yet implemented (Phase 5)", "run_id": run_id, "driver_id": driver_id}


@router.get("/teammate-comparison")
async def teammate_comparison(season: int, db: DBSession) -> dict:
    """
    Return all drivers ranked by their teammate comparison index for the given season.

    teammate_index > 0  → driver is faster than their teammate
    teammate_index < 0  → driver is slower than their teammate
    """
    from sqlalchemy import text

    rows = await db.execute(
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
    )
    data = rows.fetchall()

    if not data:
        raise HTTPException(
            status_code=404,
            detail=f"No teammate comparison data for season {season}. "
                   "Run seed_db.py --seasons {season} first.",
        )

    return {
        "season": season,
        "drivers": [
            {
                "driver": row.driver_name,
                "constructor": row.constructor_id,
                "teammate_index": round(float(row.teammate_index), 4),
                "base_pace": round(float(row.base_pace), 4),
            }
            for row in data
        ],
    }
