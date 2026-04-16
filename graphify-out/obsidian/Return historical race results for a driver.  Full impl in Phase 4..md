---
source_file: "app\api\drivers.py"
type: "rationale"
community: "ORM Models & DB Layer"
location: "L50"
tags:
  - graphify/rationale
  - graphify/INFERRED
  - community/ORM_Models_&_DB_Layer
---

# Return historical race results for a driver.  Full impl in Phase 4.

## Connections
- [[Driver]] - `uses` [INFERRED]
- [[RaceResult]] - `uses` [INFERRED]
- [[get_driver_history()]] - `rationale_for` [EXTRACTED]

#graphify/rationale #graphify/INFERRED #community/ORM_Models_&_DB_Layer