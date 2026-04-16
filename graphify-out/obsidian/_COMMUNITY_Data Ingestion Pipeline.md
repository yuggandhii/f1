---
type: community
cohesion: 0.10
members: 36
---

# Data Ingestion Pipeline

**Cohesion:** 0.10 - loosely connected
**Members:** 36 nodes

## Members
- [[Collect all pages from a paginated Ergast endpoint.]] - rationale - app\ingestion\ergast_client.py
- [[Enable FastF1's on-disk cache. Must be called before any session load.]] - rationale - app\ingestion\fastf1_client.py
- [[Fetch lap data for multiple rounds.  Returns dict round → laps DataFrame.     F]] - rationale - app\ingestion\fastf1_client.py
- [[HTTP GET with exponential backoff on 4295xx.]] - rationale - app\ingestion\ergast_client.py
- [[Load a FastF1 session, returning None on any failure.]] - rationale - app\ingestion\fastf1_client.py
- [[Return (is_dnf, dnf_cause) from an Ergast status string.]] - rationale - app\ingestion\ergast_client.py
- [[Return a DataFrame of all race results for a season.      Columns round, season]] - rationale - app\ingestion\ergast_client.py
- [[Return a DataFrame of all races in a season.      Columns round, season, race_n]] - rationale - app\ingestion\ergast_client.py
- [[Return a DataFrame of qualifying results for a season.      Columns round, seas]] - rationale - app\ingestion\ergast_client.py
- [[Return a cleaned DataFrame of all race laps for a session.      Columns]] - rationale - app\ingestion\fastf1_client.py
- [[Return the dominant weather condition for a race session.      Returns one of ']] - rationale - app\ingestion\fastf1_client.py
- [[_cache_dir()]] - code - app\ingestion\ergast_client.py
- [[_classify_dnf()]] - code - app\ingestion\ergast_client.py
- [[_db()]] - code - app\ingestion\tasks.py
- [[_ensure_cache()]] - code - app\ingestion\fastf1_client.py
- [[_get_json()]] - code - app\ingestion\ergast_client.py
- [[_load_session()]] - code - app\ingestion\fastf1_client.py
- [[_paginate()]] - code - app\ingestion\ergast_client.py
- [[_parquet_dir()]] - code - app\ingestion\fastf1_client.py
- [[_upsert_circuits()]] - code - app\ingestion\tasks.py
- [[_upsert_drivers()]] - code - app\ingestion\tasks.py
- [[_upsert_race_results()]] - code - app\ingestion\tasks.py
- [[_upsert_teams()]] - code - app\ingestion\tasks.py
- [[appingestionergast_client.py — Synchronous ErgastJolpica API client.  Fetches]] - rationale - app\ingestion\ergast_client.py
- [[appingestionfastf1_client.py — Synchronous FastF1 data client.  Fetches lap te]] - rationale - app\ingestion\fastf1_client.py
- [[ergast_client.py]] - code - app\ingestion\ergast_client.py
- [[fastf1_client.py]] - code - app\ingestion\fastf1_client.py
- [[fetch_race_laps()]] - code - app\ingestion\fastf1_client.py
- [[fetch_race_weather()]] - code - app\ingestion\fastf1_client.py
- [[fetch_season()]] - code - app\ingestion\tasks.py
- [[fetch_season_laps()]] - code - app\ingestion\fastf1_client.py
- [[fetch_season_qualifying()]] - code - app\ingestion\ergast_client.py
- [[fetch_season_races()]] - code - app\ingestion\ergast_client.py
- [[fetch_season_results()]] - code - app\ingestion\ergast_client.py
- [[refresh_driver_ratings()]] - code - app\ingestion\tasks.py
- [[tasks.py]] - code - app\ingestion\tasks.py

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Data_Ingestion_Pipeline
SORT file.name ASC
```

## Connections to other communities
- 16 edges to [[_COMMUNITY_ORM Models & DB Layer]]
- 2 edges to [[_COMMUNITY_Driver Rating Transformers]]
- 1 edge to [[_COMMUNITY_FastAPI App & Database Session]]

## Top bridge nodes
- [[tasks.py]] - degree 11, connects to 2 communities
- [[refresh_driver_ratings()]] - degree 8, connects to 2 communities
- [[fetch_season()]] - degree 12, connects to 1 community
- [[fetch_season_results()]] - degree 8, connects to 1 community
- [[fetch_season_races()]] - degree 7, connects to 1 community