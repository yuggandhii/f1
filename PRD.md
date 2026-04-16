# F1 Championship Season Monte Carlo Simulator — Product Requirements Document

## 1. Product Overview

### What We're Building
A Python-native backend system that simulates the entire F1 championship season using Monte Carlo methods — run thousands of times to derive probabilistic title-winning chances for each driver and constructor. The frontend (React) consumes REST + WebSocket endpoints. This PRD covers **only the backend**, leaving all API contracts well-defined for frontend consumption.

### Core Value
- Every simulation is seeded from real FastF1 + Ergast data (qualifying, race pace, DNF rates, wet-weather performance)
- 10,000 season simulations run in ~20–40 seconds via parallel NumPy
- Users get probability distributions, not just "Verstappen wins again" headlines
- What-if scenarios: remove a driver, change team orders, inject a safety car, etc.

---

## 2. User-Facing Dashboard Views (Frontend Contract)

> The following describes what the frontend will display. The backend is responsible for providing all data via API.

### View 1 — Championship Probability Dashboard
- Donut/bar chart: each driver's % chance of winning the WDC
- Timeline: how win probability evolves race-by-race across the season
- Top 5 constructors' WCC probability

### View 2 — Race Results Explorer
- For any simulated race: finishing position distribution (violin plot)
- P1 probability heatmap: who wins which race how often
- DNF probability per driver per track

### View 3 — Driver Performance Trends
- Driver rating over the season (composite: pace + consistency + wet + tyre mgmt)
- Points trajectory fan chart (mean ± std dev across 10k simulations)
- Head-to-head probability: "Norris beats Hamilton in X% of simulations"

### View 4 — What-If Scenario Simulator
- Sliders: randomness factor, reliability coefficient, safety car probability
- Toggle: remove a driver, swap team orders, change weather mode
- Output: re-run probability distributions instantly

### View 5 — Constructor Standings
- Points distribution box plots per team
- Engine reliability ranking
- "If Red Bull had kept Sainz" type scenario comparison

---

## 3. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Language | Python 3.11 | NumPy vectorisation, ecosystem |
| API | FastAPI | Async, auto OpenAPI docs, WebSocket |
| Task queue | Celery + Redis | Long-running sim jobs, progress streaming |
| Database | PostgreSQL 16 | Structured race/driver/team data |
| ORM | SQLAlchemy 2.0 (async) | Type-safe, async-first |
| Migrations | Alembic | Schema versioning |
| Data fetching | FastF1 + requests | Telemetry + historical |
| Simulation core | NumPy + SciPy | Vectorised MC, distributions |
| Caching | Redis + Parquet (disk) | API response cache + sim output cache |
| Containerisation | Docker Compose | One-command start |
| Testing | Pytest + hypothesis | Unit + property-based |
| Linting | Ruff + mypy | Fast lint, type safety |

---

## 4. Project Structure

```
f1-simulator/
├── CLAUDE.md                    ← Claude instructions (token-optimised)
├── PRD.md                       ← This file
├── docker-compose.yml
├── pyproject.toml
├── alembic/
│   ├── env.py
│   └── versions/
├── app/
│   ├── __init__.py
│   ├── main.py                  ← FastAPI app factory
│   ├── config.py                ← Pydantic settings
│   ├── database.py              ← Async SQLAlchemy engine
│   │
│   ├── models/                  ← SQLAlchemy ORM models
│   │   ├── driver.py
│   │   ├── team.py
│   │   ├── circuit.py
│   │   ├── race_result.py
│   │   └── simulation_run.py
│   │
│   ├── schemas/                 ← Pydantic request/response schemas
│   │   ├── driver.py
│   │   ├── simulation.py
│   │   └── results.py
│   │
│   ├── ingestion/               ← Data pipeline
│   │   ├── fastf1_client.py     ← FastF1 wrapper
│   │   ├── ergast_client.py     ← Ergast REST client
│   │   ├── transformers.py      ← Raw → normalised driver ratings
│   │   └── tasks.py             ← Celery ingestion tasks
│   │
│   ├── simulation/              ← Monte Carlo core
│   │   ├── performance_model.py ← Driver/team rating builder
│   │   ├── race_simulator.py    ← Single race MC
│   │   ├── season_simulator.py  ← Full season (all races)
│   │   ├── scoring.py           ← F1 points system
│   │   └── tasks.py             ← Celery simulation tasks
│   │
│   ├── analytics/               ← Post-sim aggregation
│   │   ├── aggregator.py        ← Probability calculations
│   │   ├── what_if.py           ← Scenario engine
│   │   └── cache.py             ← Parquet read/write helpers
│   │
│   └── api/                     ← FastAPI routers
│       ├── deps.py              ← DB session, auth deps
│       ├── drivers.py
│       ├── simulations.py
│       ├── results.py
│       ├── scenarios.py
│       └── ws.py                ← WebSocket progress endpoint
│
├── tests/
│   ├── unit/
│   │   ├── test_performance_model.py
│   │   ├── test_race_simulator.py
│   │   └── test_scoring.py
│   ├── integration/
│   │   ├── test_ingestion.py
│   │   └── test_api.py
│   └── conftest.py
│
└── scripts/
    ├── seed_db.py               ← One-time DB seed from cached data
    └── run_backtest.py          ← Validate sim against known 2023 results
```

---

## 5. Database Schema

### Table: drivers
```sql
id UUID PK
name TEXT NOT NULL
abbreviation CHAR(3)
team_id UUID FK → teams
nationality TEXT
active BOOLEAN DEFAULT TRUE
created_at TIMESTAMPTZ
```

### Table: teams
```sql
id UUID PK
name TEXT NOT NULL
constructor_name TEXT
power_unit TEXT
base_performance FLOAT  -- 0.0-1.0 composite
created_at TIMESTAMPTZ
```

### Table: circuits
```sql
id UUID PK
name TEXT NOT NULL
country TEXT
track_type TEXT  -- street / permanent / mixed
lap_count INT
overtake_difficulty FLOAT  -- 0.0-1.0
weather_variability FLOAT  -- 0.0-1.0
created_at TIMESTAMPTZ
```

### Table: race_results (historical ground truth)
```sql
id UUID PK
driver_id UUID FK
circuit_id UUID FK
season INT
round INT
grid_position INT
finish_position INT
points FLOAT
dnf BOOLEAN
dnf_cause TEXT  -- mechanical / crash / other
fastest_lap BOOLEAN
weather TEXT  -- dry / wet / mixed
race_time_seconds FLOAT
created_at TIMESTAMPTZ
```

### Table: driver_ratings (derived, refreshed per ingestion)
```sql
id UUID PK
driver_id UUID FK UNIQUE
season INT
base_pace FLOAT          -- 0.0-1.0
consistency FLOAT        -- inverse of lap time std dev
wet_skill FLOAT          -- pace delta in wet conditions
tyre_management FLOAT    -- stint length vs team average
overtake_skill FLOAT     -- positions gained from grid
dnf_rate FLOAT           -- historical DNF fraction
qualifying_edge FLOAT    -- quali vs race pace ratio
updated_at TIMESTAMPTZ
```

### Table: simulation_runs
```sql
id UUID PK
season INT
n_simulations INT
randomness_factor FLOAT
scenario JSONB           -- what-if params
status TEXT              -- pending / running / done / failed
started_at TIMESTAMPTZ
completed_at TIMESTAMPTZ
result_path TEXT         -- parquet file path
```

### Table: simulation_results (aggregated, not raw)
```sql
id UUID PK
run_id UUID FK
driver_id UUID FK
wdc_probability FLOAT
expected_points FLOAT
points_std FLOAT
p1_count INT             -- races won across all sims
podium_rate FLOAT
dnf_rate_simulated FLOAT
per_race_win_probs JSONB -- {circuit_id: probability}
```

---

## 6. Data Ingestion Pipeline

### Phase 1 — Historical data load (one-time + annual refresh)
1. `ergast_client.py` fetches all seasons 2018–current: circuits, race results, grid positions, points
2. `fastf1_client.py` fetches lap telemetry for each race: fastest laps, sector times, tyre compounds, pit stops
3. Raw data is cached to `data/cache/{season}/{round}/` as Parquet
4. `transformers.py` builds `driver_ratings` for each driver × season combination

### Phase 2 — Current season (weekly refresh via Celery beat)
- Runs every Monday post-race weekend
- Updates `race_results` table with latest round
- Recalculates `driver_ratings` incorporating new data
- Invalidates any simulation caches for current season

### Driver Rating Formula
```
base_pace          = normalised median race pace vs field (0-1)
consistency        = 1 - (std_dev(lap_times) / mean(lap_times))
wet_skill          = pace_ratio_wet_vs_dry (normalised across field)
tyre_management    = avg_stint_length / team_average_stint
overtake_skill     = mean(finish_position - grid_position) / circuit_overtake_difficulty
dnf_rate           = dnf_count / races_started (trailing 3-season weighted avg)
qualifying_edge    = 1 - (grid_position / field_size) median
```

All ratings are min-max normalised across the current driver pool.

---

## 7. Monte Carlo Simulation Core

### Performance Model
```python
# driver_rating: dict of driver_id → DriverRating dataclass
# Returns: dict of driver_id → race pace sample

def sample_race_pace(driver_rating, circuit, weather, randomness_factor):
    mu = driver_rating.base_pace + circuit_adjustment(circuit, driver_rating)
    sigma = (1 - driver_rating.consistency) * randomness_factor
    if weather == 'wet':
        mu += driver_rating.wet_skill * 0.15
    return np.random.normal(mu, sigma)
```

### Single Race Simulation
```python
def simulate_race(drivers, circuit, weather, randomness_factor, n=1):
    # Returns shape (n, num_drivers) array of finish positions
    paces = vectorised_sample(drivers, circuit, weather, randomness_factor, n)
    dnfs  = sample_dnfs(drivers, circuit, n)
    paces[dnfs] = -np.inf  # DNF = worst position
    return np.argsort(-paces, axis=1)  # rank by pace descending
```

### Season Simulation (core loop)
```python
def simulate_season(drivers, teams, schedule, params, n_sims=10_000):
    # schedule: list of (circuit, round, expected_weather)
    all_points = np.zeros((n_sims, len(drivers)))
    for round_idx, (circuit, _, weather) in enumerate(schedule):
        positions = simulate_race(drivers, circuit, weather, params.randomness, n_sims)
        points = POINTS_MAP[positions]            # vectorised lookup
        all_points += points
    return all_points  # shape: (n_sims, n_drivers)
```

### Output Aggregation
From `all_points (10000, 20)`:
- WDC probability per driver: `(all_points.argmax(axis=1) == driver_idx).mean()`
- Expected points: `all_points.mean(axis=0)`
- Points std dev: `all_points.std(axis=0)`
- Per-race win probability: stored as JSONB per driver

### Parallelism Strategy
- Split 10k simulations into 8 batches via `concurrent.futures.ProcessPoolExecutor`
- Each batch runs `np.random` independently (seeded per batch)
- Results concatenated after join

---

## 8. API Endpoints

All endpoints prefixed `/api/v1/`.

### Drivers
```
GET  /drivers                   → list all active drivers + ratings
GET  /drivers/{id}              → single driver detail
GET  /drivers/{id}/history      → historical race results
```

### Circuits
```
GET  /circuits                  → full calendar with track metadata
GET  /circuits/{id}             → single circuit
```

### Simulation
```
POST /simulations               → enqueue new simulation job
    Body: { season, n_sims, randomness_factor, scenario? }
    Returns: { run_id, status: "pending" }

GET  /simulations/{run_id}      → job status + result summary
GET  /simulations/{run_id}/driver-probabilities   → WDC + WCC probs
GET  /simulations/{run_id}/race-breakdown/{circuit_id}  → per-race stats
GET  /simulations/{run_id}/scenarios              → what-if comparison

WS  /ws/simulations/{run_id}/progress
    → streams { progress: 0.0–1.0, message, partial_results? }
```

### Scenarios
```
POST /scenarios/what-if
    Body: { base_run_id, modifications: [...] }
    Returns: new run_id (runs in bg)
```

### Analytics
```
GET  /analytics/head-to-head?driver_a=X&driver_b=Y&run_id=Z
GET  /analytics/team-comparison?run_id=Z
GET  /analytics/season-trajectory?run_id=Z&driver_id=D
```

---

## 9. Build Phases (Backend Only)

### Phase 0 — Foundation (Day 1)
- [ ] `pyproject.toml` with all deps
- [ ] `docker-compose.yml` (postgres, redis, app, worker)
- [ ] `app/config.py` Pydantic settings
- [ ] `app/database.py` async SQLAlchemy engine
- [ ] Alembic init + first migration (all tables)
- [ ] `app/main.py` FastAPI factory

### Phase 1 — Data Ingestion (Day 1–2)
- [ ] `ergast_client.py` — fetch seasons 2018–2024
- [ ] `fastf1_client.py` — lap data, tyre data
- [ ] `transformers.py` — build driver_ratings
- [ ] Celery worker setup + beat schedule
- [ ] `scripts/seed_db.py` — populate DB from cached parquet
- [ ] Test: seed DB and verify all 20 drivers have ratings

### Phase 2 — Simulation Core (Day 2–3)
- [ ] `performance_model.py` — DriverRating dataclass + sampling
- [ ] `race_simulator.py` — vectorised single race
- [ ] `scoring.py` — F1 points + sprint + fastest lap
- [ ] `season_simulator.py` — full loop with parallelism
- [ ] `aggregator.py` — WDC/WCC probability from output matrix
- [ ] Test: run 100-sim backtest on 2023 season, verify Verstappen WDC prob > 95%

### Phase 3 — Storage + Caching (Day 3)
- [ ] Parquet write/read helpers in `analytics/cache.py`
- [ ] Redis caching for `/drivers` and `/circuits`
- [ ] Save simulation outputs to parquet on completion
- [ ] Simulation result serialisation to `simulation_results` table

### Phase 4 — API Layer (Day 3–4)
- [ ] All router files with proper Pydantic schemas
- [ ] WebSocket progress endpoint
- [ ] Celery task for async simulation dispatch
- [ ] Error handling + proper HTTP status codes
- [ ] OpenAPI docs auto-generated

### Phase 5 — What-If + Analytics (Day 4)
- [ ] `what_if.py` scenario engine
- [ ] Head-to-head endpoint
- [ ] Season trajectory endpoint
- [ ] Scenario diff comparison

### Phase 6 — Validation + Docs (Day 5)
- [ ] `scripts/run_backtest.py` — compare 2022 + 2023 outputs vs reality
- [ ] README with setup instructions
- [ ] All endpoints tested with Pytest
- [ ] Docker Compose fully working one-command start

---

## 10. Simulation Parameters

| Parameter | Type | Default | Range | Description |
|---|---|---|---|---|
| `n_simulations` | int | 10000 | 100–50000 | MC iterations |
| `randomness_factor` | float | 0.15 | 0.0–1.0 | Noise in pace sampling |
| `reliability_coefficient` | float | 1.0 | 0.5–2.0 | DNF rate multiplier |
| `safety_car_probability` | float | 0.3 | 0.0–1.0 | Per-race SC chance |
| `weather_mode` | enum | `historical` | `historical/dry/wet/random` | Weather source |
| `include_sprint` | bool | true | — | Include sprint race points |

---

## 11. Validation Strategy

### Backtest (2023 season is ideal — Verstappen dominant but field known)
- Run 10k simulations of the 2023 season using only pre-season ratings
- Verify: Verstappen WDC probability > 85%, Pérez in top 3
- Verify: Red Bull WCC probability > 90%
- Check: Hamilton podium rate within 15% of actual 2023 podium rate

### Unit tests
- `test_scoring.py` — every F1 points edge case (fastest lap, DQ, DNF)
- `test_race_simulator.py` — DNF injection, wet weather effect, position uniqueness
- `test_performance_model.py` — rating normalisation range check (all 0–1)

### Property-based tests (Hypothesis)
- "The sum of all points across all drivers in one simulation equals the total points available"
- "Positions in a race are always a permutation of 1..N"

---

## 12. Performance Targets

| Operation | Target |
|---|---|
| 10k season simulations | < 40 seconds |
| Single race simulation (10k) | < 4 seconds |
| `/drivers` endpoint (cached) | < 50ms |
| `/simulations/{id}` (done job) | < 100ms |
| Parquet result file size | < 20MB per run |

---

## 13. Environment Variables

```env
# Database
DATABASE_URL=postgresql+asyncpg://f1user:f1pass@localhost:5432/f1sim

# Redis
REDIS_URL=redis://localhost:6379/0

# FastF1
F1_CACHE_DIR=./data/fastf1_cache

# Simulation defaults
DEFAULT_N_SIMS=10000
DEFAULT_RANDOMNESS=0.15

# API
API_SECRET_KEY=changeme
CORS_ORIGINS=http://localhost:5173

# Celery
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/1
```

---

## 14. Docker Compose Services

```yaml
services:
  postgres:     postgres:16-alpine, port 5432
  redis:        redis:7-alpine, port 6379
  app:          ./Dockerfile, port 8000, depends on postgres + redis
  worker:       same image, command: celery -A app.worker worker
  beat:         same image, command: celery -A app.worker beat
  flower:       mher/flower, port 5555 (Celery monitoring)
```
