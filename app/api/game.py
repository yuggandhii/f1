"""app/api/game.py — F1 Predictor Game endpoints.

Completely independent of all other API routes and tables.
Uses only the game_picks table.

Routes:
    GET  /api/v1/game/next-race   — Fetch next F1 race from Ergast open API
    POST /api/v1/game/picks       — Save a player's locked picks
    GET  /api/v1/game/picks       — Get all picks for a race (leaderboard)
"""
from __future__ import annotations

import uuid
import logging
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.api.deps import DBSession

_log = logging.getLogger(__name__)

router = APIRouter(prefix="/game", tags=["game"])

# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class PickSubmit(BaseModel):
    player_name: str = Field(..., min_length=1, max_length=80)
    race_name: str = Field(..., min_length=1, max_length=120)
    season: int = Field(..., ge=2024, le=2030)
    round: int = Field(..., ge=1, le=30)
    pick_1: str = Field(..., min_length=2, max_length=6)
    pick_2: str = Field(..., min_length=2, max_length=6)
    pick_3: str = Field(..., min_length=2, max_length=6)
    pick_4: str = Field(..., min_length=2, max_length=6)
    pick_5: str = Field(..., min_length=2, max_length=6)


# ---------------------------------------------------------------------------
# GET /game/next-race
# ---------------------------------------------------------------------------

@router.get("/next-race")
async def get_next_race() -> dict[str, Any]:
    """
    Fetch the next upcoming F1 race from the Ergast/Jolpica open API.
    Returns race name, round, circuit, date, and days_until countdown.
    Falls back to a static Miami GP entry if the API is unreachable.
    """
    # Try Jolpica first (ergast successor), then legacy ergast
    urls = [
        "https://api.jolpi.ca/ergast/f1/current/next.json",
        "https://ergast.com/api/f1/current/next.json",
    ]

    race_data: dict[str, Any] | None = None

    async with httpx.AsyncClient(timeout=8.0) as client:
        for url in urls:
            try:
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    races = (
                        data.get("MRData", {})
                        .get("RaceTable", {})
                        .get("Races", [])
                    )
                    if races:
                        race_data = races[0]
                        break
            except Exception as exc:
                _log.warning("Ergast API call failed (%s): %s", url, exc)

    if race_data is None:
        # Static fallback — Miami GP 2026 around May 4-5
        return {
            "race_name": "Miami Grand Prix",
            "circuit": "Miami International Autodrome",
            "locality": "Miami",
            "country": "USA",
            "season": 2026,
            "round": 6,
            "date": "2026-05-04",
            "time": "20:00:00Z",
            "days_until": None,
            "source": "fallback",
        }

    # Parse date + compute countdown
    race_date_str = race_data.get("date", "")
    race_time_str = race_data.get("time", "00:00:00Z")
    days_until: int | None = None

    try:
        # Combine date + time for accurate countdown
        dt_str = f"{race_date_str}T{race_time_str.rstrip('Z')}+00:00"
        race_dt = datetime.fromisoformat(dt_str)
        now = datetime.now(timezone.utc)
        delta = race_dt - now
        days_until = max(0, delta.days)
    except Exception:
        days_until = None

    circuit = race_data.get("Circuit", {})

    return {
        "race_name": race_data.get("raceName", "Unknown GP"),
        "circuit": circuit.get("circuitName", "Unknown Circuit"),
        "locality": circuit.get("Location", {}).get("locality", ""),
        "country": circuit.get("Location", {}).get("country", ""),
        "season": int(race_data.get("season", 2026)),
        "round": int(race_data.get("round", 1)),
        "date": race_date_str,
        "time": race_time_str,
        "days_until": days_until,
        "source": "ergast",
    }


# ---------------------------------------------------------------------------
# POST /game/picks
# ---------------------------------------------------------------------------

@router.post("/picks", status_code=201)
async def submit_picks(body: PickSubmit, db: DBSession) -> dict[str, Any]:
    """Save a player's locked race picks to the game_picks table."""
    from app.models.game_pick import GamePick

    pick = GamePick(
        id=uuid.uuid4(),
        player_name=body.player_name.strip(),
        race_name=body.race_name,
        season=body.season,
        round=body.round,
        pick_1=body.pick_1.upper(),
        pick_2=body.pick_2.upper(),
        pick_3=body.pick_3.upper(),
        pick_4=body.pick_4.upper(),
        pick_5=body.pick_5.upper(),
        score=None,
    )
    db.add(pick)
    await db.flush()

    return {
        "id": str(pick.id),
        "player_name": pick.player_name,
        "race_name": pick.race_name,
        "picks": [pick.pick_1, pick.pick_2, pick.pick_3, pick.pick_4, pick.pick_5],
        "status": "saved",
    }


# ---------------------------------------------------------------------------
# GET /game/picks
# ---------------------------------------------------------------------------

@router.get("/picks")
async def get_picks(
    race_name: str = Query(..., description="Exact race name to filter by"),
    db: DBSession = None,
) -> dict[str, Any]:
    """Return all picks for a given race name (for the leaderboard panel)."""
    from sqlalchemy import select
    from app.models.game_pick import GamePick

    rows = (
        await db.execute(
            select(GamePick)
            .where(GamePick.race_name == race_name)
            .order_by(GamePick.created_at.asc())
        )
    ).scalars().all()

    picks_list = []
    for row in rows:
        picks_list.append({
            "id": str(row.id),
            "player_name": row.player_name,
            "picks": [row.pick_1, row.pick_2, row.pick_3, row.pick_4, row.pick_5],
            "score": row.score,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        })

    return {
        "race_name": race_name,
        "total": len(picks_list),
        "picks": picks_list,
    }
