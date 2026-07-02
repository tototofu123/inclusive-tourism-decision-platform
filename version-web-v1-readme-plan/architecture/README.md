# Architecture – Web v1

This document describes the Web v1 architecture.

## Components Overview
- **Frontend**: same Next.js/React base as MVP, plus preference UI.
- **Backend**: same Node/TS API, plus preference handling and RAG service.
- **LLM**: local llama.cpp, now fed with richer context.
- **DB**: PostgreSQL with pgvector; larger `places` dataset.
- **Routing**: OpenRouteService.

## Data Flow
1. Preferences captured on frontend and sent along with trip text.
2. Backend runs RAG over `places_embeddings` to get candidate places.
3. Backend passes text, preferences, and candidate places to Planning Agent.
4. Agent returns enhanced itinerary JSON.
5. Backend resolves stops, routes legs, stores in DB, returns to frontend.

## Design Rationale
- Adding preferences and RAG at this stage improves quality without adding cloud complexity.
- Keeping llama.cpp local reduces infrastructure overhead during hackathon.

Web v1 is the "smart local" version that prepares the codebase for cloud migration in Web v2.
