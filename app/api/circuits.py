"""app/api/circuits.py — Circuit endpoints with Redis caching."""
from __future__ import annotations

import json
import logging
from uuid import UUID

import httpx
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select

from app.api.deps import DBSession, RedisClient
from app.models.circuit import Circuit

_log = logging.getLogger(__name__)

_SHORT_CODES: dict[str, str] = {
    "bahrain": "BHR",
    "saudi arabian": "SAU", "saudi arabia": "SAU",
    "australian": "AUS", "australia": "AUS",
    "japanese": "JPN", "japan": "JPN",
    "chinese": "CHN", "china": "CHN",
    "miami": "MIA",
    "emilia romagna": "IMO", "emilia-romagna": "IMO",
    "monaco": "MON",
    "canadian": "CAN", "canada": "CAN",
    "spanish": "ESP", "spain": "ESP",
    "austrian": "AUT", "austria": "AUT",
    "british": "GBR", "britain": "GBR",
    "hungarian": "HUN", "hungary": "HUN",
    "belgian": "BEL", "belgium": "BEL",
    "dutch": "NED", "netherlands": "NED",
    "italian": "ITA", "italy": "ITA",
    "singapore": "SGP",
    "azerbaijan": "AZE",
    "united states": "USA", "austin": "USA",
    "mexico city": "MEX", "mexico": "MEX",
    "são paulo": "BRA", "sao paulo": "BRA", "brazil": "BRA",
    "las vegas": "LAS",
    "qatar": "QAT",
    "abu dhabi": "ABU",
    "french": "FRA", "france": "FRA",
    "portuguese": "POR", "portugal": "POR",
    "turkish": "TUR", "turkey": "TUR",
    "russian": "RUS", "russia": "RUS",
    "styrian": "STY",
    "eifel": "EIF",
    "tuscan": "MUG", "tuscany": "MUG",
    "70th anniversary": "SIL",
    "imola": "IMO",
    "barcelona": "BCN",
    "brazilian": "BRA",
    "mexican": "MEX",
    "mexican city": "MEX",
    "united states": "USA",
}

router = APIRouter(prefix="/circuits", tags=["circuits"])

_CACHE_TTL        = 600     # 10 min — circuits rarely change
_RACE_RESULT_TTL  = 86_400  # 24 h  — completed race results are stable
_BULK_RESULT_TTL  = 3_600   # 1 h   — season bulk results


@router.get("/")
async def list_circuits(db: DBSession, redis: RedisClient) -> list[dict]:
    """Return all circuits (cached for 10 minutes in Redis)."""
    cache_key = "circuits:all"
    try:
        cached = await redis.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass

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
        pass

    return data


@router.get("/calendar")
async def get_season_calendar(season: int = Query(..., ge=2019, le=2030)) -> list[dict]:
    """Fetch season race calendar from Jolpica/Ergast API."""
    url = f"https://api.jolpi.ca/ergast/f1/{season}.json"
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        _log.warning("Jolpica calendar fetch failed for %s: %s", season, exc)
        raise HTTPException(status_code=502, detail=f"Could not fetch calendar: {exc}")

    races_raw = data.get("MRData", {}).get("RaceTable", {}).get("Races", [])
    result = []
    for race in races_raw:
        name = race.get("raceName", "")
        display = name.replace(" Grand Prix", "").strip()
        name_key = name.lower().replace(" grand prix", "").strip()
        short = _SHORT_CODES.get(name_key) or _SHORT_CODES.get(name.lower()) or display[:3].upper()
        result.append({
            "round": int(race.get("round", 0)),
            "name": display,
            "short": short,
            "country": race.get("Circuit", {}).get("Location", {}).get("country", ""),
            "date": race.get("date", ""),
        })
    return sorted(result, key=lambda r: r["round"])


@router.get("/race-result")
async def get_race_result(
    db: DBSession,
    redis: RedisClient,
    season: int = Query(..., ge=2018, le=2030),
    round: int = Query(..., ge=1, le=30),
) -> dict:
    """Return real race result for a specific season/round.
    Resolution order: Redis → DB → Jolpica."""
    from sqlalchemy import nulls_last
    from app.models.race_result import RaceResult
    from app.models.driver import Driver
    from app.models.team import Team

    cache_key = f"race_result:{season}:{round}"

    # 1. Redis cache
    try:
        cached = await redis.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass

    # 2. DB — join Circuit so we get the real name, not the UUID
    stmt = (
        select(RaceResult, Driver, Team, Circuit)
        .join(Driver, Driver.id == RaceResult.driver_id)
        .outerjoin(Team, Team.id == Driver.team_id)
        .join(Circuit, Circuit.id == RaceResult.circuit_id)
        .where(RaceResult.season == season, RaceResult.round == round)
        .order_by(nulls_last(RaceResult.finish_position))
        .limit(10)
    )
    rows = (await db.execute(stmt)).all()

    if rows:
        circ_name = rows[0][3].name if rows[0][3] else ""
        payload = {
            "has_result": True,
            "round": round,
            "season": season,
            "source": "db",
            "circuit_name": circ_name,
            "results": [
                {
                    "position": r.finish_position,
                    "driver_name": d.name,
                    "abbreviation": d.abbreviation or d.name.split()[-1][:3].upper(),
                    "team": t.name if t else None,
                    "points": r.points,
                }
                for r, d, t, _c in rows
                if r.finish_position is not None
            ],
        }
        try:
            await redis.setex(cache_key, _RACE_RESULT_TTL, json.dumps(payload))
        except Exception:
            pass
        return payload

    # 3. Jolpica
    url = f"https://api.jolpi.ca/ergast/f1/{season}/{round}/results.json"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        _log.warning("Jolpica race-result fetch failed %s/%s: %s", season, round, exc)
        return {"has_result": False, "round": round, "season": season, "results": []}

    races_raw = data.get("MRData", {}).get("RaceTable", {}).get("Races", [])
    if not races_raw:
        return {"has_result": False, "round": round, "season": season, "results": []}

    race = races_raw[0]
    results_raw = race.get("Results", [])
    if not results_raw:
        return {"has_result": False, "round": round, "season": season, "results": []}

    payload = {
        "has_result": True,
        "round": round,
        "season": season,
        "source": "jolpica",
        "circuit_name": race.get("raceName", "").replace(" Grand Prix", "").strip(),
        "results": [
            {
                "position": int(r.get("position", 99)),
                "driver_name": f"{r['Driver']['givenName']} {r['Driver']['familyName']}",
                "abbreviation": r["Driver"].get("code", "???"),
                "team": r["Constructor"]["name"],
                "points": float(r.get("points", 0)),
            }
            for r in results_raw[:10]
        ],
    }
    try:
        await redis.setex(cache_key, _RACE_RESULT_TTL, json.dumps(payload))
    except Exception:
        pass
    return payload


@router.get("/actual-results")
async def get_season_actual_results(
    db: DBSession,
    redis: RedisClient,
    season: int = Query(..., ge=2018, le=2030),
) -> list[dict]:
    """Return actual race results for all completed rounds.
    Resolution order: Redis → DB → Jolpica."""
    from collections import defaultdict
    from sqlalchemy import nulls_last
    from app.models.race_result import RaceResult
    from app.models.driver import Driver
    from app.models.team import Team

    cache_key = f"actual_results:{season}"

    # 1. Redis
    try:
        cached = await redis.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass

    # 2. DB — join Circuit so we get the real name, not the UUID
    stmt = (
        select(RaceResult, Driver, Team, Circuit)
        .join(Driver, Driver.id == RaceResult.driver_id)
        .outerjoin(Team, Team.id == Driver.team_id)
        .join(Circuit, Circuit.id == RaceResult.circuit_id)
        .where(RaceResult.season == season, RaceResult.finish_position <= 3)
        .order_by(RaceResult.round, nulls_last(RaceResult.finish_position))
    )
    db_rows = (await db.execute(stmt)).all()

    if db_rows:
        by_round: dict = defaultdict(list)
        for rr, drv, tm, circ in db_rows:
            by_round[rr.round].append((rr, drv, tm, circ))
        result = []
        for rnd in sorted(by_round):
            entries = sorted(by_round[rnd], key=lambda x: x[0].finish_position or 99)
            rr1, drv1, tm1, circ1 = entries[0] if entries else (None, None, None, None)
            result.append({
                "round":        rnd,
                "circuit_name": circ1.name if circ1 else "",
                "date":         str(getattr(rr1, "race_date", "")) if rr1 and getattr(rr1, "race_date", None) else "",
                "winner_name":  drv1.name if drv1 else None,
                "winner_abbr":  drv1.abbreviation if drv1 else None,
                "winner_team":  tm1.name if tm1 else None,
                "p2_abbr": entries[1][1].abbreviation if len(entries) > 1 else None,
                "p3_abbr": entries[2][1].abbreviation if len(entries) > 2 else None,
            })
        if result:
            try:
                await redis.setex(cache_key, _BULK_RESULT_TTL, json.dumps(result))
            except Exception:
                pass
            return result

    # 3. Jolpica bulk
    url = f"https://api.jolpi.ca/ergast/f1/{season}/results.json?limit=400"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        _log.warning("Jolpica results fetch failed for %s: %s", season, exc)
        return []

    races_raw = data.get("MRData", {}).get("RaceTable", {}).get("Races", [])
    result = []
    for race in races_raw:
        results = race.get("Results", [])
        if not results:
            continue

        def _get_pos(pos: int, rs=results) -> dict | None:
            for r in rs:
                try:
                    if int(r.get("position", 99)) == pos:
                        return r
                except (ValueError, TypeError):
                    pass
            return None

        p1 = _get_pos(1)
        p2 = _get_pos(2)
        p3 = _get_pos(3)
        result.append({
            "round":        int(race.get("round", 0)),
            "circuit_name": race.get("raceName", "").replace(" Grand Prix", "").strip(),
            "date":         race.get("date", ""),
            "winner_name":  f"{p1['Driver']['givenName']} {p1['Driver']['familyName']}" if p1 else None,
            "winner_abbr":  p1["Driver"].get("code") if p1 else None,
            "winner_team":  p1["Constructor"]["name"] if p1 else None,
            "p2_abbr":      p2["Driver"].get("code") if p2 else None,
            "p3_abbr":      p3["Driver"].get("code") if p3 else None,
        })

    if result:
        result.sort(key=lambda r: r["round"])
        try:
            await redis.setex(cache_key, _BULK_RESULT_TTL, json.dumps(result))
        except Exception:
            pass

    return result


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
