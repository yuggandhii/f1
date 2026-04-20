"""
app/main.py — FastAPI application factory + lifespan.

The lifespan context manager handles:
  - DB connectivity check on startup
  - FastF1 cache initialisation
  - Clean engine dispose on shutdown

Routers are registered here; actual logic lives in app/api/*.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

import fastf1
import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import close_db, init_db

logger = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # ── Startup ──────────────────────────────────────────────────────────
    log = structlog.get_logger("startup")

    # Ensure data directories exist
    for path in [
        settings.f1_cache_dir,
        settings.simulations_dir,
        settings.cache_dir,
    ]:
        Path(path).mkdir(parents=True, exist_ok=True)

    # Initialise FastF1 disk cache
    fastf1.Cache.enable_cache(str(settings.f1_cache_dir))
    log.info("fastf1_cache_enabled", path=str(settings.f1_cache_dir))

    # Verify DB connection
    await init_db()
    log.info("database_connected", url=settings.database_url.split("@")[-1])

    yield

    # ── Shutdown ─────────────────────────────────────────────────────────
    await close_db()
    log.info("database_disconnected")


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------
def create_app() -> FastAPI:
    application = FastAPI(
        title="F1 Monte Carlo Simulator",
        description=(
            "Probabilistic F1 championship simulator powered by "
            "FastF1 + Ergast data and 10,000 Monte Carlo iterations."
        ),
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    # ── CORS ─────────────────────────────────────────────────────────────
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Routers ──────────────────────────────────────────────────────────
    # Imported lazily so partial implementations don't break startup
    from app.api.drivers import router as drivers_router
    from app.api.circuits import router as circuits_router
    from app.api.simulations import router as simulations_router
    from app.api.scenarios import router as scenarios_router
    from app.api.analytics import router as analytics_router
    from app.api.ws import router as ws_router
    from app.api.game import router as game_router

    PREFIX = "/api/v1"
    application.include_router(drivers_router, prefix=PREFIX)
    application.include_router(circuits_router, prefix=PREFIX)
    application.include_router(simulations_router, prefix=PREFIX)
    application.include_router(scenarios_router, prefix=PREFIX)
    application.include_router(analytics_router, prefix=PREFIX)
    application.include_router(ws_router, prefix=PREFIX)
    application.include_router(game_router, prefix=PREFIX)

    # ── Health check ─────────────────────────────────────────────────────
    @application.get("/health", tags=["meta"])
    async def health() -> JSONResponse:
        return JSONResponse({"status": "ok", "version": "0.1.0"})

    return application


# Module-level app instance (used by uvicorn and tests)
app: FastAPI = create_app()
