---
source_file: "app\ingestion\tasks.py"
type: "rationale"
community: "ORM Models & DB Layer"
location: "L334"
tags:
  - graphify/rationale
  - graphify/INFERRED
  - community/ORM_Models_&_DB_Layer
---

# Recompute and upsert driver_ratings for a season.      Reads from cached Parquet

## Connections
- [[Circuit]] - `uses` [INFERRED]
- [[Driver]] - `uses` [INFERRED]
- [[DriverRating_1]] - `uses` [INFERRED]
- [[RaceResult]] - `uses` [INFERRED]
- [[Team]] - `uses` [INFERRED]
- [[refresh_driver_ratings()]] - `rationale_for` [EXTRACTED]

#graphify/rationale #graphify/INFERRED #community/ORM_Models_&_DB_Layer