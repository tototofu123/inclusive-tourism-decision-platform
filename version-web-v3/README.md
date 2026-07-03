# Web v3 — Inclusive Tourism Platform for Hong Kong

## What Changed from v2

| Layer | v2 | v3 |
|---|---|---|
| Philosophy | Cloud-first, accessibility as a feature | Accessibility-first, inclusivity as the core |
| LLM | Vertex AI (primary) → Gemini API → local llama | Gemini API (AI Studio) → local llama (silent fallback) |
| Agent | Multi-agent ADK + custom tool parsers | Single streamlined agent, native function calling only |
| Accessibility | Basic Overpass wheelchair query | Rich MTR station accessibility DB, step-free/hearing loop/tactile data |
| Routing | OSRM walking only | OSRM walking + Google Routes WALK + Google Transit (accessible MTR) |
| Preferences | Saved but rarely used in filtering | Mobility/interests actively filter ALL search results |
| Services | 19 services, 8 routes, 305-line apiClient | 11 core services, 5 routes, clean 130-line apiClient |
| Dead code | 1 unused service, 8 partially wired files | All code actively wired and used |

## Architecture

```
Frontend (Next.js)
  └→ POST /chat  ─→ processChat() ─→ chatCompletion()
       │                                     ├─ Gemini (AI Studio) ── primary
       │                                     └─ Local llama.cpp ──── fallback
       │
       ├→ executeTool() ─→ searchPlaces()
       │                    createItinerary()
       │                    checkAccessibility()
       │                    findTransport() ─── getAccessibleTransitRoute()
       │                    routeDistance() ─── getRoute()
       │                    setPreferences()
       │
       └→ Response: { response, places[], itinerary?, thinking[] }
```

## Accessibility Features

- **MTR Station DB**: 40+ Hong Kong MTR stations with elevator & accessible toilet data hardcoded
- **Overpass enrichment**: Falls back to OpenStreetMap for wheelchair/ramp/tactile/braille/hearing loop tags
- **Mobility-aware search**: When user sets `mobility: wheelchair` all search results are filtered for accessibility
- **Accessible transit routing**: Google Routes TRANSIT mode with `FEWER_TRANSFERS` + elevator station notes
- **Rich accessibility check**: Returns step-free entrance ✅, accessible toilet ✅, elevator ✅, tactile paving ✅

## Project Structure

```
version-web-v3/
├── backend/
│   ├── src/
│   │   ├── index.ts            Server entry (port 4000)
│   │   ├── types.ts            Shared types
│   │   ├── db/client.ts        PostgreSQL client
│   │   ├── routes/
│   │   │   ├── chat.ts         Async chat with SSE-ready polling
│   │   │   ├── itinerary.ts    Itinerary CRUD + confirm/unlock
│   │   │   ├── preferences.ts  User preferences CRUD
│   │   │   ├── sessions.ts     Session management
│   │   │   └── places.ts       Place search
│   │   ├── services/
│   │   │   ├── agent.ts        Agent orchestration loop
│   │   │   ├── apiClient.ts    LLM client (Gemini → local fallback)
│   │   │   ├── tools.ts        18 function tools with dispatcher
│   │   │   ├── accessibilityService.ts  Rich accessibility DB + Overpass + MTR data
│   │   │   ├── routingService.ts       OSRM + Google Routes + accessible transit
│   │   │   ├── placeResolver.ts        Place resolution (DB → Overpass → Nominatim)
│   │   │   ├── preferencesService.ts   Session-level preferences
│   │   │   ├── globalPreferencesService.ts  Global preferences
│   │   │   ├── guard.ts                Security (injection, off-topic)
│   │   │   ├── timeService.ts          HK time/weather
│   │   │   ├── llmGateway.ts           Trip plan LLM helper
│   │   │   └── ragService.ts           Lightweight semantic search
│   │   └── utils/
│   │       ├── http.ts         Fetch helpers
│   │       └── rateLimiter.ts  Rate limiting
│   ├── .env                   Config
│   └── package.json
├── frontend/
│   ├── src/pages/index.tsx    Single-page app
│   ├── src/components/MapView.tsx  Leaflet map
│   └── src/styles/globals.css
└── README.md
```

## Quick Start

```bash
# Backend
cd backend
npm install
npx tsx src/index.ts   # starts on :4000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev            # starts on :3000
```

## Environment (.env)

| Var | Required | Default | Notes |
|---|---|---|---|
| `GEMINI_API_KEY` | No | - | AI Studio key for Gemini primary LLM |
| `MAPS_API_KEY` | No | - | Google Maps API for routing |
| `LLAMA_HOST` | No | `http://127.0.0.1:8081` | Local LLM fallback |
| `CLOUD_SQL_*` | Yes | - | PostgreSQL connection |
| `OSRM_BASE` | No | `https://router.project-osrm.org` | Walking routing |
| `OVERPASS_BASE` | No | `https://overpass-api.de/api/interpreter` | OSM accessibility data |
