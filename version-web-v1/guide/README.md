# Guide – Web v1

This document describes what the first web iteration (Web v1) adds on top of the MVP in concrete detail.

## Goal
Web v1 upgrades the MVP from "working pipeline" to "personally meaningful" itineraries without introducing cloud complexity yet. Concretely, Web v1 should:
- Capture basic user preferences (walking speed, categories, budget, crowd tolerance) in a lightweight way.
- Use a local RAG layer over a seeded Kowloon place corpus to select better candidate spots.
- Feed those candidates + preferences into the Planning Agent so output itineraries feel tailored instead of generic.

## Scope and Constraints
- Region: still Kowloon only, but with a larger place dataset (dozens to hundreds of spots).
- No full accounts; preferences are session-scoped or stored in browser storage.
- LLM remains local (llama.cpp) to avoid API key burn-in during experimentation.
- RAG is implemented using PostgreSQL + pgvector and locally generated embeddings.
- Routing still uses OpenRouteService to keep infra consistent with MVP.

## Behavioural Expectations
A typical Web v1 run should:
1. Let the user express preferences (e.g. "I walk slowly and prefer quiet museums and cheap cafes").
2. Use those preferences to bias which places are selected from the local corpus.
3. Produce an itinerary where stops reflect those preferences (e.g. fewer far walks, more budget-friendly places).
4. Keep latency acceptable (planning completes within a few seconds on local hardware).

## Success Criteria
- Judges can see that changing preferences leads to visibly different itineraries for the same text prompt.
- Planning remains deterministic enough that debugging is possible (e.g. logging which candidate places were considered).
- The system remains local and self-contained, ready for cloud migration in Web v2.
