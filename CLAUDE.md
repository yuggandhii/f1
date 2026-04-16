# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project

Python FastAPI backend that runs 10,000 Monte Carlo F1 season simulations and exposes REST + WebSocket endpoints. Stack: **FastAPI · Celery · Redis · PostgreSQL · SQLAlchemy 2.0 · NumPy · Parquet**.

Full spec in `PRD.md`. Current phase: `CURRENT_PHASE: 4 — API Layer` (update when a phase completes; checklist in PRD §9).

---

## Commands

```bash
# Start all infrastructure (postgres, redis, app, worker, beat, flower)
docker compose up -d

# Run migrations (must have postgres running)
alembic upgrade head

# Seed DB from Ergast API (defaults to 2024 season, ~30s with --skip-fastf1)
python scripts/seed_db.py --skip-fastf1
python scripts/seed_db.py --verify-only        # check row counts without seeding

# Start API server locally (outside Docker, requires .env or env vars)
uvicorn app.main:app --reload --port 8000

# Run Celery worker locally
celery -A app.worker worker --loglevel=info --queues=simulations,ingestion,default

# Run all tests
pytest

# Run a single test file / test
pytest tests/unit/test_scoring.py
pytest tests/unit/test_scoring.py::test_fastest_lap_bonus -v

# Backtest (validates Verstappen 2023 WDC prob > 85%)
python scripts/run_backtest.py --n 100 --season 2023

# Lint + type-check
ruff check app/ && mypy app/
```

---

## Architecture

### Layer boundaries (strict — do not cross)

```
ingestion/   → external I/O only: Ergast API, FastF1, writes to DB + parquet cache
simulation/  → pure NumPy computation, zero DB or I/O calls
analytics/   → reads parquet/DB, aggregates; no external calls
api/         → HTTP/WS only; delegates to simulation/ and analytics/
```

DB access from API routes goes **only** through `app/api/deps.py` session injection (`DBSession` type alias). Never instantiate sessions in route functions directly.

FastF1 is **synchronous** — only call it from Celery tasks (`ingestion/tasks.py`), never from async route handlers.

### Request → response flow for a simulation

1. `POST /api/v1/simulations` creates a `SimulationRun` row (status=`pending`) and dispatches `f1sim.simulation.run_season` Celery task.
2. The Celery task loads `DriverRating` objects from DB, calls `simulation/season_simulator.py`, writes parquet to `data/simulations/{run_id}/results.parquet`, persists aggregated stats to `simulation_results` table, sets status=`done`.
3. `GET /api/v1/simulations/{run_id}/driver-probabilities` reads from `simulation_results` table.
4. WebSocket `/ws/simulations/{run_id}/progress` streams progress from Redis pub/sub while the task runs.

### Celery task naming

All tasks: `f1sim.{module}.{verb}` — e.g. `f1sim.ingestion.fetch_season`, `f1sim.simulation.run_season`.

Celery tasks use `SyncSessionLocal` (psycopg2-backed) from `app/database.py`, not the async session.

---

## Key data shapes

```python
# Simulation I/O (season_simulator.py)
all_points: np.ndarray   # (n_sims, n_drivers) float32 — total season points
driver_order: list[str]  # driver_ids matching axis=1 of all_points

# Parquet paths
data/simulations/{run_id}/results.parquet   # raw all_points matrix
data/simulations/{run_id}/metadata.json     # {driver_order, params}

# Ergast cache
data/cache/{season}/ergast_races.parquet
data/cache/{season}/ergast_results.parquet
data/cache/{season}/ergast_qualifying.parquet
data/fastf1_cache/                          # FastF1 native session cache

# Points system (scoring.py)
POINTS_MAP = {1:25, 2:18, 3:15, 4:12, 5:10, 6:8, 7:6, 8:4, 9:2, 10:1}
FASTEST_LAP_BONUS = 1   # only if driver finishes in top 10
SPRINT_POINTS = {1:8, 2:7, 3:6, 4:5, 5:4, 6:3, 7:2, 8:1}
```

### DriverRating dataclass (performance_model.py)

Two `DriverRating` dataclasses exist — do not confuse them:
- `app/simulation/performance_model.py` — used by the simulator (no `season` field)
- `app/ingestion/transformers.py` — has a `season` field, used during DB ingestion

All float fields are normalised `[0, 1]`. `dnf_rate` lower is better.

### Performance model calibration

Raw min-max-normalised ratings span `[0, 1]` across all drivers. The simulator compresses pace to `[0.5, 1.0]` via `_COMPETITIVE_FLOOR = 0.5` in `performance_model.py` so the signal-to-noise ratio stays realistic. Without this, the top driver wins every race deterministically. Do not remove this compression.

---

## Database

Seven tables (see PRD §5 and `alembic/versions/0001_initial_schema.py`):
`teams` → `drivers` → `driver_ratings`, `race_results`, `circuits`, `simulation_runs` → `simulation_results`

All primary keys are `UUID(as_uuid=True)` — never use plain `String` for UUID columns.

The async engine (`AsyncSessionLocal`) is for FastAPI routes. The sync engine (`SyncSessionLocal`, psycopg2) is for Celery tasks. Both are in `app/database.py`.

---

## Gotchas

- **FastF1 cache**: always call `fastf1.Cache.enable_cache('data/fastf1_cache')` before any session fetch — the lifespan in `app/main.py` does this on startup, but scripts must do it manually.
- **Ergast rate limit**: 4 req/s — `ergast_client.py` sleeps 0.25 s between calls. The 2023 parquet cache is partial (12 of 22 rounds) because the prior-season fetch paginates only 240 results.
- **NumPy indexing**: `argsort` returns 0-indexed positions; F1 positions are 1-indexed — add 1 before passing to `award_race_points`.
- **RNG safety**: use `np.random.default_rng(seed)` per batch, not the global `np.random` (not thread-safe under multiprocessing).
- **Celery + async**: never `await` inside a Celery task — use `SyncSessionLocal` and sync SQLAlchemy only.

---

## Code review graph

Before writing any new file or editing existing code, produce this one-liner:

```
# READS: [files this depends on]  WRITES: [files this changes]  TOUCHES: [shared state/tables]
```

---

## Tests

```
tests/conftest.py          shared fixtures — async engine, db_session, ASGI client
tests/unit/                pure function tests (no DB, no network)
tests/integration/         tests that require postgres (use TEST_DATABASE_URL env var)
```

Override the test database:
```bash
DATABASE_URL=postgresql+asyncpg://f1user:f1pass@localhost:5432/f1sim_test pytest
```

`pytest.ini_options` in `pyproject.toml` sets `asyncio_mode = "auto"` — all async fixtures work without explicit `@pytest.mark.asyncio`.
