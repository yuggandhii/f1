---
type: community
cohesion: 0.10
members: 22
---

# Architecture Docs & Config Rules

**Cohesion:** 0.10 - loosely connected
**Members:** 22 nodes

## Members
- [[Architecture Separation of Concerns]] - document - CLAUDE.md
- [[Celery + Redis Dependency]] - document - requirements.txt
- [[Celery Task Naming Convention]] - document - CLAUDE.md
- [[Celery Task Queue]] - document - PRD.md
- [[DB Table circuits]] - document - PRD.md
- [[DB Table driver_ratings]] - document - PRD.md
- [[DB Table drivers]] - document - PRD.md
- [[DB Table race_results]] - document - PRD.md
- [[DB Table simulation_results]] - document - PRD.md
- [[DB Table simulation_runs]] - document - PRD.md
- [[DB Table teams]] - document - PRD.md
- [[Ergast REST Client]] - document - PRD.md
- [[F1 Monte Carlo Simulator]] - document - PRD.md
- [[FastAPI Application]] - document - PRD.md
- [[FastAPI Dependency]] - document - requirements.txt
- [[FastF1 Client]] - document - PRD.md
- [[FastF1 Library Dependency]] - document - requirements.txt
- [[Known Gotchas & Pitfalls]] - document - CLAUDE.md
- [[Monte Carlo Simulation Core]] - document - PRD.md
- [[NumPy Dependency]] - document - requirements.txt
- [[SQLAlchemy Async Dependency]] - document - requirements.txt
- [[WebSocket Progress Endpoint]] - document - PRD.md

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Architecture_Docs_&_Config_Rules
SORT file.name ASC
```

## Connections to other communities
- 1 edge to [[_COMMUNITY_Simulation Spec & Data Shapes]]

## Top bridge nodes
- [[Celery Task Queue]] - degree 6, connects to 1 community