"""app/api/scenarios.py — What-if scenario endpoints (Phase 5)."""
from __future__ import annotations

import logging
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.api.deps import DBSession
from app.analytics.what_if import SCENARIO_TEMPLATES, describe_scenario, validate_scenario

_log = logging.getLogger(__name__)

router = APIRouter(prefix="/scenarios", tags=["scenarios"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ScenarioRequest(BaseModel):
    season: int = Field(..., ge=2018, le=2030)
    n_sims: int = Field(default=1_000, ge=100, le=50_000)
    randomness_factor: float = Field(default=0.15, ge=0.0, le=1.0)
    scenario: dict[str, Any] = Field(..., description="Scenario dict with 'type' key")
    base_run_id: str | None = Field(default=None, description="Optional base run for comparison")


class NLPParseRequest(BaseModel):
    prompt: str = Field(..., min_length=5, max_length=500)
    season: int = Field(default=2024, ge=2018, le=2030)


# ---------------------------------------------------------------------------
# POST /scenarios/what-if — enqueue a scenario simulation
# ---------------------------------------------------------------------------

@router.post("/what-if", status_code=202)
async def what_if(body: ScenarioRequest, db: DBSession) -> dict:
    """
    Validate and enqueue a what-if scenario simulation.

    Returns a run_id immediately. Poll GET /simulations/{run_id} for status
    or stream progress via WebSocket /ws/simulations/{run_id}/progress.
    """
    from app.models.simulation_run import SimulationRun

    errors = validate_scenario(body.scenario)
    if errors:
        raise HTTPException(status_code=422, detail={"errors": errors})

    run = SimulationRun(
        id=uuid.uuid4(),
        season=body.season,
        n_simulations=body.n_sims,
        randomness_factor=body.randomness_factor,
        scenario={
            "type": body.scenario.get("type"),
            "base_run_id": body.base_run_id,
            "scenario": body.scenario,
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
        "season": body.season,
        "scenario_type": body.scenario.get("type"),
        "description": describe_scenario(body.scenario),
        "base_run_id": body.base_run_id,
    }


# ---------------------------------------------------------------------------
# POST /scenarios/parse-nlp — natural language → scenario dict
# ---------------------------------------------------------------------------

@router.post("/parse-nlp")
async def parse_nlp(body: NLPParseRequest) -> dict:
    """
    Parse a natural-language prompt into a structured scenario dict.

    Uses Ollama (gemma3 → gemma2 → mistral) with regex fallback.
    Does NOT enqueue a simulation — returns the parsed scenario for preview.
    """
    from app.analytics.nlp_scenario_parser import parse_scenario_nlp

    parsed = await parse_scenario_nlp(body.prompt)

    errors = validate_scenario(parsed)
    return {
        "prompt": body.prompt,
        "season": body.season,
        "parsed_scenario": parsed,
        "description": describe_scenario(parsed),
        "valid": len(errors) == 0,
        "validation_errors": errors,
    }


# ---------------------------------------------------------------------------
# GET /scenarios/compare — diff two simulation runs
# ---------------------------------------------------------------------------

@router.get("/compare")
async def compare_runs(
    base_run_id: str = Query(..., description="ID of the baseline simulation run"),
    scenario_run_id: str = Query(..., description="ID of the scenario simulation run"),
    db: DBSession = None,
) -> dict:
    """
    Compare WDC probabilities between a base run and a scenario run.

    Returns per-driver delta (scenario_prob − base_prob).
    """
    from sqlalchemy import select
    from app.models.simulation_run import SimulationResult, SimulationRun
    from app.models.driver import Driver

    async def _load_probs(run_id: str) -> dict[str, float]:
        run_uuid = uuid.UUID(run_id)
        run = await db.get(SimulationRun, run_uuid)
        if run is None:
            raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
        if run.status != "done":
            raise HTTPException(
                status_code=409,
                detail=f"Run {run_id} is {run.status}, not done",
            )
        rows = (
            await db.execute(
                select(SimulationResult, Driver)
                .join(Driver, SimulationResult.driver_id == Driver.id)
                .where(SimulationResult.run_id == run_uuid)
            )
        ).fetchall()
        return {d.name: r.wdc_probability for r, d in rows}

    base_probs = await _load_probs(base_run_id)
    scen_probs = await _load_probs(scenario_run_id)

    all_drivers = sorted(set(base_probs) | set(scen_probs))
    deltas = []
    for driver in all_drivers:
        base = base_probs.get(driver, 0.0)
        scen = scen_probs.get(driver, 0.0)
        deltas.append({
            "driver": driver,
            "base_wdc_prob": round(base, 4),
            "scenario_wdc_prob": round(scen, 4),
            "delta": round(scen - base, 4),
        })

    deltas.sort(key=lambda x: x["delta"], reverse=True)
    return {
        "base_run_id": base_run_id,
        "scenario_run_id": scenario_run_id,
        "drivers": deltas,
    }


# ---------------------------------------------------------------------------
# GET /scenarios/templates — list available scenario templates
# ---------------------------------------------------------------------------

@router.get("/templates")
async def list_templates() -> dict:
    """Return all available scenario type templates with example params."""
    return {
        "templates": SCENARIO_TEMPLATES,
        "count": len(SCENARIO_TEMPLATES),
    }


# ---------------------------------------------------------------------------
# GET /scenarios/current-standings — live WDC standings from DB
# ---------------------------------------------------------------------------

@router.get("/current-standings")
async def current_standings(
    season: int = Query(..., ge=2018, le=2030),
    db: DBSession = None,
) -> dict:
    """
    Return the latest race results standings for a season.

    Useful for building a REMAINING_SEASON scenario payload — pass
    the returned 'standings' dict as 'current_standings' in the scenario.
    """
    from sqlalchemy import text

    rows = await db.execute(
        text("""
            SELECT
                rr.driver_id,
                d.name          AS driver_name,
                rr.constructor_id,
                MAX(rr.round)   AS latest_round,
                SUM(rr.points)  AS total_points
            FROM race_results rr
            JOIN drivers d ON d.id = rr.driver_id
            WHERE rr.season = :season
            GROUP BY rr.driver_id, d.name, rr.constructor_id
            ORDER BY total_points DESC
        """),
        {"season": season},
    )
    data = rows.fetchall()

    if not data:
        raise HTTPException(
            status_code=404,
            detail=f"No race results for season {season}",
        )

    latest_round = max(row.latest_round for row in data) if data else 0
    standings_dict = {
        row.driver_name.lower().replace(" ", "_"): float(row.total_points)
        for row in data
    }

    return {
        "season": season,
        "latest_round": latest_round,
        "standings": standings_dict,
        "drivers": [
            {
                "driver_id": row.driver_name.lower().replace(" ", "_"),
                "driver_name": row.driver_name,
                "constructor": row.constructor_id,
                "points": float(row.total_points),
                "latest_round": row.latest_round,
            }
            for row in data
        ],
    }
