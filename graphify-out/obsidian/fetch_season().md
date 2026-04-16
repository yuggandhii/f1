---
source_file: "app\ingestion\tasks.py"
type: "code"
community: "Data Ingestion Pipeline"
location: "L247"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/Data_Ingestion_Pipeline
---

# fetch_season()

## Connections
- [[Fetch and persist a full season of data.      Steps       1. Fetch Ergast races]] - `rationale_for` [EXTRACTED]
- [[_db()]] - `calls` [EXTRACTED]
- [[_upsert_circuits()]] - `calls` [EXTRACTED]
- [[_upsert_drivers()]] - `calls` [EXTRACTED]
- [[_upsert_race_results()]] - `calls` [EXTRACTED]
- [[_upsert_teams()]] - `calls` [EXTRACTED]
- [[fetch_race_weather()]] - `calls` [INFERRED]
- [[fetch_season_laps()]] - `calls` [INFERRED]
- [[fetch_season_qualifying()]] - `calls` [INFERRED]
- [[fetch_season_races()]] - `calls` [INFERRED]
- [[fetch_season_results()]] - `calls` [INFERRED]
- [[tasks.py]] - `contains` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/Data_Ingestion_Pipeline