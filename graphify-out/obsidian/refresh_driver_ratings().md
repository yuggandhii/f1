---
source_file: "app\ingestion\tasks.py"
type: "code"
community: "Data Ingestion Pipeline"
location: "L333"
tags:
  - graphify/code
  - graphify/INFERRED
  - community/Data_Ingestion_Pipeline
---

# refresh_driver_ratings()

## Connections
- [[Recompute and upsert driver_ratings for a season.      Reads from cached Parquet]] - `rationale_for` [EXTRACTED]
- [[_db()]] - `calls` [EXTRACTED]
- [[compute_driver_ratings()]] - `calls` [INFERRED]
- [[fetch_race_weather()]] - `calls` [INFERRED]
- [[fetch_season_laps()]] - `calls` [INFERRED]
- [[fetch_season_races()]] - `calls` [INFERRED]
- [[fetch_season_results()]] - `calls` [INFERRED]
- [[tasks.py]] - `contains` [EXTRACTED]

#graphify/code #graphify/INFERRED #community/Data_Ingestion_Pipeline