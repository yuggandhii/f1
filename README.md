# PITWALL/SIM — F1 Championship Monte Carlo Simulator

> Predict the championship. Rewrite history. Run 10,000 seasons in under 2 seconds.

Built by **Yug Gandhi** and **Ansh Agarwal**

---

## What Is This?

PITWALL/SIM is a full-stack Formula 1 championship prediction engine that uses Monte Carlo simulation to generate probabilistic championship outcomes for every driver and constructor. It ingests real telemetry data from FastF1 and historical race results from the Jolpica/Ergast API, builds composite driver ratings across 9 metrics, and simulates the entire F1 season thousands of times to answer questions like:

- Who wins the 2026 World Drivers Championship?
- What if Sainz had the Red Bull in 2023?
- If Ferrari had fixed their reliability in 2022, would Leclerc have won?
- Who is most likely to win the next race?

Unlike traditional F1 statistics sites that show what happened, PITWALL/SIM shows what is likely to happen — and how certain we are.

---

## Live Demo

```
Frontend:  http://localhost:5173
Backend:   http://localhost:8000
API Docs:  http://localhost:8000/docs
Flower:    http://localhost:5555
```

---

## Table of Contents

1. [Architecture](#architecture)
2. [Tech Stack](#tech-stack)
3. [Data Sources](#data-sources)
4. [Driver Rating System](#driver-rating-system)
5. [Monte Carlo Engine](#monte-carlo-engine)
6. [Simulation Parameters](#simulation-parameters)
7. [What-If Scenario Engine](#what-if-scenario-engine)
8. [API Reference](#api-reference)
9. [Database Schema](#database-schema)
10. [Setup & Installation](#setup--installation)
11. [Project Structure](#project-structure)
12. [Workflows & Pipelines](#workflows--pipelines)
13. [Backtesting & Validation](#backtesting--validation)
14. [Frontend Pages](#frontend-pages)
15. [Deployment](#deployment)
16. [Known Limitations](#known-limitations)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER BROWSER                             │
│                    React 19 + Vite + TS                         │
│           localhost:5173 (Vercel in production)                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP / WebSocket
┌──────────────────────────▼──────────────────────────────────────┐
│                      FASTAPI (port 8000)                        │
│   REST endpoints + WebSocket progress streaming                 │
│   Auto-generated OpenAPI docs at /docs                          │
└────┬──────────────┬──────────────┬──────────────────────────────┘
     │              │              │
┌────▼────┐  ┌──────▼──────┐  ┌───▼──────────────────────────────┐
│ Celery  │  │  PostgreSQL  │  │            Redis                  │
│ Workers │  │  (port 5432) │  │  Job queue + pub/sub + cache      │
│ + Beat  │  │  All race    │  │  (port 6379)                      │
└────┬────┘  │  data, driver│  └──────────────────────────────────┘
     │       │  ratings,    │
     │       │  sim results │  ┌──────────────────────────────────┐
     │       └──────────────┘  │         Parquet Cache            │
     │                         │  data/simulations/{run_id}/      │
     │                         │  data/cache/{season}/{round}/    │
     │                         │  (raw simulation output matrices)│
     └─────────────────────────┘
     
     External APIs:
     ├── FastF1 (lap telemetry, sector times, tyre data)
     ├── Jolpica API (race results, calendar, standings)
     └── OpenMeteo (weather forecasts for upcoming races)
```

---

## Tech Stack

### Backend
| Tool | Version | Purpose |
|---|---|---|
| Python | 3.11 | Core language |
| FastAPI | 0.110+ | REST API + WebSocket |
| Celery | 5.3+ | Async task queue |
| Redis | 7 | Broker + result backend + pub/sub |
| PostgreSQL | 16 | Primary database |
| SQLAlchemy | 2.0 (async) | ORM |
| Alembic | 1.13+ | Database migrations |
| NumPy | 1.26+ | Vectorised MC computation |
| SciPy | 1.12+ | Statistical distributions |
| FastF1 | 3.8+ | F1 telemetry data |
| Pandas | 2.2+ | Data transformation |
| PyArrow | 14+ | Parquet read/write |
| Structlog | 24+ | Structured logging |
| Pydantic | 2.0+ | Request/response validation |

### Frontend
| Tool | Version | Purpose |
|---|---|---|
| React | 19 | UI framework |
| Vite | 5 | Build tool + dev server |
| TypeScript | 5 | Type safety |
| Tailwind CSS | 3 | Styling |
| Recharts | 2.12+ | Charts and visualisations |
| Lucide React | 0.383 | Icons |
| @dnd-kit/core | 6 | Drag and drop (What-If builder) |
| React Router | 6 | Client-side routing |
| Axios | 1.6+ | HTTP client |

### Infrastructure
| Tool | Purpose |
|---|---|
| Docker Compose | One-command local setup |
| Flower | Celery task monitoring (port 5555) |
| Ollama + Gemma 3 | Local LLM for NLP scenario parsing |

---

## Data Sources

### FastF1 API
**Coverage:** 2018–2026 (2015–2017 unavailable — no live timing data)  
**What we fetch per race session:**
- Every individual lap time per driver
- Sector 1, 2, 3 best times
- Tyre compound per stint (SOFT/MEDIUM/HARD/INTER/WET)
- Pit stop laps and total pit time
- Track status per lap (1=green, 4=SC, 5=VSC, 6=red flag)
- Speed trap maximum speed
- Position changes lap by lap (for overtake calculation)

**Cache location:** `data/fastf1_cache/` (persistent across restarts)  
**Re-run time after first download:** ~2 seconds per season (parquet cache)  
**Total lap rows collected:** ~51,000 across 2018–2026

### Jolpica API (Ergast successor)
**Base URL:** `https://api.jolpi.ca/ergast/f1/`  
**Coverage:** Complete F1 history back to 1950  
**What we fetch:**
- Race calendar per season (circuit names, dates, countries)
- Race results (grid position, finish position, points, DNF cause)
- Qualifying results (Q1/Q2/Q3 times)
- Constructor standings
- Driver standings

**Note:** Ergast.com was retired end of 2024. Jolpica is the community mirror with identical API format. We use Jolpica for 2025+ and can fall back to Jolpica for all seasons.

### OpenMeteo API
**URL:** `https://api.open-meteo.com/v1/forecast`  
**What we fetch:** 7-day hourly precipitation probability for each circuit location  
**Used for:** Predicting wet/dry/mixed conditions for upcoming race weekends  
**Refresh:** Every Thursday before a race weekend (Celery beat task)

---

## Driver Rating System

Every driver gets 9 ratings, each normalised 0.0–1.0 across the current driver pool.

| Rating | How Calculated | Data Source |
|---|---|---|
| `base_pace` | Normalised median lap time vs field median | FastF1 lap times |
| `consistency` | `1 - (std_dev(clean_laps) / mean(lap_time))` SC laps excluded | FastF1 |
| `wet_skill` | Pace delta on INTERMEDIATE/WET tyres vs driver's dry pace | FastF1 compound data |
| `tyre_management` | Average stint length normalised by compound (soft/med/hard expected differently) | FastF1 stints |
| `overtake_skill` | Position changes per race from lap-by-lap position data | FastF1 positions |
| `qualifying_edge` | Driver's best sector sum vs teammate best sector sum | FastF1 sectors |
| `speed_rating` | Max speed trap normalised across field | FastF1 speed trap |
| `pit_efficiency` | Average pit stop time vs team average | FastF1 pit data |
| `teammate_index` | Pace delta vs teammate in identical car, normalised | FastF1 + Ergast |

### DNF Rate Split
DNFs are split into two components to avoid penalising drivers for factory failures:

- `mechanical_dnf_rate`: Engine, gearbox, hydraulics failures → shared equally between both drivers on the same team (factory issue)
- `driver_dnf_rate`: Crashes, driver errors → assigned individually

This prevents Leclerc being penalised for Ferrari's 2022 reliability issues while Sainz was not.

### Recency Weighting
When multiple seasons are in the data range:
```
current_season:     weight = 1.0
current - 1 year:   weight = 0.7
current - 2 years:  weight = 0.5
older:              weight = 0.3
```

Composite rating = weighted average across all seasons in range.

### Team Car Performance
Each team gets a `car_performance` rating (0.0–1.0) calculated from:
- **60%** qualifying pace (pole lap times normalised across teams)
- **40%** race pace (median fastest laps normalised across teams)

The final simulated pace for each driver:
```python
final_pace = (driver.base_pace * 0.35) + (team.car_performance * 0.65)
```

This reflects the real F1 reality: the car accounts for ~65% of lap time.

---

## Monte Carlo Engine

### How It Works

Monte Carlo simulation doesn't train a model. It runs the same probabilistic experiment thousands of times and counts outcomes.

For each simulation run:

```
For each race in the season:
  1. Sample each driver's pace:
     pace = final_pace + random_noise(sigma = chaos_factor)
     
  2. Apply weather modifier:
     if wet: pace += wet_skill * 0.15
     
  3. Apply qualifying simulation (Q1/Q2/Q3 knockout):
     sigma_quali = 0.003 (much tighter than race)
     Grid positions set by Q3 times
     
  4. Apply lap 1 incident (12% chance per race):
     1-2 drivers removed from contention
     
  5. Apply safety car (circuit sc_probability):
     Field compressed, gaps reduced 60%, neutralised 3-5 laps
     
  6. Apply tyre strategy:
     Degradation rates per compound per circuit type
     Pit stop cost: 22 seconds
     Undercut window: if within 2s, pit early
     
  7. Apply DNF:
     mechanical_dnf_rate + driver_dnf_rate per driver
     DNF reliability streaks: +15% per consecutive DNF
     
  8. Apply grid penalty (8% chance: 3-5 place penalty)
  
  9. Sort by final simulated pace → race result
  
  10. Award F1 points (25-18-15-12-10-8-6-4-2-1)
      + fastest lap bonus (1pt, top 10 only)
      + sprint points if sprint weekend

After all races:
  all_points[sim_index, driver_index] = total_season_points
```

### Parallelism
10,000 simulations split into 8 batches via `ProcessPoolExecutor`.  
Each batch runs independently with its own random seed.  
Results concatenated after all processes complete.

**Performance:** ~1–2 seconds for 10,000 simulations on modern hardware.

### Output Matrix
```python
all_points: np.ndarray  # shape (n_sims, n_drivers), dtype float32
```

From this matrix:
- **WDC probability:** `(all_points.argmax(axis=1) == driver_idx).mean()`
- **Expected points:** `all_points.mean(axis=0)`
- **Points std dev:** `all_points.std(axis=0)`
- **P5/P95 range:** `np.percentile(all_points, [5, 95], axis=0)`
- **Best simulation:** run with highest points for leader
- **Worst simulation:** run with lowest points for leader

---

## Simulation Parameters

| Parameter | Default | Range | Effect |
|---|---|---|---|
| `n_simulations` | 10,000 | 1,000–50,000 | More = more precise probabilities |
| `randomness_factor` (chaos) | 0.15 | 0.05–0.50 | Low = car quality dominates, High = anyone can win |
| `reliability_coefficient` | Historical | Historical/Optimistic/Pessimistic | DNF rate multiplier |
| `weather_mode` | Historical | Historical/Dry/Random/Monsoon | Weather source |
| `cutoff_round` | Full season | 1–24 | Simulate only up to this round |
| `data_range_start` | 2022 | 2018–2026 | Earliest season for ratings |
| `data_range_end` | 2026 | 2018–2026 | Latest season for ratings |

---

## What-If Scenario Engine

Six scenario types, each modifies driver/team ratings before simulation:

### 1. Driver Swap
Move a driver to a different team's car.
```json
{
  "type": "driver_swap",
  "driver": "sainz",
  "to_team": "red_bull",
  "season": 2023
}
```
Effect: Sainz keeps his own ratings (pace, consistency etc) but gets Red Bull's car_performance (1.0 instead of Ferrari's 0.79).

### 2. Reliability Fix
Remove mechanical failures from a team.
```json
{
  "type": "reliability_fix",
  "team": "ferrari",
  "season": 2022
}
```
Effect: Sets mechanical_dnf_rate to 0.01 for both Ferrari drivers. Leclerc's WDC probability jumps from 14% to ~35%.

### 3. Remove Driver
Simulate injury, ban, or retirement for N rounds.
```json
{
  "type": "remove_driver",
  "driver": "verstappen",
  "from_round": 1,
  "to_round": 5,
  "season": 2026
}
```

### 4. Weather Change
Force specific weather conditions at chosen circuits.
```json
{
  "type": "weather_change",
  "circuits": ["monaco", "spa"],
  "condition": "wet",
  "season": 2026
}
```

### 5. Team Orders Free
Remove artificial gap between teammates, let both race freely.
```json
{
  "type": "team_orders_free",
  "team": "red_bull",
  "season": 2023
}
```
Effect: Both Red Bull drivers get equal car_performance (average of the two).

### 6. Remaining Season (Live)
Simulate only remaining races with real current standings as starting points.
```json
{
  "type": "remaining_season",
  "season": 2026,
  "current_round": 4,
  "current_standings": {"norris": 77, "piastri": 52, "leclerc": 48}
}
```

### NLP Parsing (Gemma 3)
Any scenario can be described in plain English. Gemma 3 (running locally via Ollama) parses the text into structured JSON:

```
"what if hamilton had the red bull in 2026"
→ {"type": "driver_swap", "driver": "hamilton", "to_team": "red_bull", "season": 2026}
```

Fallback chain: gemma3 → gemma2 → mistral → regex heuristics.

---

## API Reference

All endpoints prefixed `/api/v1/`

### Drivers
```
GET  /drivers/                          List all active drivers
GET  /drivers/{id}                      Single driver detail
GET  /drivers/{id}/history              Historical race results
```

### Circuits & Calendar
```
GET  /circuits/                         All circuits with metadata
GET  /circuits/calendar?season={year}   Race calendar in order
```

### Simulations
```
POST /simulations/                      Enqueue simulation job
GET  /simulations/{run_id}              Job status + summary
GET  /simulations/{run_id}/driver-probabilities    WDC probabilities
GET  /simulations/{run_id}/constructor-probabilities  WCC projections
GET  /simulations/{run_id}/extremes?driver_id=X   Best/worst seasons
WS   /ws/simulations/{run_id}/progress  Live progress stream
```

### Scenarios
```
POST /scenarios/what-if                 Run what-if simulation
POST /scenarios/parse-nlp               Parse natural language to JSON
GET  /scenarios/compare?base=X&scenario=Y  Side by side comparison
GET  /scenarios/templates               All 6 scenario type templates
GET  /scenarios/current-standings?season=Y  Live championship standings
```

### Analytics
```
GET  /analytics/head-to-head?driver_a=X&driver_b=Y&run_id=Z
GET  /analytics/team-comparison?run_id=Z
GET  /analytics/season-trajectory?run_id=Z&driver_id=D
GET  /analytics/teammate-comparison?season=2023
```

### Seasons
```
GET  /seasons/{season}/actual-results         All completed race results
GET  /seasons/{season}/race-result/{round}    Single race result
GET  /seasons/{season}/next-race              Next upcoming race
```

---

## Database Schema

### Core Tables

**drivers** — All F1 drivers 2018–2026 (42 total)
```sql
id UUID PK, name, abbreviation CHAR(3), team_id UUID FK,
nationality, active BOOLEAN, created_at
```

**teams** — All constructors (18 total)
```sql
id UUID PK, name, constructor_name, power_unit,
base_performance FLOAT, car_performance FLOAT,
car_performance_season INT, engine_supplier, created_at
```

**circuits** — All race venues (32 total)
```sql
id UUID PK, name, country, track_type,
lap_count, overtake_difficulty FLOAT, weather_variability FLOAT,
latitude FLOAT, longitude FLOAT,
sc_probability FLOAT, vsc_probability FLOAT, created_at
```

**race_results** — Historical ground truth (1,984 rows)
```sql
id UUID PK, driver_id FK, circuit_id FK,
season INT, round INT, grid_position INT, finish_position INT,
points FLOAT, dnf BOOLEAN, dnf_cause TEXT,
fastest_lap BOOLEAN, weather TEXT, race_time_seconds FLOAT
```

**driver_ratings** — Computed per driver per season (192 rows)
```sql
id UUID PK, driver_id FK, season INT,
base_pace FLOAT, consistency FLOAT, wet_skill FLOAT,
tyre_management FLOAT, overtake_skill FLOAT,
dnf_rate FLOAT, mechanical_dnf_rate FLOAT, driver_dnf_rate FLOAT,
qualifying_edge FLOAT, speed_rating FLOAT, pit_efficiency FLOAT,
teammate_index FLOAT, updated_at
```

**simulation_runs** — Job tracking
```sql
id UUID PK, season INT, n_simulations INT,
randomness_factor FLOAT, scenario JSONB,
status TEXT (pending/running/done/failed),
started_at, completed_at, result_path TEXT
```

**simulation_results** — Aggregated output per driver per run
```sql
id UUID PK, run_id FK, driver_id FK,
wdc_probability FLOAT, expected_points FLOAT, points_std FLOAT,
p1_count INT, podium_rate FLOAT, dnf_rate_simulated FLOAT,
per_race_win_probs JSONB
```

**race_weather_forecasts** — OpenMeteo predictions
```sql
id UUID PK, circuit_id FK, race_date DATE,
precipitation_probability FLOAT, predicted_condition TEXT,
fetched_at TIMESTAMPTZ
```

### Migrations
```
0001 — Initial schema (all core tables)
0002 — Add speed_rating, pit_efficiency to driver_ratings
0003 — Add car_performance to teams, coordinates + SC probs to circuits,
        teammate_index to driver_ratings
0004 — Add race_weather_forecasts table
0005 — Split dnf_rate into mechanical_dnf_rate + driver_dnf_rate
```

---

## Setup & Installation

### Prerequisites
- Docker Desktop (WSL2 backend on Windows)
- Node.js 20+
- Git
- Ollama (optional, for NLP what-if parsing)

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/yuggandhii/f1.git
cd f1-simulator

# 2. Configure environment
cp .env.example .env
# Edit .env — change API_SECRET_KEY at minimum

# 3. Start all backend services
docker compose up -d

# 4. Wait for postgres to be healthy (~10 seconds), then run migrations
docker exec f1sim_app alembic upgrade head

# 5. Seed the database (Ergast-only, fast ~2 minutes)
docker exec f1sim_app python scripts/seed_db.py --seasons 2022 2023 2024 2025 2026 --skip-fastf1

# 6. Optional: full seed with FastF1 telemetry (~2 hours, much better ratings)
docker exec f1sim_app python scripts/seed_db.py --seasons 2018 2019 2020 2021 2022 2023 2024 2025 2026

# 7. Verify database
docker exec f1sim_app python scripts/seed_db.py --verify-only

# 8. Start frontend
cd frontend
npm install
npm run dev

# 9. Open browser
# Frontend: http://localhost:5173
# API Docs: http://localhost:8000/docs
# Flower:   http://localhost:5555
```

### Environment Variables
```env
# Database
DATABASE_URL=postgresql+asyncpg://f1user:f1pass@postgres:5432/f1sim

# Redis
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/1

# FastF1 cache
F1_CACHE_DIR=./data/fastf1_cache

# Simulation defaults
DEFAULT_N_SIMS=10000
DEFAULT_RANDOMNESS=0.15

# API
API_SECRET_KEY=your-secret-key-here
CORS_ORIGINS=http://localhost:5173

# Ollama (optional, for NLP)
OLLAMA_URL=http://localhost:11434
```

### Docker Services
| Container | Image | Port | Purpose |
|---|---|---|---|
| f1sim_app | Custom Python 3.11 | 8000 | FastAPI application |
| f1sim_worker | Same image | — | Celery simulation worker |
| f1sim_beat | Same image | — | Celery scheduled tasks |
| f1sim_postgres | postgres:16-alpine | 5432 | Primary database |
| f1sim_redis | redis:7-alpine | 6379 | Queue + cache |
| f1sim_flower | mher/flower:2.0 | 5555 | Task monitoring UI |

---

## Project Structure

```
f1-simulator/
├── CLAUDE.md                    ← AI assistant instructions
├── PRD.md                       ← Product requirements document
├── BUGS.md                      ← Known issues tracker
├── docker-compose.yml
├── Dockerfile
├── pyproject.toml
├── alembic/
│   ├── env.py
│   └── versions/                ← 5 migration files
├── app/
│   ├── main.py                  ← FastAPI app factory
│   ├── config.py                ← Pydantic settings
│   ├── database.py              ← Async SQLAlchemy engine
│   ├── worker.py                ← Celery app + beat schedule
│   ├── models/                  ← SQLAlchemy ORM models
│   │   ├── driver.py
│   │   ├── team.py
│   │   ├── circuit.py
│   │   ├── race_result.py
│   │   ├── driver_rating.py
│   │   ├── simulation_run.py
│   │   └── race_weather_forecast.py
│   ├── schemas/                 ← Pydantic I/O schemas
│   ├── ingestion/               ← Data pipeline
│   │   ├── ergast_client.py     ← Jolpica/Ergast API wrapper
│   │   ├── fastf1_client.py     ← FastF1 telemetry fetcher
│   │   ├── transformers.py      ← Raw data → driver ratings
│   │   ├── weather_client.py    ← OpenMeteo forecasts
│   │   ├── safety_car_client.py ← SC probability calculator
│   │   └── tasks.py             ← Celery ingestion tasks
│   ├── simulation/              ← Monte Carlo core
│   │   ├── performance_model.py ← Pace sampling + DNF masks
│   │   ├── qualifying_simulator.py ← Q1/Q2/Q3 knockout
│   │   ├── tyre_strategy.py     ← Degradation + pit strategy
│   │   ├── race_simulator.py    ← Single race MC
│   │   ├── season_simulator.py  ← Full season loop + parallelism
│   │   ├── scoring.py           ← F1 points system
│   │   └── tasks.py             ← Celery simulation tasks
│   ├── analytics/               ← Post-simulation analysis
│   │   ├── aggregator.py        ← WDC/WCC probability calc
│   │   ├── what_if.py           ← 6 scenario type engines
│   │   ├── nlp_scenario_parser.py ← Gemma/Ollama NLP
│   │   ├── teammate_comparison.py ← Teammate index calc
│   │   └── cache.py             ← Parquet helpers
│   └── api/                     ← FastAPI routers
│       ├── deps.py              ← DB + Redis dependencies
│       ├── drivers.py
│       ├── simulations.py
│       ├── scenarios.py
│       ├── analytics.py
│       ├── seasons.py
│       └── ws.py                ← WebSocket endpoint
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Landing.tsx      ← Marketing landing page
│   │   │   ├── Simulate.tsx     ← Main simulation interface
│   │   │   ├── Dashboard.tsx    ← Coming soon
│   │   │   ├── WhatIf.tsx       ← Coming soon
│   │   │   └── Game.tsx         ← Prediction game
│   │   ├── api/
│   │   │   └── client.ts        ← Typed Axios client
│   │   └── constants/
│   │       └── drivers.ts       ← Driver lookup table
│   └── public/
│       └── f1-hero.mp4          ← Landing page video
├── scripts/
│   ├── seed_db.py               ← Full data ingestion pipeline
│   └── run_backtest.py          ← Validation against real results
├── tests/
│   ├── unit/
│   └── integration/
└── data/
    ├── fastf1_cache/            ← FastF1 HTTP cache (gitignored)
    ├── cache/                   ← Parquet race data (gitignored)
    └── simulations/             ← Simulation outputs (gitignored)
```

---

## Workflows & Pipelines

### Data Ingestion Pipeline

```
┌─────────────────────────────────────────────────────┐
│                  seed_db.py                          │
│                                                     │
│  For each season:                                   │
│                                                     │
│  1. fetch_season_races(season)                      │
│     └── Jolpica /api/f1/{season}.json               │
│     └── Returns: 22-24 circuits with dates          │
│                                                     │
│  2. fetch_season_results(season)                    │
│     └── Jolpica /api/f1/{season}/results.json       │
│     └── All race results per round                  │
│                                                     │
│  3. fetch_season_laps(season, rounds)               │
│     └── FastF1 Session.load(laps=True)              │
│     └── Caches to data/cache/{season}/{round}/      │
│                                                     │
│  4. fetch_race_telemetry(season, round)             │
│     └── Sector times, speed trap, pit stops         │
│                                                     │
│  5. _upsert_teams → _upsert_circuits →              │
│     _upsert_drivers → _upsert_race_results          │
│                                                     │
│  6. compute_driver_ratings(season, laps, results)   │
│     └── 9 metrics per driver                        │
│     └── compute_2026_current_ratings() if 2026      │
│                                                     │
│  7. _upsert_driver_ratings                          │
│                                                     │
│  8. verify_db() — 4 checks must pass                │
└─────────────────────────────────────────────────────┘
```

### Simulation Pipeline

```
POST /api/v1/simulations/
       │
       ▼
Creates SimulationRun (status=pending)
       │
       ▼
Celery task: f1sim.simulation.run_season
       │
       ├── Load driver_ratings from DB for season + data_range
       ├── Load circuits + car_performance for season
       ├── Apply scenario modifications (if what-if)
       ├── Call season_simulator.simulate_season()
       │   ├── ProcessPoolExecutor (8 workers)
       │   └── Each worker: simulate_race() × n_races × n_sims/8
       ├── aggregator.compute_wdc_probabilities(all_points)
       ├── Save output matrix to Parquet
       ├── Upsert simulation_results rows
       └── Update SimulationRun status=done
       
WebSocket /ws/simulations/{run_id}/progress
  └── Redis pub/sub channel sim_progress:{run_id}
  └── Worker publishes progress every 500ms
  └── Frontend receives live updates
```

### Weekly Data Refresh (Celery Beat)

```
Every Monday 06:00 UTC:
  fetch_latest_race_results()
  ├── Fetch most recent completed round from Jolpica
  ├── Upsert race_results for new round
  ├── Recompute driver_ratings for current season
  └── Invalidate Redis cache for current season endpoints

Every Thursday 06:00 UTC:
  fetch_weather_forecasts()
  ├── For each circuit in upcoming 2 weeks
  ├── Call OpenMeteo forecast API
  └── Upsert race_weather_forecasts table
```

---

## Backtesting & Validation

We validate the simulation against known historical outcomes:

```bash
# Validate 2023 season (Verstappen dominant year)
docker exec f1sim_app python scripts/run_backtest.py --n 1000 --season 2023

# Validate 2022 season (competitive 3-way fight)
docker exec f1sim_app python scripts/run_backtest.py --n 1000 --season 2022
```

### Validation Targets

| Season | Driver | Target | Our Result | Status |
|---|---|---|---|---|
| 2023 | Verstappen WDC% | > 80% | 82.9% | ✅ PASS |
| 2023 | Pérez WDC rank | ≤ 3rd | 2nd | ✅ PASS |
| 2022 | Top driver WDC% | > 25% | 30.6% | ✅ PASS |

### Why 2022 Is Hard to Predict Pre-Season
The 2022 season was a genuine 3-way fight between Verstappen, Leclerc, and Sainz. Any simulation starting from pre-season ratings will show 25-35% for the winner — that's correct, not a bug. The actual WDC winner (Verstappen with 454 pts vs Leclerc's 308) emerged from Ferrari's catastrophic reliability failures which cannot be predicted pre-season.

### Calibration Fix: Ferrari 2022
After identifying that Leclerc's historical DNF rate was inflated by Ferrari factory failures (not his own errors), we split DNF rates into `mechanical_dnf_rate` (team-level) and `driver_dnf_rate` (individual). Both Ferrari drivers now share the mechanical failure risk equally, correctly reflecting that the car — not the driver — was unreliable.

---

## Frontend Pages

### Landing Page (`/`)
- Full-viewport video hero (F1 car footage)
- Scroll sections: How It Works, What-If Scenarios, Data Sources, Live 2026 standings
- Animated stat counters, intersection observer fade-ins

### Simulate (`/simulate`) — Main interface
- Live clock + next race countdown
- Season selector (2021–2026)
- Race schedule timeline — click any race to set simulation cutoff
- Data range selector for historical weighting
- Monte Carlo runs slider, chaos factor, weather mode, reliability
- Live WebSocket progress during simulation
- Championship projection table (all 20 drivers)
- Real vs Predicted comparison card for completed races
- Next race predicted winner with podium mix
- Constructor WCC projections

### Dashboard (`/dashboard`) — Coming Soon
Championship overview, probability trends, driver analytics, radar charts

### What-If (`/what-if`) — Coming Soon
Visual drag-and-drop scenario builder for all 6 scenario types + AI chatbox

### Game (`/game`)
F1 prediction game interface

---

## Deployment

### Target Architecture (AWS)
```
Frontend → Vercel (free tier, React static)
Backend  → EC2 t3.large (~$60/month)
Database → RDS PostgreSQL t3.micro (~$15/month)
Cache    → ElastiCache Redis t3.micro (~$12/month)
Storage  → S3 for parquet cache (~$2/month)
LB       → ALB with HTTPS (~$16/month)
Total    → ~$105/month
```

### Docker Compose → EC2
The existing `docker-compose.yml` runs unchanged on EC2. Only environment variables change (RDS hostname, ElastiCache hostname, S3 bucket).

### Gemma on EC2
EC2 t3.large (8GB RAM) runs Gemma 3 2B via Ollama.  
For better NLP accuracy: t3.xlarge (16GB) handles Gemma 3 9B.

---

## Known Limitations

| Issue | Impact | Status |
|---|---|---|
| `wet_skill` defaults 0.5 for 2023/2024 | Minor — not enough wet races per season to calculate delta | Partially fixed with INTER compound proxy |
| 2015–2017 FastF1 data unavailable | Those seasons excluded from telemetry-based ratings | By design — FastF1 API limitation |
| `podium_rate` and `dnf_rate_simulated` null | Analytics endpoints return null for these fields | Known, low priority |
| Constructor WCC panel uses partial mock data | WCC probabilities partially hardcoded | Fix in progress |
| 2D race replay | Not yet implemented | Coming soon |
| What-If visual builder | NLP parsing works, visual drag-drop not yet built | Coming soon |

---

## Data Coverage Summary

| Season | Ergast Results | FastF1 Laps | Ratings Quality |
|---|---|---|---|
| 2015–2017 | ✅ | ❌ (unavailable) | Ergast-only (pace/qualifying) |
| 2018–2022 | ✅ | ✅ | Full 9-metric ratings |
| 2023 | ✅ | ✅ 24,422 laps | Full 9-metric ratings |
| 2024 | ✅ | ✅ 26,606 laps | Full 9-metric ratings |
| 2025 | ✅ (Jolpica) | ✅ | Full 9-metric ratings |
| 2026 | ✅ (Jolpica, partial) | ✅ (completed rounds) | 2026-current ratings |

**Total:** 1,984 race results · 42 drivers · 32 circuits · 192 driver rating rows · ~51,000 FastF1 lap rows

---

## Built By

**Yug Gandhi** and **Ansh Agarwal**

---

*Not affiliated with Formula 1, FOM, or any F1 team. All simulation outputs are probabilistic predictions, not official standings.*
