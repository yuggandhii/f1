# Graph Report - .  (2026-04-16)

## Corpus Check
- Corpus is ~13,402 words - fits in a single context window. You may not need a graph.

## Summary
- 275 nodes · 460 edges · 29 communities detected
- Extraction: 64% EXTRACTED · 36% INFERRED · 0% AMBIGUOUS · INFERRED: 164 edges (avg confidence: 0.56)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_ORM Models & DB Layer|ORM Models & DB Layer]]
- [[_COMMUNITY_Data Ingestion Pipeline|Data Ingestion Pipeline]]
- [[_COMMUNITY_API Routers & Schemas|API Routers & Schemas]]
- [[_COMMUNITY_Pydantic Schemas & Endpoints|Pydantic Schemas & Endpoints]]
- [[_COMMUNITY_Architecture Docs & Config Rules|Architecture Docs & Config Rules]]
- [[_COMMUNITY_Driver Rating Transformers|Driver Rating Transformers]]
- [[_COMMUNITY_FastAPI App & Database Session|FastAPI App & Database Session]]
- [[_COMMUNITY_Simulation Spec & Data Shapes|Simulation Spec & Data Shapes]]
- [[_COMMUNITY_App Config & Settings|App Config & Settings]]
- [[_COMMUNITY_Alembic Migrations|Alembic Migrations]]
- [[_COMMUNITY_Analytics Endpoints|Analytics Endpoints]]
- [[_COMMUNITY_Test Fixtures & Conftest|Test Fixtures & Conftest]]
- [[_COMMUNITY_DB Migration (Initial Schema)|DB Migration (Initial Schema)]]
- [[_COMMUNITY_Circuit API Endpoints|Circuit API Endpoints]]
- [[_COMMUNITY_WebSocket Progress Endpoint|WebSocket Progress Endpoint]]
- [[_COMMUNITY_Celery Simulation Tasks|Celery Simulation Tasks]]
- [[_COMMUNITY_Backtest & Validation Scripts|Backtest & Validation Scripts]]
- [[_COMMUNITY_Celery Worker Instance|Celery Worker Instance]]
- [[_COMMUNITY_CORS Config|CORS Config]]
- [[_COMMUNITY_Module Init (Simulation)|Module Init (Simulation)]]
- [[_COMMUNITY_Module Init (Analytics)|Module Init (Analytics)]]
- [[_COMMUNITY_Module Init (API)|Module Init (API)]]
- [[_COMMUNITY_Module Init (Models)|Module Init (Models)]]
- [[_COMMUNITY_Module Init (Schemas)|Module Init (Schemas)]]
- [[_COMMUNITY_Module Init (Ingestion)|Module Init (Ingestion)]]
- [[_COMMUNITY_Module Init (App)|Module Init (App)]]
- [[_COMMUNITY_Module Init (Tests)|Module Init (Tests)]]
- [[_COMMUNITY_Module Init (Scripts)|Module Init (Scripts)]]
- [[_COMMUNITY_Module Init (Alembic)|Module Init (Alembic)]]

## God Nodes (most connected - your core abstractions)
1. `Driver` - 27 edges
2. `RaceResult` - 27 edges
3. `Circuit` - 24 edges
4. `Team` - 23 edges
5. `DriverRating` - 21 edges
6. `Base` - 20 edges
7. `fetch_season()` - 12 edges
8. `compute_driver_ratings()` - 12 edges
9. `SimulationRun` - 12 edges
10. `SimulationResult` - 12 edges

## Surprising Connections (you probably didn't know these)
- `alembic/env.py — Alembic migration environment.  Uses async SQLAlchemy so migrat` --uses--> `Base`  [INFERRED]
  alembic\env.py → app\database.py
- `Create async engine and run migrations within an async context.` --uses--> `Base`  [INFERRED]
  alembic\env.py → app\database.py
- `tests/conftest.py — shared pytest fixtures.` --uses--> `Base`  [INFERRED]
  tests\conftest.py → app\database.py
- `app/api/circuits.py — Circuit endpoints.` --uses--> `Circuit`  [INFERRED]
  app\api\circuits.py → app\models\circuit.py
- `Circuit` --uses--> `Base`  [INFERRED]
  app\models\circuit.py → app\database.py

## Hyperedges (group relationships)
- **Monte Carlo Simulation Pipeline** — prd_ergast_client, prd_fastf1_client, prd_transformers, prd_driver_rating, prd_performance_model, prd_race_simulator, prd_season_simulator, prd_output_aggregation [EXTRACTED 0.95]
- **PostgreSQL Database Schema** — prd_db_schema_drivers, prd_db_schema_teams, prd_db_schema_circuits, prd_db_schema_race_results, prd_db_schema_driver_ratings, prd_db_schema_simulation_runs, prd_db_schema_simulation_results [EXTRACTED 1.00]
- **FastAPI REST + WebSocket Layer** — prd_fastapi_app, prd_websocket, prd_what_if, prd_aggregator [INFERRED 0.85]

## Communities

### Community 0 - "ORM Models & DB Layer"
Cohesion: 0.13
Nodes (38): Base, Circuit, Driver, DriverRating, get_driver(), get_driver_history(), list_drivers(), app/api/drivers.py — Driver endpoints (Phase 4 full impl; Phase 0 stub). (+30 more)

### Community 1 - "Data Ingestion Pipeline"
Cohesion: 0.1
Nodes (33): _cache_dir(), _classify_dnf(), fetch_season_qualifying(), fetch_season_races(), fetch_season_results(), _get_json(), _paginate(), app/ingestion/ergast_client.py — Synchronous Ergast/Jolpica API client.  Fetches (+25 more)

### Community 2 - "API Routers & Schemas"
Cohesion: 0.11
Nodes (20): app/models/circuit.py — Circuit / track ORM model., Base, Shared declarative base for all SQLAlchemy models., DeclarativeBase, app/models/driver_rating.py — Derived driver performance ratings ORM model., app/models/race_result.py — Historical race result ORM model., app/models/simulation_run.py — Simulation run + aggregated results ORM models., Aggregated per-driver result for a given simulation run (not raw parquet rows). (+12 more)

### Community 3 - "Pydantic Schemas & Endpoints"
Cohesion: 0.11
Nodes (19): BaseModel, DriverBase, DriverCreate, DriverRatingRead, DriverRead, DriverWithRating, app/schemas/driver.py — Pydantic I/O schemas for drivers., HeadToHeadResult (+11 more)

### Community 4 - "Architecture Docs & Config Rules"
Cohesion: 0.1
Nodes (22): Architecture Separation of Concerns, Celery Task Naming Convention, Known Gotchas & Pitfalls, Celery Task Queue, DB Table: circuits, DB Table: driver_ratings, DB Table: drivers, DB Table: race_results (+14 more)

### Community 5 - "Driver Rating Transformers"
Cohesion: 0.15
Nodes (19): _compute_base_pace(), _compute_consistency(), _compute_dnf_rate(), compute_driver_ratings(), _compute_overtake_skill(), _compute_qualifying_edge(), _compute_tyre_management(), _compute_wet_skill() (+11 more)

### Community 6 - "FastAPI App & Database Session"
Cohesion: 0.11
Nodes (15): _build_engine(), close_db(), get_session(), init_db(), app/database.py — Async SQLAlchemy engine and session factory.  Usage inside Fas, Convert async DSN (asyncpg) to sync DSN (psycopg2)., Create the async engine.  NullPool is used in test env to avoid     connection p, Yield an async session; commit on success, rollback on error. (+7 more)

### Community 7 - "Simulation Spec & Data Shapes"
Cohesion: 0.12
Nodes (17): Key Data Shapes Specification, Parquet File Path Convention, Analytics Aggregator, DriverRating Dataclass, Driver Rating Formula, Output Aggregation (WDC Probability), ProcessPoolExecutor Parallelism, Parquet Cache (Simulation Output) (+9 more)

### Community 8 - "App Config & Settings"
Cohesion: 0.2
Nodes (5): BaseSettings, get_settings(), app/config.py — Pydantic settings loaded from environment / .env file.  All appl, Return cached Settings singleton.  Use this in FastAPI deps., Settings

### Community 9 - "Alembic Migrations"
Cohesion: 0.33
Nodes (4): alembic/env.py — Alembic migration environment.  Uses async SQLAlchemy so migrat, Create async engine and run migrations within an async context., run_async_migrations(), run_migrations_online()

### Community 10 - "Analytics Endpoints"
Cohesion: 0.33
Nodes (3): head_to_head(), app/api/analytics.py — Analytics endpoints (stub for Phase 0)., Head-to-head driver comparison.  Full implementation in Phase 5.

### Community 11 - "Test Fixtures & Conftest"
Cohesion: 0.4
Nodes (1): tests/conftest.py — shared pytest fixtures.

### Community 12 - "DB Migration (Initial Schema)"
Cohesion: 0.5
Nodes (1): Initial schema — all tables  Revision ID: 0001 Revises: Create Date: 2026-04-16

### Community 13 - "Circuit API Endpoints"
Cohesion: 0.5
Nodes (1): app/api/circuits.py — Circuit endpoints.

### Community 14 - "WebSocket Progress Endpoint"
Cohesion: 0.5
Nodes (3): app/api/ws.py — WebSocket progress endpoint (stub for Phase 0)., Stream simulation progress.  Full implementation in Phase 4., simulation_progress()

### Community 15 - "Celery Simulation Tasks"
Cohesion: 0.67
Nodes (2): Run a full season Monte Carlo simulation.  Implemented in Phase 2., run_season_simulation()

### Community 16 - "Backtest & Validation Scripts"
Cohesion: 0.67
Nodes (1): scripts/run_backtest.py — Validate simulation against known season results. Full

### Community 17 - "Celery Worker Instance"
Cohesion: 1.0
Nodes (1): app/worker.py — Celery application instance.  All Celery tasks are auto-discover

### Community 18 - "CORS Config"
Cohesion: 1.0
Nodes (1): Parsed list of CORS origins from the comma-separated env string.

### Community 19 - "Module Init (Simulation)"
Cohesion: 1.0
Nodes (0): 

### Community 20 - "Module Init (Analytics)"
Cohesion: 1.0
Nodes (0): 

### Community 21 - "Module Init (API)"
Cohesion: 1.0
Nodes (0): 

### Community 22 - "Module Init (Models)"
Cohesion: 1.0
Nodes (0): 

### Community 23 - "Module Init (Schemas)"
Cohesion: 1.0
Nodes (0): 

### Community 24 - "Module Init (Ingestion)"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "Module Init (App)"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "Module Init (Tests)"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "Module Init (Scripts)"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "Module Init (Alembic)"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **63 isolated node(s):** `Initial schema — all tables  Revision ID: 0001 Revises: Create Date: 2026-04-16`, `app/config.py — Pydantic settings loaded from environment / .env file.  All appl`, `Parsed list of CORS origins from the comma-separated env string.`, `Return cached Settings singleton.  Use this in FastAPI deps.`, `app/database.py — Async SQLAlchemy engine and session factory.  Usage inside Fas` (+58 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Celery Worker Instance`** (2 nodes): `worker.py`, `app/worker.py — Celery application instance.  All Celery tasks are auto-discover`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `CORS Config`** (1 nodes): `Parsed list of CORS origins from the comma-separated env string.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module Init (Simulation)`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module Init (Analytics)`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module Init (API)`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module Init (Models)`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module Init (Schemas)`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module Init (Ingestion)`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module Init (App)`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module Init (Tests)`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module Init (Scripts)`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module Init (Alembic)`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Base` connect `API Routers & Schemas` to `ORM Models & DB Layer`, `Pydantic Schemas & Endpoints`, `FastAPI App & Database Session`, `Alembic Migrations`, `Test Fixtures & Conftest`?**
  _High betweenness centrality (0.215) - this node is a cross-community bridge._
- **Why does `Driver` connect `ORM Models & DB Layer` to `Data Ingestion Pipeline`, `API Routers & Schemas`, `Pydantic Schemas & Endpoints`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **Why does `SimulationRun` connect `API Routers & Schemas` to `ORM Models & DB Layer`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **Are the 24 inferred relationships involving `Driver` (e.g. with `app/api/drivers.py — Driver endpoints (Phase 4 full impl; Phase 0 stub).` and `Return all active drivers.`) actually correct?**
  _`Driver` has 24 INFERRED edges - model-reasoned connections that need verification._
- **Are the 24 inferred relationships involving `RaceResult` (e.g. with `app/api/drivers.py — Driver endpoints (Phase 4 full impl; Phase 0 stub).` and `Return all active drivers.`) actually correct?**
  _`RaceResult` has 24 INFERRED edges - model-reasoned connections that need verification._
- **Are the 21 inferred relationships involving `Circuit` (e.g. with `app/api/circuits.py — Circuit endpoints.` and `app/simulation/tasks.py — Celery simulation tasks (Phase 2 implementation).`) actually correct?**
  _`Circuit` has 21 INFERRED edges - model-reasoned connections that need verification._
- **Are the 20 inferred relationships involving `Team` (e.g. with `app/simulation/tasks.py — Celery simulation tasks (Phase 2 implementation).` and `Yield a sync DB session; commit on success, rollback on error.`) actually correct?**
  _`Team` has 20 INFERRED edges - model-reasoned connections that need verification._