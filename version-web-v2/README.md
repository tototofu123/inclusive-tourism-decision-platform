# Web v2 — Cloud-First Migration

## What Changed from v1

The user-facing side is identical. All changes are backend and cloud infrastructure.

| Layer | v1 (MVP) | v2 |
|---|---|---|
| LLM | llama.cpp local GPU | Vertex AI + Gemini (primary), llama.cpp (fallback) |
| Agent | Single `callLlama()` | Multi-agent ADK: Route Planner, Place Selector, City Insight |
| Vector Search | None / SQLite LIKE | Vertex AI Vector Search or AlloyDB pgvector |
| Database | SQLite (sql.js) | AlloyDB for PostgreSQL |
| Routing | Static fallback | Google Maps Directions API |
| Analytics | None | BigQuery (anonymised usage events) |

## Request Flow

```
Frontend
  └→ POST /api/itinerary
       └→ cloudAiGateway
            ├→ [primary] Vertex AI + ADK agents
            │             + Vertex AI Vector Search
            │             + Google Maps Directions API
            │             + BigQuery event logger
            └→ [fallback] llama.cpp + SQLite (identical to v1)
```

The AI Gateway decides at runtime: try cloud → on any error → fall back to local. The frontend never knows which path ran.

## What Stays the Same

- All frontend pages, components, API routes (`/api/itinerary`, `/api/places`, `/api/profile`)
- SQL schema (portable SQLite ↔ PostgreSQL)
- Local fallback — zero cloud deps required to run

## Folder Structure

```
version-web-v2/
├── agent/          ADK agent definitions (Route Planner, Place Selector, City Insight)
├── api/            Next.js API routes (unchanged from v1)
├── architecture/   Architecture diagrams and decision log
├── backend/        Node.js backend — gateway, RAG, BigQuery logger
├── components/     Shared React components (unchanged)
├── database/       Schema + migration scripts (SQLite → AlloyDB)
├── files-needed/   Env templates, GCP setup checklist
├── flow/           Data flow diagrams
├── frontend/       Next.js pages (unchanged)
└── guide/          Developer setup guide
```
