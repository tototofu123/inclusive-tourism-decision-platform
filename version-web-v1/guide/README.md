# Guide – Web v1

This document describes what the first web iteration (Web v1) adds on top of the MVP.

## Goal
Extend the MVP so the system can:
- Understand basic user preferences (walking speed, categories, rough budget, crowd tolerance) without full login.
- Use a stronger local RAG layer over a larger seeded dataset of Kowloon places.
- Produce itineraries that feel more personalised while still running fully on local / free-tier infrastructure.

## Scope
- Region still focused on Kowloon, but with more places and better metadata.
- Preferences are session-scoped (stored with a temporary id or in local storage), not full accounts.
- LLM remains local (llama.cpp); no Google Cloud yet.
- RAG uses PostgreSQL + pgvector with embeddings generated locally.

## Success Criteria
- A user can set simple preferences (e.g. "prefer quiet museums", "walk slowly", "budget-friendly") and see them reflected in the proposed itinerary.
- The system selects places from a seeded dataset using semantic similarity instead of naive category matching.
- Planning remains fast and reliable enough for hackathon demos.
