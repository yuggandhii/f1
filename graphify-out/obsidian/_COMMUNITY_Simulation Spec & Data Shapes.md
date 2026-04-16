---
type: community
cohesion: 0.12
members: 17
---

# Simulation Spec & Data Shapes

**Cohesion:** 0.12 - loosely connected
**Members:** 17 nodes

## Members
- [[Analytics Aggregator]] - document - PRD.md
- [[Backtest Validation (2023 Season)]] - document - PRD.md
- [[Championship Probability Dashboard]] - document - PRD.md
- [[Driver Rating Formula]] - document - PRD.md
- [[Driver Rating Transformers]] - document - PRD.md
- [[DriverRating Dataclass]] - document - PRD.md
- [[F1 Points System]] - document - PRD.md
- [[Key Data Shapes Specification]] - document - CLAUDE.md
- [[Output Aggregation (WDC Probability)]] - document - PRD.md
- [[Parquet Cache (Simulation Output)]] - document - PRD.md
- [[Parquet File Path Convention]] - document - CLAUDE.md
- [[Performance Model (sample_race_pace)]] - document - PRD.md
- [[ProcessPoolExecutor Parallelism]] - document - PRD.md
- [[Season Simulator Loop]] - document - PRD.md
- [[Single Race Simulator]] - document - PRD.md
- [[What-If Scenario Engine]] - document - PRD.md
- [[What-If Scenario View]] - document - PRD.md

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Simulation_Spec_&_Data_Shapes
SORT file.name ASC
```

## Connections to other communities
- 1 edge to [[_COMMUNITY_Architecture Docs & Config Rules]]

## Top bridge nodes
- [[Driver Rating Transformers]] - degree 2, connects to 1 community