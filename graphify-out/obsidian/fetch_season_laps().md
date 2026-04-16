---
source_file: "app\ingestion\fastf1_client.py"
type: "code"
community: "Data Ingestion Pipeline"
location: "L143"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/Data_Ingestion_Pipeline
---

# fetch_season_laps()

## Connections
- [[Fetch lap data for multiple rounds.  Returns dict round → laps DataFrame.     F]] - `rationale_for` [EXTRACTED]
- [[fastf1_client.py]] - `contains` [EXTRACTED]
- [[fetch_race_laps()]] - `calls` [EXTRACTED]
- [[fetch_season()]] - `calls` [INFERRED]
- [[refresh_driver_ratings()]] - `calls` [INFERRED]
- [[seed_season()]] - `calls` [INFERRED]

#graphify/code #graphify/EXTRACTED #community/Data_Ingestion_Pipeline