---
type: community
cohesion: 0.11
members: 24
---

# Pydantic Schemas & Endpoints

**Cohesion:** 0.11 - loosely connected
**Members:** 24 nodes

## Members
- [[BaseModel]] - code
- [[DriverBase]] - code - app\schemas\driver.py
- [[DriverCreate]] - code - app\schemas\driver.py
- [[DriverRatingRead]] - code - app\schemas\driver.py
- [[DriverRead]] - code - app\schemas\driver.py
- [[DriverWithRating]] - code - app\schemas\driver.py
- [[Enqueue a what-if simulation.  Full implementation in Phase 5.]] - rationale - app\api\scenarios.py
- [[HeadToHeadResult]] - code - app\schemas\results.py
- [[RaceResultRead]] - code - app\schemas\results.py
- [[SeasonTrajectory]] - code - app\schemas\results.py
- [[SimulationResultRead]] - code - app\schemas\simulation.py
- [[SimulationRunCreate]] - code - app\schemas\simulation.py
- [[SimulationRunRead]] - code - app\schemas\simulation.py
- [[WhatIfRequest]] - code - app\api\scenarios.py
- [[appapiscenarios.py — What-if scenario endpoints (stub for Phase 0).]] - rationale - app\api\scenarios.py
- [[appschemasdriver.py — Pydantic IO schemas for drivers.]] - rationale - app\schemas\driver.py
- [[appschemasresults.py — Pydantic schemas for race results and analytics.]] - rationale - app\schemas\results.py
- [[appschemassimulation.py — Pydantic schemas for simulation jobs.]] - rationale - app\schemas\simulation.py
- [[driver.py]] - code - app\models\driver.py
- [[driver.py_1]] - code - app\schemas\driver.py
- [[results.py]] - code - app\schemas\results.py
- [[scenarios.py]] - code - app\api\scenarios.py
- [[simulation.py]] - code - app\schemas\simulation.py
- [[what_if()]] - code - app\api\scenarios.py

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Pydantic_Schemas_&_Endpoints
SORT file.name ASC
```

## Connections to other communities
- 3 edges to [[_COMMUNITY_API Routers & Schemas]]
- 1 edge to [[_COMMUNITY_ORM Models & DB Layer]]

## Top bridge nodes
- [[BaseModel]] - degree 11, connects to 1 community
- [[appschemasdriver.py — Pydantic IO schemas for drivers.]] - degree 3, connects to 1 community
- [[driver.py]] - degree 2, connects to 1 community