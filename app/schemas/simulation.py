"""app/schemas/simulation.py — Pydantic schemas for simulation jobs."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SimulationRunCreate(BaseModel):
    season: int = Field(..., ge=2018, le=2030)
    n_sims: int = Field(default=10_000, ge=100, le=50_000)
    randomness_factor: float = Field(default=0.15, ge=0.0, le=1.0)
    scenario: dict | None = None


class SimulationRunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    season: int
    n_simulations: int
    randomness_factor: float
    scenario: dict | None
    status: str
    started_at: datetime | None
    completed_at: datetime | None
    result_path: str | None


class SimulationResultRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    run_id: UUID
    driver_id: UUID
    wdc_probability: float | None
    expected_points: float | None
    points_std: float | None
    p1_count: int | None
    podium_rate: float | None
    dnf_rate_simulated: float | None
    per_race_win_probs: dict | None
