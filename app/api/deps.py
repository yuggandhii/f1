"""
app/api/deps.py — FastAPI dependency injectors.

All database sessions and shared dependencies flow through here.
Never instantiate sessions directly in router functions.
"""
from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Annotated

import redis.asyncio as aioredis
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_session

# ---------------------------------------------------------------------------
# DB session dependency
# ---------------------------------------------------------------------------
async def _get_db() -> AsyncGenerator[AsyncSession, None]:
    async for session in get_session():
        yield session


DBSession = Annotated[AsyncSession, Depends(_get_db)]


# ---------------------------------------------------------------------------
# Redis dependency (shared pool, one connection per request)
# ---------------------------------------------------------------------------
_redis_client: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=2,
        )
    return _redis_client


RedisClient = Annotated[aioredis.Redis, Depends(get_redis)]
