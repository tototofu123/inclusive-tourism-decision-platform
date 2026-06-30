# Backend — Web v2

The backend is a Node.js (TypeScript) Express server. v2 adds a cloud AI layer on top of the v1 local engine.

## File Map

```
backend/
├── src/
│   ├── server.ts                    Entry point, Express setup, pretty console UI
│   ├── routes/
│   │   ├── itinerary.ts             POST /api/itinerary
│   │   ├── places.ts                GET  /api/places
│   │   └── profile.ts               GET/POST /api/profile
│   └── services/
│       ├── cloudAiGateway.ts        Routes to Vertex AI or local llama.cpp
│       ├── cloudRag.ts              Queries Vector Search / AlloyDB pgvector
│       ├── adkAgents.ts             ADK multi-agent orchestration
│       ├── mapsDirections.ts        Google Maps Directions API wrapper
│       ├── bigqueryLogger.ts        Anonymised event logging to BigQuery
│       └── localFallback.ts         llama.cpp + SQLite (identical to v1)
├── .env.example                     All required env vars with comments
├── .env.gcp                         GCP-specific vars template
└── package.json
```

## AI Gateway Logic

```
clientRequest
  └→ cloudAiGateway()
       1. Check env: VERTEX_AI_ENABLED=true?
       2. Try: vertexAiPipeline()
              └→ adkAgents() → cloudRag() → mapsDirections()
       3. Catch any error → localFallback()
       4. bigqueryLogger.log(event) — fire-and-forget, never blocks response
```

## Environment Variables

See `.env.example` for the full list. Key groups:

- `VERTEX_AI_*` — project, location, model ID
- `ALLOYDB_*` — connection string, pool size
- `MAPS_API_KEY` — Google Maps Directions
- `BIGQUERY_DATASET` — analytics dataset name
- `VERTEX_AI_ENABLED` — `true` to use cloud, `false` to force local

## Running Locally (no cloud)

```bash
VERTEX_AI_ENABLED=false npm run dev
```

All requests fall through to `localFallback.ts` (llama.cpp + SQLite). Zero GCP credentials needed.
