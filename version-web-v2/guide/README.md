# Developer Guide — Web v2

## Prerequisites

- Node.js 20+
- npm 9+
- (Optional) GPU + llama.cpp for local AI fallback
- (Optional) GCP account for cloud mode

## Quick Start — Local Only (no cloud)

```bash
# 1. Clone repo
git clone https://github.com/tototofu123/inclusive-tourism-decision-platform
cd inclusive-tourism-decision-platform/version-web-v2

# 2. Install backend deps
cd backend && npm install

# 3. Configure env
cp .env.example .env
# Edit .env: set VERTEX_AI_ENABLED=false

# 4. Start backend
npm run dev
# → Backend running on :4000, mode: local

# 5. In new terminal — start frontend
cd ../frontend && npm install && npm run dev
# → Frontend running on :3000

# 6. Open http://localhost:3000
```

## Quick Start — Cloud Mode

```bash
# Complete GCP setup checklist in files-needed/README.md first.

# 1. Fill in backend/.env with real GCP values
cp backend/.env.gcp backend/.env
# Edit backend/.env — fill VERTEX_PROJECT_ID, ALLOYDB_CONNECTION_STRING, MAPS_API_KEY etc.

# 2. Set VERTEX_AI_ENABLED=true in .env

# 3. Start backend
cd backend && npm run dev
# → Backend running on :4000, mode: cloud (Vertex AI + ADK)

# 4. Start frontend
cd ../frontend && npm run dev
```

## Switching Between Cloud and Local

Only one env var controls this:

```bash
# Use cloud
VERTEX_AI_ENABLED=true

# Use local (dev / no GCP credentials)
VERTEX_AI_ENABLED=false
```

Restart the backend after changing this value.

## Testing the AI Gateway

```bash
# Test itinerary endpoint
curl -X POST http://localhost:4000/api/itinerary \
  -H 'Content-Type: application/json' \
  -d '{
    "userQuery": "half-day accessible tour near Central",
    "userProfile": { "mobilityTags": ["wheelchair"], "dietaryTags": [], "language": "en" },
    "location": "Central, Hong Kong",
    "durationHours": 4
  }'

# Check health + mode
curl http://localhost:4000/health
```

## Console Output (Backend)

The backend prints a colour-coded startup banner and request log:

```
┌─────────────────────────────────────────────┐
│  ♿  Inclusive Tourism — Backend v2          │
└─────────────────────────────────────────────┘
  Port     4000
  Mode     ☁  Cloud (Vertex AI + ADK)
  Started  19:45:00

  Routes:
  POST  /api/itinerary
  GET   /api/places
  GET   /api/profile
  POST  /api/profile

  ✓ 200 POST  /api/itinerary  1240ms
  ✓ 200 GET   /api/places     45ms
  ✗ 404 GET   /api/unknown    2ms
```
