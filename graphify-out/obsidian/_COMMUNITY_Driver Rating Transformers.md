---
type: community
cohesion: 0.15
members: 21
---

# Driver Rating Transformers

**Cohesion:** 0.15 - loosely connected
**Members:** 21 nodes

## Members
- [[Compute normalised driver ratings for a season.      Args         season F1 se]] - rationale - app\ingestion\transformers.py
- [[Median race lap time per driver, normalised (lower time = higher score).     Fal]] - rationale - app\ingestion\transformers.py
- [[Normalise a Series to 0, 1.  invert=True for metrics where lower = better.]] - rationale - app\ingestion\transformers.py
- [[Wet skill = relative pace improvement (or degradation) in wet vs dry.     dry_pa]] - rationale - app\ingestion\transformers.py
- [[_compute_base_pace()]] - code - app\ingestion\transformers.py
- [[_compute_consistency()]] - code - app\ingestion\transformers.py
- [[_compute_dnf_rate()]] - code - app\ingestion\transformers.py
- [[_compute_overtake_skill()]] - code - app\ingestion\transformers.py
- [[_compute_qualifying_edge()]] - code - app\ingestion\transformers.py
- [[_compute_tyre_management()]] - code - app\ingestion\transformers.py
- [[_compute_wet_skill()]] - code - app\ingestion\transformers.py
- [[_min_max_normalise()]] - code - app\ingestion\transformers.py
- [[_safe_mean()]] - code - app\ingestion\transformers.py
- [[appingestiontransformers.py — Driver rating computation from raw data.  Takes]] - rationale - app\ingestion\transformers.py
- [[compute_driver_ratings()]] - code - app\ingestion\transformers.py
- [[consistency = 1 - (std_dev(lap_times)  mean(lap_times)) per driver.     Returns]] - rationale - app\ingestion\transformers.py
- [[dnf_rate = weighted DNF fraction across trailing 3 seasons.     Weights current]] - rationale - app\ingestion\transformers.py
- [[overtake_skill = mean(grid - finish) weighted by circuit overtake_difficulty.]] - rationale - app\ingestion\transformers.py
- [[qualifying_edge = 1 - median(grid_position  field_size).     1.0 = always on po]] - rationale - app\ingestion\transformers.py
- [[transformers.py]] - code - app\ingestion\transformers.py
- [[tyre_management = avg driver stint length  avg team stint length.     Drivers w]] - rationale - app\ingestion\transformers.py

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Driver_Rating_Transformers
SORT file.name ASC
```

## Connections to other communities
- 3 edges to [[_COMMUNITY_ORM Models & DB Layer]]
- 2 edges to [[_COMMUNITY_Data Ingestion Pipeline]]

## Top bridge nodes
- [[transformers.py]] - degree 13, connects to 2 communities
- [[compute_driver_ratings()]] - degree 12, connects to 2 communities