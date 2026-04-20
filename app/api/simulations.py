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
from typing import Optional
class SimulationRequest(BaseModel):
    season: int = Field(..., ge=2018, le=2030)
    n_sims: int = Field(default=10_000, ge=100, le=50_000)
    randomness_factor: float = Field(default=0.15, ge=0.0, le=1.0)
    scenario: dict | None = None
    data_range_start: Optional[int] = Field(default=None, ge=2018, le=2026)
    data_range_end: Optional[int] = Field(default=None, ge=2018, le=2026)
    cutoff_round: Optional[int] = Field(default=None, ge=1, le=30)


class SimulationResponse(BaseModel):
    run_id: str
    status: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.get("/")
async def list_simulations(
    db: DBSession,
    season: Optional[int] = None,
    limit: int = 20,
) -> list[dict]:
    """Return recent simulation runs, optionally filtered by season."""
    from sqlalchemy import desc
    query = select(SimulationRun).order_by(desc(SimulationRun.started_at)).limit(limit)
    if season is not None:
        query = query.where(SimulationRun.season == season)
    result = await db.execute(query)
    runs = result.scalars().all()
    return [
        {
            "run_id": str(r.id),
            "season": r.season,
            "n_simulations": r.n_simulations,
            "randomness_factor": r.randomness_factor,
            "status": r.status,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
        }
        for r in runs
    ]


@router.post("/", response_model=SimulationResponse, status_code=202)
async def create_simulation(body: SimulationRequest, db: DBSession) -> SimulationResponse:
    """Enqueue a new simulation job. Returns run_id immediately (async)."""
    import logging
    _log = logging.getLogger(__name__)

    # Merge data_range + cutoff_round into scenario dict so the Celery task can read it
    merged_scenario: dict | None = body.scenario
    if body.data_range_start is not None or body.data_range_end is not None or body.cutoff_round is not None:
        merged_scenario = dict(body.scenario or {})
        if body.data_range_start is not None:
            merged_scenario["data_range_start"] = body.data_range_start
        if body.data_range_end is not None:
            merged_scenario["data_range_end"] = body.data_range_end
        if body.cutoff_round is not None:
            merged_scenario["cutoff_round"] = body.cutoff_round

    run = SimulationRun(
        id=uuid.uuid4(),
        season=body.season,
        n_simulations=body.n_sims,
        randomness_factor=body.randomness_factor,
        scenario=merged_scenario,
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
    """Return WDC probabilities per driver, joined with driver and team names."""
    from app.models.simulation_run import SimulationResult
    from app.models.driver import Driver
    from app.models.team import Team

    result = await db.execute(
        select(SimulationResult, Driver, Team)
        .join(Driver, Driver.id == SimulationResult.driver_id)
        .outerjoin(Team, Team.id == Driver.team_id)
        .where(SimulationResult.run_id == run_id)
        .order_by(SimulationResult.wdc_probability.desc())
    )
    rows = result.all()
    if not rows:
        raise HTTPException(status_code=404, detail="No results found for this run")
    return [
        {
            "driver_id": str(sim.driver_id),
            "driver_name": drv.name,
            "driver_abbreviation": drv.abbreviation,
            "team_name": team.name if team else None,
            "team_constructor": team.constructor_name if team else None,
            "wdc_probability": sim.wdc_probability,
            "expected_points": sim.expected_points,
            "points_std": sim.points_std,
            "podium_rate": sim.podium_rate,
            "dnf_rate_simulated": sim.dnf_rate_simulated,
        }
        for sim, drv, team in rows
    ]


@router.get("/{run_id}/constructor-probabilities")
async def get_constructor_probabilities(run_id: UUID, db: DBSession) -> list[dict]:
    """Return WCC projected points and aggregated driver share per constructor."""
    from app.models.simulation_run import SimulationResult
    from app.models.driver import Driver
    from app.models.team import Team
    from sqlalchemy import func

    stmt = (
        select(
            Team.name.label("team_name"),
            Team.constructor_name.label("constructor"),
            func.sum(SimulationResult.expected_points).label("expected_points"),
            func.sum(SimulationResult.wdc_probability).label("wdc_share"),
        )
        .join(Driver, Driver.id == SimulationResult.driver_id)
        .join(Team, Team.id == Driver.team_id)
        .where(SimulationResult.run_id == run_id)
        .group_by(Team.id, Team.name, Team.constructor_name)
        .order_by(func.sum(SimulationResult.expected_points).desc())
    )
    result = await db.execute(stmt)
    rows = result.all()
    if not rows:
        raise HTTPException(status_code=404, detail="No results found for this run")
    return [
        {
            "team_name": r.team_name,
            "constructor": r.constructor,
            "expected_points": round(float(r.expected_points), 1),
            "wcc_probability": round(float(r.wdc_share), 4),
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
