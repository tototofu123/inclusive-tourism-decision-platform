# Architecture — Web v2

## Request Flow

```
Browser
  │
  │  POST /api/itinerary  { userQuery, userProfile, location, durationHours }
  ▼
Next.js API Route  (unchanged from v1)
  │
  ▼
Express Backend  :4000
  │
  └→ cloudAiGateway.generateItinerary()
       │
       ├─ [VERTEX_AI_ENABLED=true]
       │    │
       │    ├→ adkAgents.runAdkPipeline()
       │    │    ├→ Agent 1: PlaceSelector
       │    │    │    └→ cloudRag.queryCandidatePlaces()  ←─ Vertex AI Vector Search
       │    │    │    └→ Gemini re-rank + select
       │    │    ├→ Agent 2: RoutePlanner
       │    │    │    └→ mapsDirections.getDirections()  ←─ Google Maps Directions API
       │    │    └→ Agent 3: CityInsight
       │    │         └→ Gemini enrich with accessibility notes
       │    │
       │    └→ [on any error] → localFallback()
       │
       ├─ [VERTEX_AI_ENABLED=false]
       │    └→ localFallback()  ←─ llama.cpp + SQLite (v1 code)
       │
       └→ bigqueryLogger.logEvent()  ← fire-and-forget, never blocks
```

## Service Ports

| Service | Port | Start Command |
|---|---|---|
| Frontend (Next.js) | 3000 | `npm run dev` in `frontend/` |
| Backend (Express) | 4000 | `npm run dev` in `backend/` |
| AI Gateway | embedded in backend | — |

## Scalability Notes

- **Stateless backend** — all state in AlloyDB. Multiple backend instances behind Cloud Run or GKE load balancer with no coordination needed.
- **Gateway pattern** — swap LLM provider by changing one env var (`VERTEX_AI_ENABLED`). Frontend is completely isolated from this change.
- **Async analytics** — BigQuery writes are fire-and-forget. Analytics never adds latency to user requests.
- **Vector index** — AlloyDB pgvector IVFFlat index supports ~millions of place embeddings. Vertex AI Vector Search scales to billions.
- **RAG fallback chain** — Vector Search → AlloyDB pgvector → SQLite LIKE (v1). Three levels of degradation before a hard failure.
