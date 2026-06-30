# Version MVP Web — Local AI + SQLite

The first runnable version. No cloud keys. Runs entirely on your machine using **llama.cpp** for AI and **SQLite** for data.

## Prerequisites

- Node.js 18+
- A running [llama.cpp](https://github.com/ggerganov/llama.cpp) server (see below)
- Any GGUF model (e.g. Mistral 7B, LLaMA 3.1 8B)

---

## 1. Start llama.cpp server

```bash
# Download a model (example: Mistral 7B Q4)
wget https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF/resolve/main/mistral-7b-instruct-v0.2.Q4_K_M.gguf

# Start server (OpenAI-compatible on port 8080)
./llama-server -m mistral-7b-instruct-v0.2.Q4_K_M.gguf -c 4096 --port 8080 -ngl 35
# -ngl 35 = offload 35 layers to GPU (remove if no GPU)
```

---

## 2. Start Backend

```bash
cd version-mvp-web/backend

# Install dependencies
npm install

# Copy env file
cp .env.example .env
# Edit .env if your llama.cpp runs on a different port

# Seed the database with 10 HK accessible spots
npm run seed

# Start backend (port 3001)
npm run dev
```

You should see:
```
🚀 MVP Backend running at http://localhost:3001
   llama.cpp endpoint: http://localhost:8080
   DB: ./db/mvp.sqlite
```

---

## 3. Start Frontend

```bash
cd version-mvp-web/frontend

# Install dependencies
npm install

# Copy env file
cp .env.local.example .env.local

# Start frontend (port 3000)
npm run dev
```

Open **http://localhost:3000**

---

## How it works

```
Browser (Next.js :3000)
  └─ POST /api/itinerary
        └─ Express backend (:3001)
              ├─ Loads user profile from SQLite
              ├─ Queries accessible places from SQLite  
              └─ Sends prompt → llama.cpp (:8080)
                    └─ Returns JSON itinerary plan
```

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/health` | Backend health check |
| GET | `/api/places` | List places (filter: `district`, `mobility`, `min_score`) |
| GET | `/api/places/:id` | Get single place |
| POST | `/api/profile` | Create/update user profile |
| GET | `/api/profile/:session_id` | Get profile |
| POST | `/api/itinerary` | Generate itinerary (calls llama.cpp) |
| GET | `/api/itinerary/:id` | Get saved itinerary |

## Project Structure

```
backend/
  server.js              ← Express entry point
  agent/planningAgent.js ← llama.cpp prompt builder + caller
  db/
    schema.sql           ← SQLite schema
    seed.js              ← 10 seeded HK accessible spots
    database.js          ← DB singleton
  routes/
    itinerary.js
    places.js
    profile.js

frontend/
  pages/
    index.js             ← Profile setup
    plan.js              ← Chat + itinerary display
  components/
    ChatInput.js
    ItineraryCard.js
    AccessibilityBadge.js
```

---

## Migrating to Web v1 (Gemini + AlloyDB)

This MVP is designed so migration is a single file swap:
- Replace `backend/agent/planningAgent.js` → swap `callLlama()` for `callGemini()`  
- Replace `backend/db/database.js` → swap SQLite for AlloyDB/Postgres connection
- All routes stay identical — zero frontend changes needed
