---
source_file: "app\ingestion\tasks.py"
type: "rationale"
community: "ORM Models & DB Layer"
location: "L137"
tags:
  - graphify/rationale
  - graphify/INFERRED
  - community/ORM_Models_&_DB_Layer
---

# Insert or update drivers.     Returns: dict mapping ergast driver_id → DB UUID.

## Connections
- [[Circuit]] - `uses` [INFERRED]
- [[Driver]] - `uses` [INFERRED]
- [[DriverRating_1]] - `uses` [INFERRED]
- [[RaceResult]] - `uses` [INFERRED]
- [[Team]] - `uses` [INFERRED]
- [[_upsert_drivers()]] - `rationale_for` [EXTRACTED]

#graphify/rationale #graphify/INFERRED #community/ORM_Models_&_DB_Layer