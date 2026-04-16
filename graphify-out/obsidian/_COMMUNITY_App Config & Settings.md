---
type: community
cohesion: 0.20
members: 11
---

# App Config & Settings

**Cohesion:** 0.20 - loosely connected
**Members:** 11 nodes

## Members
- [[BaseSettings]] - code
- [[Return cached Settings singleton.  Use this in FastAPI deps.]] - rationale - app\config.py
- [[Settings]] - code - app\config.py
- [[appconfig.py — Pydantic settings loaded from environment  .env file.  All appl]] - rationale - app\config.py
- [[cache_dir()]] - code - app\config.py
- [[config.py]] - code - app\config.py
- [[cors_origins_list()]] - code - app\config.py
- [[ensure_path()]] - code - app\config.py
- [[get_settings()]] - code - app\config.py
- [[is_production()]] - code - app\config.py
- [[simulations_dir()]] - code - app\config.py

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/App_Config_&_Settings
SORT file.name ASC
```
