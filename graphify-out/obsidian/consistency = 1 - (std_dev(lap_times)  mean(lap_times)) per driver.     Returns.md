---
source_file: "app\ingestion\transformers.py"
type: "rationale"
community: "Driver Rating Transformers"
location: "L95"
tags:
  - graphify/rationale
  - graphify/EXTRACTED
  - community/Driver_Rating_Transformers
---

# consistency = 1 - (std_dev(lap_times) / mean(lap_times)) per driver.     Returns

## Connections
- [[_compute_consistency()]] - `rationale_for` [EXTRACTED]

#graphify/rationale #graphify/EXTRACTED #community/Driver_Rating_Transformers