"""app/api/circuits.py — Circuit endpoints with Redis caching."""
from __future__ import annotations

import json
from uuid import UUID

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.api.deps import DBSession, RedisClient
from app.models.circuit import Circuit

router = APIRouter(prefix="/circuits", tags=["circuits"])

_CACHE_TTL = 600  # 10 minutes (circuits rarely change)


@router.get("/")
async def list_circuits(db: DBSession, redis: RedisClient) -> list[dict]:
    """Return all circuits (cached for 10 minutes in Redis)."""
    cache_key = "circuits:all"
    try:
        cached = await redis.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass  # Redis unavailable — fall through to DB

    result = await db.execute(select(Circuit).order_by(Circuit.name))
    circuits = result.scalars().all()
    data = [
        {
            "id": str(c.id),
            "name": c.name,
            "country": c.country,
            "track_type": c.track_type,
            "lap_count": c.lap_count,
            "overtake_difficulty": c.overtake_difficulty,
            "weather_variability": c.weather_variability,
        }
        for c in circuits
    ]

    try:
        await redis.setex(cache_key, _CACHE_TTL, json.dumps(data))
    except Exception:
        pass  # Non-fatal

    return data


@router.get("/{circuit_id}")
async def get_circuit(circuit_id: UUID, db: DBSession) -> dict:
    circuit = await db.get(Circuit, circuit_id)
    if circuit is None:
        raise HTTPException(status_code=404, detail="Circuit not found")
    return {
        "id": str(circuit.id),
        "name": circuit.name,
        "country": circuit.country,
        "track_type": circuit.track_type,
        "lap_count": circuit.lap_count,
        "overtake_difficulty": circuit.overtake_difficulty,
        "weather_variability": circuit.weather_variability,
    }
