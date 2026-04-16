"""
app/database.py — Async SQLAlchemy engine and session factory.

Usage inside FastAPI routes (via deps.py):
    async with get_session() as session:
        result = await session.execute(select(Driver))

Usage inside Celery tasks (sync context):
    Use SyncSessionLocal — see note at the bottom.
"""
from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Any

from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase, MappedColumn
from sqlalchemy.pool import NullPool

from app.config import settings


# ---------------------------------------------------------------------------
# Declarative base — all ORM models inherit from this
# ---------------------------------------------------------------------------
class Base(DeclarativeBase):
    """Shared declarative base for all SQLAlchemy models."""
    pass


# ---------------------------------------------------------------------------
# Async engine
# ---------------------------------------------------------------------------
def _build_engine(url: str, **kwargs: Any) -> AsyncEngine:
    """Create the async engine.  NullPool is used in test env to avoid
    connection pool issues with pytest-asyncio's event loop."""
    pool_class = NullPool if settings.app_env == "testing" else None
    engine_kwargs: dict[str, Any] = {
        "echo": not settings.is_production,
        "pool_pre_ping": True,
    }
    if pool_class is not None:
        engine_kwargs["poolclass"] = pool_class
    engine_kwargs.update(kwargs)
    return create_async_engine(url, **engine_kwargs)


engine: AsyncEngine = _build_engine(settings.database_url)

# ---------------------------------------------------------------------------
# Session factory
# ---------------------------------------------------------------------------
AsyncSessionLocal: async_sessionmaker[AsyncSession] = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


# ---------------------------------------------------------------------------
# Context-manager helper used in deps.py
# ---------------------------------------------------------------------------
async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async session; commit on success, rollback on error."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# ---------------------------------------------------------------------------
# Startup / shutdown helpers called from app lifespan
# ---------------------------------------------------------------------------
async def init_db() -> None:
    """Verify DB connectivity on startup (does NOT create tables — use Alembic)."""
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))


async def close_db() -> None:
    """Dispose connection pool on shutdown."""
    await engine.dispose()


# ---------------------------------------------------------------------------
# Sync engine + session — for Celery tasks (psycopg2 driver)
# ---------------------------------------------------------------------------
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import Session, sessionmaker  # noqa: E402


def _sync_database_url(async_url: str) -> str:
    """Convert async DSN (asyncpg) to sync DSN (psycopg2)."""
    return async_url.replace("+asyncpg", "+psycopg2")


sync_engine = create_engine(
    _sync_database_url(settings.database_url),
    pool_pre_ping=True,
    echo=not settings.is_production,
    pool_size=5,
    max_overflow=10,
)

SyncSessionLocal: sessionmaker[Session] = sessionmaker(
    bind=sync_engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)
