---
type: community
cohesion: 0.33
members: 6
---

# Analytics Endpoints

**Cohesion:** 0.33 - loosely connected
**Members:** 6 nodes

## Members
- [[Head-to-head driver comparison.  Full implementation in Phase 5.]] - rationale - app\api\analytics.py
- [[analytics.py]] - code - app\api\analytics.py
- [[appapianalytics.py — Analytics endpoints (stub for Phase 0).]] - rationale - app\api\analytics.py
- [[head_to_head()]] - code - app\api\analytics.py
- [[season_trajectory()]] - code - app\api\analytics.py
- [[team_comparison()]] - code - app\api\analytics.py

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Analytics_Endpoints
SORT file.name ASC
```
