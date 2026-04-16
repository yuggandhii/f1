---
type: community
cohesion: 0.11
members: 19
---

# FastAPI App & Database Session

**Cohesion:** 0.11 - loosely connected
**Members:** 19 nodes

## Members
- [[Convert async DSN (asyncpg) to sync DSN (psycopg2).]] - rationale - app\database.py
- [[Create the async engine.  NullPool is used in test env to avoid     connection p]] - rationale - app\database.py
- [[Dispose connection pool on shutdown.]] - rationale - app\database.py
- [[Verify DB connectivity on startup (does NOT create tables — use Alembic).]] - rationale - app\database.py
- [[Yield an async session; commit on success, rollback on error.]] - rationale - app\database.py
- [[_build_engine()]] - code - app\database.py
- [[_get_db()]] - code - app\api\deps.py
- [[_sync_database_url()]] - code - app\database.py
- [[appapideps.py — FastAPI dependency injectors.  All database sessions and share]] - rationale - app\api\deps.py
- [[appdatabase.py — Async SQLAlchemy engine and session factory.  Usage inside Fas]] - rationale - app\database.py
- [[appmain.py — FastAPI application factory + lifespan.  The lifespan context mana]] - rationale - app\main.py
- [[close_db()]] - code - app\database.py
- [[create_app()]] - code - app\main.py
- [[database.py]] - code - app\database.py
- [[deps.py]] - code - app\api\deps.py
- [[get_session()]] - code - app\database.py
- [[init_db()]] - code - app\database.py
- [[lifespan()]] - code - app\main.py
- [[main.py]] - code - app\main.py

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/FastAPI_App_&_Database_Session
SORT file.name ASC
```

## Connections to other communities
- 1 edge to [[_COMMUNITY_API Routers & Schemas]]
- 1 edge to [[_COMMUNITY_Data Ingestion Pipeline]]

## Top bridge nodes
- [[database.py]] - degree 7, connects to 1 community
- [[get_session()]] - degree 4, connects to 1 community