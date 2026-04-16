"""app/schemas/driver.py — Pydantic I/O schemas for drivers."""
from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict


class DriverBase(BaseModel):
    name: str
    abbreviation: str | None = None
    team_id: UUID | None = None
    nationality: str | None = None
    active: bool = True


class DriverCreate(DriverBase):
    pass


class DriverRead(DriverBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID


class DriverRatingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    driver_id: UUID
    season: int
    base_pace: float | None
    consistency: float | None
    wet_skill: float | None
    tyre_management: float | None
    overtake_skill: float | None
    dnf_rate: float | None
    qualifying_edge: float | None


class DriverWithRating(DriverRead):
    rating: DriverRatingRead | None = None
