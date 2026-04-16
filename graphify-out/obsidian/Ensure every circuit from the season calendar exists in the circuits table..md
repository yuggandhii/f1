---
source_file: "scripts\seed_db.py"
type: "rationale"
community: "ORM Models & DB Layer"
location: "L104"
tags:
  - graphify/rationale
  - graphify/INFERRED
  - community/ORM_Models_&_DB_Layer
---

# Ensure every circuit from the season calendar exists in the circuits table.

## Connections
- [[Circuit]] - `uses` [INFERRED]
- [[Driver]] - `uses` [INFERRED]
- [[DriverRating]] - `uses` [INFERRED]
- [[DriverRating_1]] - `uses` [INFERRED]
- [[RaceResult]] - `uses` [INFERRED]
- [[Team]] - `uses` [INFERRED]
- [[_upsert_circuits()_1]] - `rationale_for` [EXTRACTED]

#graphify/rationale #graphify/INFERRED #community/ORM_Models_&_DB_Layer