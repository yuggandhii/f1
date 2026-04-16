"""app/api/drivers.py — Driver endpoints with Redis caching."""
from __future__ import annotations

import json
from uuid import UUID

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.api.deps import DBSession, RedisClient
from app.models.driver import Driver

router = APIRouter(prefix="/drivers", tags=["drivers"])

_CACHE_TTL = 300  # 5 minutes


@router.get("/")
async def list_drivers(db: DBSession, redis: RedisClient) -> list[dict]:
    """Return all active drivers (cached for 5 minutes in Redis)."""
    cache_key = "drivers:all"
    try:
        cached = await redis.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass  # Redis unavailable — fall through to DB

    result = await db.execute(select(Driver).where(Driver.active.is_(True)))
    drivers = result.scalars().all()
    data = [
        {
            "id": str(d.id),
            "name": d.name,
            "abbreviation": d.abbreviation,
            "team_id": str(d.team_id) if d.team_id else None,
            "nationality": d.nationality,
        }
        for d in drivers
    ]

    try:
        await redis.setex(cache_key, _CACHE_TTL, json.dumps(data))
    except Exception:
        pass  # Non-fatal — just skip caching

    return data


@router.get("/{driver_id}")
async def get_driver(driver_id: UUID, db: DBSession) -> dict:
    """Return a single driver by ID."""
    driver = await db.get(Driver, driver_id)
    if driver is None:
        raise HTTPException(status_code=404, detail="Driver not found")
    return {
        "id": str(driver.id),
        "name": driver.name,
        "abbreviation": driver.abbreviation,
        "team_id": str(driver.team_id) if driver.team_id else None,
        "nationality": driver.nationality,
        "active": driver.active,
    }


@router.get("/{driver_id}/history")
async def get_driver_history(driver_id: UUID, db: DBSession) -> list[dict]:
    """Return historical race results for a driver."""
    from app.models.race_result import RaceResult
    result = await db.execute(
        select(RaceResult)
        .where(RaceResult.driver_id == driver_id)
        .order_by(RaceResult.season.desc(), RaceResult.round.desc())
    )
    rows = result.scalars().all()
    return [
        {
            "id": str(r.id),
            "season": r.season,
            "round": r.round,
            "circuit_id": str(r.circuit_id),
            "grid_position": r.grid_position,
            "finish_position": r.finish_position,
            "points": r.points,
            "dnf": r.dnf,
            "weather": r.weather,
        }
        for r in rows
    ]
