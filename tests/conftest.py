"""tests/conftest.py — shared pytest fixtures."""
from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.database import Base
from app.main import app

# ---------------------------------------------------------------------------
# Test DB — use a separate in-memory or test database
# Override DATABASE_URL via env before running tests:
#   DATABASE_URL=postgresql+asyncpg://f1user:f1pass@localhost:5432/f1sim_test pytest
# ---------------------------------------------------------------------------
TEST_DATABASE_URL = "postgresql+asyncpg://f1user:f1pass@localhost:5432/f1sim_test"


@pytest_asyncio.fixture(scope="session")
async def engine():
    _engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield _engine
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await _engine.dispose()


@pytest_asyncio.fixture
async def db_session(engine):
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
