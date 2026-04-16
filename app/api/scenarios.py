"""app/api/scenarios.py — What-if scenario endpoints."""
from __future__ import annotations

import uuid

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.api.deps import DBSession

router = APIRouter(prefix="/scenarios", tags=["scenarios"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class Modification(BaseModel):
    type: str = Field(..., description="remove_driver | reliability | pace_adjustment | set_weather")
    driver_id: str | None = None
    circuit_ref: str | None = None
    weather: str | None = None
    multiplier: float | None = Field(default=None, ge=0.1, le=10.0)
    delta: float | None = Field(default=None, ge=-1.0, le=1.0)


class WhatIfRequest(BaseModel):
    base_run_id: str
    season: int = Field(..., ge=2018, le=2030)
    n_sims: int = Field(default=1_000, ge=100, le=50_000)
    randomness_factor: float = Field(default=0.15, ge=0.0, le=1.0)
    modifications: list[Modification] = Field(..., min_length=1)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.post("/what-if", status_code=202)
async def what_if(body: WhatIfRequest, db: DBSession) -> dict:
    """
    Enqueue a what-if simulation with scenario modifications.

    Returns a new run_id immediately. Poll GET /simulations/{run_id} for status,
    or open a WebSocket at /ws/simulations/{run_id}/progress for streaming updates.
    """
    import logging
    from app.models.simulation_run import SimulationRun

    _log = logging.getLogger(__name__)

    run = SimulationRun(
        id=uuid.uuid4(),
        season=body.season,
        n_simulations=body.n_sims,
        randomness_factor=body.randomness_factor,
        scenario={
            "base_run_id": body.base_run_id,
            "modifications": [m.model_dump(exclude_none=True) for m in body.modifications],
        },
        status="pending",
    )
    db.add(run)
    await db.flush()
    run_id_str = str(run.id)

    try:
        from app.simulation.tasks import run_season_simulation
        run_season_simulation.delay(run_id_str)
    except Exception as exc:
        _log.warning("Celery dispatch failed: %s", exc)

    return {
        "run_id": run_id_str,
        "status": "pending",
        "base_run_id": body.base_run_id,
        "modifications": [m.model_dump(exclude_none=True) for m in body.modifications],
    }
