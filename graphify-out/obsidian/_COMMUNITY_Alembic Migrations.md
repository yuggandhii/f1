---
type: community
cohesion: 0.33
members: 7
---

# Alembic Migrations

**Cohesion:** 0.33 - loosely connected
**Members:** 7 nodes

## Members
- [[Create async engine and run migrations within an async context.]] - rationale - alembic\env.py
- [[alembicenv.py — Alembic migration environment.  Uses async SQLAlchemy so migrat]] - rationale - alembic\env.py
- [[do_run_migrations()]] - code - alembic\env.py
- [[env.py]] - code - alembic\env.py
- [[run_async_migrations()]] - code - alembic\env.py
- [[run_migrations_offline()]] - code - alembic\env.py
- [[run_migrations_online()]] - code - alembic\env.py

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Alembic_Migrations
SORT file.name ASC
```

## Connections to other communities
- 2 edges to [[_COMMUNITY_API Routers & Schemas]]

## Top bridge nodes
- [[alembicenv.py — Alembic migration environment.  Uses async SQLAlchemy so migrat]] - degree 2, connects to 1 community
- [[Create async engine and run migrations within an async context.]] - degree 2, connects to 1 community