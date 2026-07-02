# Backend – Web v1

This document describes backend changes for Web v1.

## Additions
- Preference validation layer inside `POST /plan`.
- RAG service that:
  - Embeds the query.
  - Performs pgvector similarity search over `places_embeddings`.

## Route Changes
- `POST /plan`
  - Now accepts `{ text, preferences }`.
  - Calls `ragService` before `llmGateway`.

The backend remains a single service but gains richer context preparation before calling the Planning Agent.
