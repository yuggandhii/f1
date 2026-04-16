---
type: community
cohesion: 0.11
members: 29
---

# API Routers & Schemas

**Cohesion:** 0.11 - loosely connected
**Members:** 29 nodes

## Members
- [[.__repr__()_5]] - code - app\models\simulation_run.py
- [[.__repr__()_4]] - code - app\models\simulation_run.py
- [[Aggregated per-driver result for a given simulation run (not raw parquet rows).]] - rationale - app\models\simulation_run.py
- [[Base]] - code - app\database.py
- [[DeclarativeBase]] - code
- [[Enqueue a new simulation job.  Returns run_id immediately.]] - rationale - app\api\simulations.py
- [[Per-race statistics for a given circuit within a simulation run.]] - rationale - app\api\simulations.py
- [[Return WDC probabilities per driver for a completed run.]] - rationale - app\api\simulations.py
- [[Shared declarative base for all SQLAlchemy models.]] - rationale - app\database.py
- [[SimulationRequest]] - code - app\api\simulations.py
- [[SimulationResponse]] - code - app\api\simulations.py
- [[SimulationResult]] - code - app\models\simulation_run.py
- [[SimulationRun]] - code - app\models\simulation_run.py
- [[appapisimulations.py — Simulation job endpoints (stub for Phase 0).]] - rationale - app\api\simulations.py
- [[appmodelscircuit.py — Circuit  track ORM model.]] - rationale - app\models\circuit.py
- [[appmodelsdriver_rating.py — Derived driver performance ratings ORM model.]] - rationale - app\models\driver_rating.py
- [[appmodelsrace_result.py — Historical race result ORM model.]] - rationale - app\models\race_result.py
- [[appmodelssimulation_run.py — Simulation run + aggregated results ORM models.]] - rationale - app\models\simulation_run.py
- [[appmodelsteam.py — Team  constructor ORM model.]] - rationale - app\models\team.py
- [[circuit.py]] - code - app\models\circuit.py
- [[create_simulation()]] - code - app\api\simulations.py
- [[driver_rating.py]] - code - app\models\driver_rating.py
- [[get_driver_probabilities()]] - code - app\api\simulations.py
- [[get_race_breakdown()]] - code - app\api\simulations.py
- [[get_simulation()]] - code - app\api\simulations.py
- [[race_result.py]] - code - app\models\race_result.py
- [[simulation_run.py]] - code - app\models\simulation_run.py
- [[simulations.py]] - code - app\api\simulations.py
- [[team.py]] - code - app\models\team.py

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/API_Routers_&_Schemas
SORT file.name ASC
```

## Connections to other communities
- 13 edges to [[_COMMUNITY_ORM Models & DB Layer]]
- 3 edges to [[_COMMUNITY_Pydantic Schemas & Endpoints]]
- 2 edges to [[_COMMUNITY_Alembic Migrations]]
- 1 edge to [[_COMMUNITY_FastAPI App & Database Session]]
- 1 edge to [[_COMMUNITY_Test Fixtures & Conftest]]

## Top bridge nodes
- [[Base]] - degree 20, connects to 5 communities
- [[SimulationResult]] - degree 12, connects to 1 community
- [[SimulationRun]] - degree 12, connects to 1 community
- [[SimulationResponse]] - degree 5, connects to 1 community
- [[SimulationRequest]] - degree 4, connects to 1 community