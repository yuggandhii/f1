---
source_file: "scripts\seed_db.py"
type: "rationale"
community: "ORM Models & DB Layer"
location: "L206"
tags:
  - graphify/rationale
  - graphify/INFERRED
  - community/ORM_Models_&_DB_Layer
---

# Insert race results that are not already in the DB.     Returns the number of ro

## Connections
- [[Circuit]] - `uses` [INFERRED]
- [[Driver]] - `uses` [INFERRED]
- [[DriverRating]] - `uses` [INFERRED]
- [[DriverRating_1]] - `uses` [INFERRED]
- [[RaceResult]] - `uses` [INFERRED]
- [[Team]] - `uses` [INFERRED]
- [[_upsert_race_results()_1]] - `rationale_for` [EXTRACTED]

#graphify/rationale #graphify/INFERRED #community/ORM_Models_&_DB_Layer