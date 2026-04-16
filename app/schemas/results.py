"""app/schemas/results.py — Pydantic schemas for race results and analytics."""
from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict


class RaceResultRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    driver_id: UUID
    circuit_id: UUID
    season: int
    round: int
    grid_position: int | None
    finish_position: int | None
    points: float | None
    dnf: bool
    dnf_cause: str | None
    fastest_lap: bool
    weather: str | None
    race_time_seconds: float | None


class HeadToHeadResult(BaseModel):
    driver_a_id: str
    driver_b_id: str
    driver_a_win_pct: float
    driver_b_win_pct: float
    run_id: str


class SeasonTrajectory(BaseModel):
    driver_id: str
    run_id: str
    # List of {round, mean_points, std_points} dicts
    trajectory: list[dict]
