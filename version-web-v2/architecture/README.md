# Architecture – Web v2

This document expands the Web v2 architecture in detail.

## Intent
Web v2 is the "cloud-first" web version. It keeps the same user-facing behaviours as Web v1 but moves most of the intelligence from local services to Google Cloud, while preserving a local fallback path.

## Components

### Frontend (Next.js + React)
- Reuses Web v1 UI (chat, itinerary, preferences).
- May add subtle indicators for "cloud-powered" features (e.g. a badge when Vertex AI is used).

### Backend API (Node.js + TypeScript)
- Continues to expose `POST /plan` and `GET /itinerary/:id`.
- Adds a **cloud AI gateway** layer that decides whether to call cloud agents or fall back to local llama.cpp.
- Adds **cloud RAG service** that talks to Vertex AI Vector Search or AlloyDB.

### Google Cloud – AI and Data
- **Vertex AI + Gemini**: primary LLM for planning itineraries when cloud is available.
- **Agent Development Kit (ADK)**: defines and orchestrates agents such as Route Planner, Place Selector, City Insight.
- **Vertex AI Vector Search / AlloyDB**: host embeddings and support semantic search over a larger HK place corpus.
- **BigQuery**: stores anonymised analytics (e.g. popular routes, frequently rejected suggestions) for later insights.

### Routing
- **Google Maps Directions API**:
  - Provides road-aware routes, travel times, and possibly transit suggestions.
  - Replaces or augments OpenRouteService.

### Storage
- **PostgreSQL / AlloyDB**:
  - Store core entities: places, itineraries, itinerary items.
  - AlloyDB may be introduced as managed Postgres in Google Cloud.

## Data Flow (Cloud Path)
1. Frontend sends `POST /plan` with text + preferences.
2. Backend's AI gateway:
   - Calls cloud RAG to retrieve candidate places from Vector Search.
   - Sends text, preferences, and candidate places to ADK-defined agents.
3. Cloud agents (Vertex AI + ADK) return a planned itinerary and recommended places.
4. Backend calls Google Maps Directions API to obtain routes and travel times.
5. Backend writes data into PostgreSQL/AlloyDB.
6. Backend returns itinerary data to frontend; frontend renders list + map.

## Fallback Path
If cloud services fail (rate limit, network issues):
- AI gateway falls back to Web v1 local path:
  - Local RAG over pgvector.
  - Local llama.cpp Planning Agent.
  - OpenRouteService for routing.

## Design Rationale
- Aligns architecture with hackathon's Google Cloud requirements (Vertex AI, ADK, BigQuery, etc.).
- Keeps local tools in place as a safety net so development remains robust even when cloud is unstable.
- Uses AI gateway abstraction to avoid duplicating logic in frontend; web app sees the same `/plan` API regardless of engine.

Web v2 should make it clear to judges that your project can scale from local to cloud architecture without rewriting the entire stack.
