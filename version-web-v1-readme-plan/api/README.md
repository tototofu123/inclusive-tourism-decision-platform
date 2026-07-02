# API – Web v1

This document specifies API changes for Web v1.

## `POST /plan`
- Request body now includes preferences:
  ```json
  {
    "text": "Trip description",
    "preferences": {
      "walking_speed": "slow",
      "categories": ["museum", "cafe"],
      "budget_level": "low",
      "crowd_tolerance": "low"
    }
  }
  ```

Response shape remains similar, but planning logic uses preferences internally.
