---
source_file: "scripts\seed_db.py"
type: "rationale"
community: "ORM Models & DB Layer"
location: "L269"
tags:
  - graphify/rationale
  - graphify/INFERRED
  - community/ORM_Models_&_DB_Layer
---

# Insert or update driver_ratings rows.     Returns number of rows upserted.

## Connections
- [[Circuit]] - `uses` [INFERRED]
- [[Driver]] - `uses` [INFERRED]
- [[DriverRating]] - `uses` [INFERRED]
- [[DriverRating_1]] - `uses` [INFERRED]
- [[RaceResult]] - `uses` [INFERRED]
- [[Team]] - `uses` [INFERRED]
- [[_upsert_driver_ratings()]] - `rationale_for` [EXTRACTED]

#graphify/rationale #graphify/INFERRED #community/ORM_Models_&_DB_Layer