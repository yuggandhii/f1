"""app/api/simulations.py — Simulation job endpoints."""
from __future__ import annotations

import uuid
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.api.deps import DBSession
from app.models.simulation_run import SimulationRun

router = APIRouter(prefix="/simulations", tags=["simulations"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class SimulationRequest(BaseModel):
    season: int = Field(..., ge=2018, le=2030)
    n_sims: int = Field(default=10_000, ge=100, le=50_000)
    randomness_factor: float = Field(default=0.15, ge=0.0, le=1.0)
    scenario: dict | None = None


class SimulationResponse(BaseModel):
    run_id: str
    status: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.post("/", response_model=SimulationResponse, status_code=202)
async def create_simulation(body: SimulationRequest, db: DBSession) -> SimulationResponse:
    """Enqueue a new simulation job. Returns run_id immediately (async)."""
    import logging
    _log = logging.getLogger(__name__)

    run = SimulationRun(
        id=uuid.uuid4(),
        season=body.season,
        n_simulations=body.n_sims,
        randomness_factor=body.randomness_factor,
        scenario=body.scenario,
        status="pending",
    )
    db.add(run)
    await db.flush()
    run_id_str = str(run.id)

    # Dispatch Celery task — gracefully degrades if broker unavailable
    try:
        from app.simulation.tasks import run_season_simulation
        run_season_simulation.delay(run_id_str)
    except Exception as exc:
        _log.warning("Celery dispatch failed (broker down?): %s", exc)

    return SimulationResponse(run_id=run_id_str, status="pending")


@router.get("/{run_id}")
async def get_simulation(run_id: UUID, db: DBSession) -> dict:
    """Return the status and metadata for a simulation run."""
    run = await db.get(SimulationRun, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Simulation run not found")
    return {
        "run_id": str(run.id),
        "season": run.season,
        "n_simulations": run.n_simulations,
        "randomness_factor": run.randomness_factor,
        "status": run.status,
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
        "result_path": run.result_path,
    }


@router.get("/{run_id}/driver-probabilities")
async def get_driver_probabilities(run_id: UUID, db: DBSession) -> list[dict]:
    """Return WDC probabilities per driver for a completed run."""
    from app.models.simulation_run import SimulationResult
    result = await db.execute(
        select(SimulationResult)
        .where(SimulationResult.run_id == run_id)
        .order_by(SimulationResult.wdc_probability.desc())
    )
    rows = result.scalars().all()
    if not rows:
        raise HTTPException(status_code=404, detail="No results found for this run")
    return [
        {
            "driver_id": str(r.driver_id),
            "wdc_probability": r.wdc_probability,
            "expected_points": r.expected_points,
            "points_std": r.points_std,
            "podium_rate": r.podium_rate,
            "dnf_rate_simulated": r.dnf_rate_simulated,
        }
        for r in rows
    ]


@router.get("/{run_id}/race-breakdown/{circuit_id}")
async def get_race_breakdown(run_id: UUID, circuit_id: UUID, db: DBSession) -> list[dict]:
    """Per-race win probabilities for a given circuit within a simulation run."""
    from app.models.simulation_run import SimulationResult
    result = await db.execute(
        select(SimulationResult).where(SimulationResult.run_id == run_id)
    )
    rows = result.scalars().all()
    circuit_str = str(circuit_id)
    return [
        {
            "driver_id": str(r.driver_id),
            "win_probability": (r.per_race_win_probs or {}).get(circuit_str, 0.0),
        }
        for r in rows
    ]
