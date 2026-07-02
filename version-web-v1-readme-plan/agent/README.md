# Agent – Web v1

This document defines the agent behaviour for Web v1.

## Agents
Web v1 keeps a single primary **Planning Agent**, but its context is richer:

### Planning Agent (v1)

#### Responsibilities
- Accept user text plus a preference object.
- Use RAG results (candidate places) as structured context.
- Produce an itinerary that:
  - Respects walking speed and total duration.
  - Prioritises categories and crowd preferences.

#### Input
- `text`: trip description.
- `preferences`: JSON object, e.g.:
  ```json
  {
    "walking_speed": "slow",
    "categories": ["museum", "cafe"],
    "budget_level": "medium",
    "crowd_tolerance": "low"
  }
  ```
- `candidate_places`: list of places from RAG query.

#### Output
- Same high-level schema as MVP, but stop entries may include `place_id` suggestions when the agent is confident.

#### Implementation
- Prompt template now includes a section listing candidate places with short descriptions and ids.
- Caveman/ponytail skills should keep prompts focused and enforce schema cleanliness.

Later versions may split out a dedicated "Preference Agent"; for Web v1, a single agent is sufficient.
