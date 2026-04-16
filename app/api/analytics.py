"""app/api/analytics.py — Analytics endpoints (stub for Phase 0)."""
from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/head-to-head")
async def head_to_head(driver_a: str, driver_b: str, run_id: str) -> dict:
    """Head-to-head driver comparison.  Full implementation in Phase 5."""
    return {"message": "Not yet implemented (Phase 5)", "driver_a": driver_a, "driver_b": driver_b}


@router.get("/team-comparison")
async def team_comparison(run_id: str) -> dict:
    return {"message": "Not yet implemented (Phase 5)", "run_id": run_id}


@router.get("/season-trajectory")
async def season_trajectory(run_id: str, driver_id: str) -> dict:
    return {"message": "Not yet implemented (Phase 5)", "run_id": run_id, "driver_id": driver_id}
