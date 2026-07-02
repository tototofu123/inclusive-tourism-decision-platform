# Agent – V1

This document defines the main agent behaviour for V1 and how it interacts with the rest of the system.

## Planning Agent
V1 uses a single primary agent: the **Planning Agent**.

### Responsibilities
- Accept raw user text describing a trip (e.g. "3 hours in Kowloon, I like museums and cafes").
- Normalize and interpret constraints (time window, number of stops, rough preferences) without requiring a separate form.
- Produce two outputs:
  1. A human-readable explanation of the plan.
  2. A machine-readable **itinerary JSON** following a fixed schema.

### Input
- `text`: free-form user description of desired trip.
- Optional internal context:
  - Default assumptions (e.g. 3–5 stops, 30–90 minutes per stop).
  - Region can be Kowloon, Hong Kong Island, or New Territories.

### Output JSON Schema (V1)
The agent should output JSON with this structure:

```json
{
  "stops": [
    {
      "label": "Morning museum",
      "category": "museum",
      "approx_duration_minutes": 90,
      "notes": "Prefer quieter museums if possible"
    },
    {
      "label": "Coffee break",
      "category": "cafe",
      "approx_duration_minutes": 45,
      "notes": "Not too crowded"
    }
  ],
  "total_duration_minutes": 240,
  "ordering_hint": "Start near MTR, alternate indoor/outdoor when possible"
}
```

The backend later maps `category` to real places using place APIs.

### Implementation
- Runs on **llama.cpp** with a prompt template that:
  - Explains the schema.
  - Asks the model to output both text and JSON.
  - Clearly separates the JSON (using markers) so the backend can parse it.

### Caveman / Ponytail Optimizations
- Caveman-style: keep prompts short and direct, avoid overthinking or over-technical wording.
- Ponytail-style: tidy the JSON, enforce schema, and strip any extra commentary.

V1 evolved to support 12 tool-calling functions (search, create, edit, delete, route, transport, etc.) with the LLM acting as a multi-round reasoning agent.
