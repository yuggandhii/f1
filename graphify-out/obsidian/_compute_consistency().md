---
source_file: "app\ingestion\transformers.py"
type: "code"
community: "Driver Rating Transformers"
location: "L94"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/Driver_Rating_Transformers
---

# _compute_consistency()

## Connections
- [[_min_max_normalise()]] - `calls` [EXTRACTED]
- [[compute_driver_ratings()]] - `calls` [EXTRACTED]
- [[consistency = 1 - (std_dev(lap_times)  mean(lap_times)) per driver.     Returns]] - `rationale_for` [EXTRACTED]
- [[transformers.py]] - `contains` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/Driver_Rating_Transformers