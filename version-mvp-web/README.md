# MVP Web — Inclusive Tourism HK

Full working web MVP. Node.js/Express backend + Next.js frontend + local llama.cpp AI.

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- [llama.cpp](https://github.com/ggerganov/llama.cpp) built locally with a 3B–7B GGUF model

### 1. Start the local LLM

```bash
# Download a model first (e.g. Llama-3.2-3B-Instruct-Q4_K_M.gguf)
./llama-server -m models/Llama-3.2-3B-Instruct-Q4_K_M.gguf --port 8080 --ctx-size 4096
```

### 2. Backend

```bash
cd version-mvp-web/backend
cp .env.example .env          # fill in DB credentials
npm install
node src/database/migrate.js  # create tables
node src/database/seed.js     # seed 8 sample HK places
npm run dev                   # starts on :3001
```

### 3. Frontend

```bash
cd version-mvp-web/frontend
cp .env.local.example .env.local
npm install
npm run dev                   # starts on :3000
```

Open http://localhost:3000

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Server + DB + LLM status |
| POST | `/api/plan` | Generate accessible itinerary |
| GET | `/api/places?lat=&lng=&radius=&tags=` | Find nearby accessible places |
| GET | `/api/places/:id` | Get single place |

### POST /api/plan — Request body

```json
{
  "message": "Half-day sightseeing near Tsim Sha Tsui",
  "userProfile": {
    "mobility": "wheelchair",
    "needsRestFrequently": true
  },
  "location": { "lat": 22.2996, "lng": 114.1717 },
  "lang": "en"
}
```

## Architecture

```
Browser (Next.js)
  └─ POST /api/plan
       └─ backend/src/routes/plan.js
            └─ services/planner.js
                 ├─ services/llmGateway.js  ──►  llama.cpp :8080
                 └─ services/places.js     ──►  PostgreSQL
```

## Folder structure

```
backend/
  src/
    server.js          Express app + middleware
    routes/            plan.js, places.js, health.js
    services/          planner.js, llmGateway.js, places.js
    database/          pool.js, migrate.js, seed.js
frontend/
  src/
    app/               Next.js App Router pages
    components/        PlannerForm, ItineraryView, PlacesMap, LeafletMap
```

## Migration path to Web v2

Swap these two env vars to point at Google Cloud — no other code changes needed:

```env
LLAMA_BASE_URL=https://REGION-aiplatform.googleapis.com/v1/projects/PROJECT/locations/REGION/publishers/google/models/gemini-2.0-flash
DB_HOST=<alloydb-ip>
```
