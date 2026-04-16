---
source_file: "app\api\simulations.py"
type: "rationale"
community: "API Routers & Schemas"
location: "L77"
tags:
  - graphify/rationale
  - graphify/INFERRED
  - community/API_Routers_&_Schemas
---

# Return WDC probabilities per driver for a completed run.

## Connections
- [[SimulationResult]] - `uses` [INFERRED]
- [[SimulationRun]] - `uses` [INFERRED]
- [[get_driver_probabilities()]] - `rationale_for` [EXTRACTED]

#graphify/rationale #graphify/INFERRED #community/API_Routers_&_Schemas