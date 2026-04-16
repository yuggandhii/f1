---
type: community
cohesion: 1.00
members: 2
---

# Celery Worker Instance

**Cohesion:** 1.00 - tightly connected
**Members:** 2 nodes

## Members
- [[appworker.py — Celery application instance.  All Celery tasks are auto-discover]] - rationale - app\worker.py
- [[worker.py]] - code - app\worker.py

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Celery_Worker_Instance
SORT file.name ASC
```
