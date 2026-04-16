---
type: community
cohesion: 0.50
members: 4
---

# DB Migration (Initial Schema)

**Cohesion:** 0.50 - moderately connected
**Members:** 4 nodes

## Members
- [[0001_initial_schema.py]] - code - alembic\versions\0001_initial_schema.py
- [[Initial schema — all tables  Revision ID 0001 Revises Create Date 2026-04-16]] - rationale - alembic\versions\0001_initial_schema.py
- [[downgrade()]] - code - alembic\versions\0001_initial_schema.py
- [[upgrade()]] - code - alembic\versions\0001_initial_schema.py

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/DB_Migration_(Initial_Schema)
SORT file.name ASC
```
