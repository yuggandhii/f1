---
type: community
cohesion: 0.13
members: 47
---

# ORM Models & DB Layer

**Cohesion:** 0.13 - loosely connected
**Members:** 47 nodes

## Members
- [[.__repr__()]] - code - app\models\circuit.py
- [[.__repr__()_1]] - code - app\models\driver.py
- [[.__repr__()_2]] - code - app\models\driver_rating.py
- [[.__repr__()_3]] - code - app\models\race_result.py
- [[.__repr__()_6]] - code - app\models\team.py
- [[Base_1]] - code
- [[Bulk-insert race results, skipping already-existing records.]] - rationale - app\ingestion\tasks.py
- [[Circuit]] - code - app\models\circuit.py
- [[Driver]] - code - app\models\driver.py
- [[DriverRating_1]] - code - app\models\driver_rating.py
- [[DriverRating]] - code - app\ingestion\transformers.py
- [[Ensure every circuit from the season calendar exists in the circuits table.]] - rationale - scripts\seed_db.py
- [[Ensure every constructor from results_df exists in the teams table.     Returns]] - rationale - scripts\seed_db.py
- [[Ensure every driver from results_df exists in the drivers table.     Returns er]] - rationale - scripts\seed_db.py
- [[Fetch and persist a full season of data.      Steps       1. Fetch Ergast races]] - rationale - app\ingestion\tasks.py
- [[Full ingestion + ratings pipeline for one season.     Returns a summary dict.]] - rationale - scripts\seed_db.py
- [[Insert or update circuits.     Returns dict mapping circuit_ref → DB UUID.]] - rationale - app\ingestion\tasks.py
- [[Insert or update driver_ratings rows.     Returns number of rows upserted.]] - rationale - scripts\seed_db.py
- [[Insert or update drivers.     Returns dict mapping ergast driver_id → DB UUID.]] - rationale - app\ingestion\tasks.py
- [[Insert or update teams from Ergast constructor data.     Returns dict mapping e]] - rationale - app\ingestion\tasks.py
- [[Insert race results that are not already in the DB.     Returns the number of ro]] - rationale - scripts\seed_db.py
- [[ORM models — import all here so Alembic autogenerate sees them.]] - rationale - app\models\__init__.py
- [[Print row counts for all key tables and check minimum requirements.     Returns]] - rationale - scripts\seed_db.py
- [[RaceResult]] - code - app\models\race_result.py
- [[Recompute and upsert driver_ratings for a season.      Reads from cached Parquet]] - rationale - app\ingestion\tasks.py
- [[Return a single driver by ID.]] - rationale - app\api\drivers.py
- [[Return all active drivers.]] - rationale - app\api\drivers.py
- [[Return historical race results for a driver.  Full impl in Phase 4.]] - rationale - app\api\drivers.py
- [[Team]] - code - app\models\team.py
- [[Yield a sync DB session; commit on success, rollback on error.]] - rationale - app\ingestion\tasks.py
- [[__init__.py_4]] - code - app\models\__init__.py
- [[_parse_args()]] - code - scripts\seed_db.py
- [[_upsert_circuits()_1]] - code - scripts\seed_db.py
- [[_upsert_driver_ratings()]] - code - scripts\seed_db.py
- [[_upsert_drivers()_1]] - code - scripts\seed_db.py
- [[_upsert_race_results()_1]] - code - scripts\seed_db.py
- [[_upsert_teams()_1]] - code - scripts\seed_db.py
- [[appapidrivers.py — Driver endpoints (Phase 4 full impl; Phase 0 stub).]] - rationale - app\api\drivers.py
- [[appsimulationtasks.py — Celery simulation tasks (Phase 2 implementation).]] - rationale - app\simulation\tasks.py
- [[drivers.py]] - code - app\api\drivers.py
- [[get_driver()]] - code - app\api\drivers.py
- [[get_driver_history()]] - code - app\api\drivers.py
- [[list_drivers()]] - code - app\api\drivers.py
- [[scriptsseed_db.py — Standalone DB seed script. No Celery broker required.  Fetc]] - rationale - scripts\seed_db.py
- [[seed_db.py]] - code - scripts\seed_db.py
- [[seed_season()]] - code - scripts\seed_db.py
- [[verify_db()]] - code - scripts\seed_db.py

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/ORM_Models_&_DB_Layer
SORT file.name ASC
```

## Connections to other communities
- 16 edges to [[_COMMUNITY_Data Ingestion Pipeline]]
- 13 edges to [[_COMMUNITY_API Routers & Schemas]]
- 3 edges to [[_COMMUNITY_Driver Rating Transformers]]
- 1 edge to [[_COMMUNITY_Circuit API Endpoints]]
- 1 edge to [[_COMMUNITY_Celery Simulation Tasks]]
- 1 edge to [[_COMMUNITY_Pydantic Schemas & Endpoints]]

## Top bridge nodes
- [[Driver]] - degree 27, connects to 3 communities
- [[Circuit]] - degree 24, connects to 3 communities
- [[RaceResult]] - degree 27, connects to 2 communities
- [[Team]] - degree 23, connects to 2 communities
- [[seed_season()]] - degree 12, connects to 2 communities