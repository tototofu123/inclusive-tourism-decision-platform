# Flow – Web v1

This document describes the execution flow for Web v1.

## High-Level Steps
1. **User opens the app** and optionally sets preferences via a simple UI or conversational prompts.
2. **User enters a trip description** on the chat page.
3. **Frontend sends `POST /plan`** with both `text` and `preferences` to the backend.
4. **Backend runs a RAG query**:
   - Embeds the query.
   - Uses pgvector to retrieve candidate places from `places_embeddings`.
5. **Backend calls the Planning Agent (llama.cpp)** with:
   - User text.
   - Preferences JSON.
   - Candidate places list.
6. **LLM returns explanation + itinerary JSON**, potentially referencing specific `place_id`s.
7. **Backend resolves any remaining abstract stops** to concrete places using the candidate list.
8. **Backend routes via OpenRouteService**, writes data to PostgreSQL, and returns the final itinerary.
9. **Frontend renders itinerary and map** as in MVP.

## Error and Fallbacks
- If RAG returns too few places, backend can fall back to category-based lookup.
- If preferences are missing, backend assumes defaults and proceeds.

The Web v1 flow is almost identical to MVP, but inserts a RAG + preference step before calling the agent.
