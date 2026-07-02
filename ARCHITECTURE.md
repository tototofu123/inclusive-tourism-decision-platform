# Inclusive Tourism Decision Platform — Architecture

## Overview

An accessible Hong Kong travel planning platform where an LLM agent plans itineraries, finds places, and answers questions — all backed by a curated PostgreSQL dataset of 159 places across 3 regions.

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                     │
│  localhost:3000  ·  react + leaflet + plain CSS              │
│  Tabs: Chat | Map | Itinerary | Places                       │
├───────────────────────┬─────────────────────────────────────┤
│         POST /chat     │       GET /chat/status/:pid         │
│  (returns processId)   │       (poll every 200ms)           │
├───────────────────────┴─────────────────────────────────────┤
│                   Backend (Express + tsx)                    │
│  localhost:4000  ·  routes/ → services/ → db/client          │
│  agent.ts orchestrates LLM tool calling loop                │
├───────────────────────┬─────────────────────────────────────┤
│   llama-server (LLM)  │   PostgreSQL (curated dataset)       │
│   localhost:8081      │   localhost:5432                     │
│   Qwythos-9B/gemma4   │   inclusive_tourism_v1              │
└───────────────────────┴─────────────────────────────────────┘
```

---

## 1. Repository Layout

```
version-v1-web/                 ← ACTIVE development directory
  backend/
    src/
      index.ts                  ← Express app entry (port 4000)
      types.ts                  ← Shared TypeScript interfaces
      db/client.ts              ← PostgreSQL pool + all DB functions
      routes/
        chat.ts                 ← POST /chat (async) + GET /chat/status/:pid
        itinerary.ts            ← GET /itinerary/:id, POST confirm/unlock
        sessions.ts             ← CRUD sessions (GET/POST /sessions)
        places.ts               ← GET /places (list with pagination)
        models.ts               ← GET /models + POST /models/switch
        preferences.ts          ← GET/POST/DELETE /preferences/:sessionId
        plan.ts                 ← (legacy route, delegates to agentService)
        health.js               ← GET /health (uses places.js route)
        places.js               ← (legacy JS, replaced by places.ts)
        plan.js                 ← (legacy JS, replaced by plan.ts)
      services/
        agent.ts                ← MAIN: processChat() — full agent loop
        agentService.ts         ← V2 agent: classify + respond + execute itinerary
        apiClient.ts            ← Single entry point: chatCompletion(messages, tools?, overrides?)
        tools.ts                ← 12 tool implementations + TOOLS definition array
        placeResolver.ts        ← DB-first place resolution (places → Overpass → Nominatim)
        accessibilityService.ts ← DB-first accessibility lookup
        preferencesService.ts   ← User preferences CRUD + HK time/weather
        routingService.ts       ← OSRM walking routes + Haversine fallback
        llmGateway.ts           ← planTrip() + llmClassify() — structured LLM calls
        guard.ts                ← Input sanitization + injection/off-topic detection
        llmGateway.js           ← (legacy JS)
        planner.js              ← (legacy JS)
        places.js               ← (legacy JS)
      utils/
        http.ts                 ← fetchWithTimeout + LLAMA_HOST constant
      database/
        pool.js, migrate.js, seed.js  ← (legacy JS DB helpers)
    package.json                ← express, cors, pg, tsx
    tsconfig.json
  frontend/
    src/
      pages/
        index.tsx               ← MAIN: all UI (690 lines, no router)
        _app.tsx                ← Next.js app wrapper
      components/
        MapView.tsx             ← Leaflet map (markers + routes)
      styles/
        globals.css             ← All styles (no Tailwind)
    package.json                ← next, react, leaflet, react-leaflet
    next.config.js
    tsconfig.json
  database/
    migrations/
      001_init.sql              ← places, itineraries, itinerary_items tables
      002_sessions_and_places.sql ← sessions, session_messages
      003_day_number.sql        ← day_number column on itinerary_items
      004_user_preferences.sql  ← user_preferences table
      005_places_expand.sql     ← region, budget, accessibility_tags, score, etc.
      006_itinerary_costs.sql   ← transport_cost, entry_cost, confirmed, etc.
      run_migration.mjs         ← Migration runner
    seed_places_v1.mjs          ← Seeds 159 places across 3 regions
  AGENTS.md                     ← Workspace guide for LLM agents
  start.bat                     ← One-click startup script
  test-tools.mjs                ← 14 tool-calling tests
  test-tools.ps1                ← PowerShell test runner
```

---

## 2. Database Schema — `inclusive_tourism_v1`

### `places` (159 rows)
| Column | Type | Purpose |
|--------|------|---------|
| id | SERIAL PK | Unique place ID |
| name | TEXT | Place name |
| lat, lng | DOUBLE PRECISION | Coordinates |
| category | TEXT | museum, cafe, park, temple, shopping_mall, viewpoint, restaurant, market, art_gallery, historic_site, hotel |
| region | TEXT | kowloon (67), hong_kong_island (52), new_territories (40) |
| budget | TEXT | free, cheap, moderate, expensive |
| accessibility_tags | TEXT[] | ["step-free","ramp","elevator","accessible toilet"] |
| accessibility_score | INTEGER | 0–5 rating |
| place_type | TEXT | attraction, restaurant, hotel, transport_hub |
| area, address, opening_hours, tags, notes | TEXT | Extra metadata |

### `itineraries`
| Column | Type | Purpose |
|--------|------|---------|
| id | SERIAL PK | Itinerary ID |
| session_id | TEXT | Optional session link |
| user_text | TEXT | Original user request |
| region | TEXT | Region scope |
| created_at | TIMESTAMP | Creation time |

### `itinerary_items`
| Column | Type | Purpose |
|--------|------|---------|
| id | SERIAL PK | Item ID |
| itinerary_id | FK → itineraries.id | Parent itinerary |
| place_id | FK → places.id | Linked place |
| stop_index | INTEGER | Order position |
| label, start_time, end_time | TEXT | Display info |
| day_number | INTEGER | Which day of trip |
| transport_cost, entry_cost | NUMERIC(10,2) | Cost tracking |
| transport_mode | TEXT | walking, transit |
| confirmed, confirmed_at | BOOLEAN, TIMESTAMP | Lock state |
| road_distance_meters, duration_minutes | INTEGER | Route data |
| route_geometry_json | JSONB | OSRM GeoJSON |

### `sessions` + `session_messages`
- **sessions**: id, title, created_at, updated_at
- **session_messages**: id, session_id (FK), role (user/assistant), content, thinking, places_json, itinerary_id, created_at

### `user_preferences`
| Column | Type | Purpose |
|--------|------|---------|
| session_id | PK (FK → sessions.id) | One row per session |
| mobility | TEXT | none, wheelchair, crutches, walker, blind, deaf |
| interests | TEXT[] | ["museums","parks","shopping",...] |
| budget_level | TEXT | free, cheap, moderate, expensive |
| home_base | TEXT | Hotel/district name |
| urgent_mode | BOOLEAN | True when itinerary confirmed |
| confirmed_itinerary_id | INTEGER | FK → itineraries.id |

---

## 3. Data Flow

### 3A. Chat Request (Async Polling Pattern)

```
User types "plan a day in Kowloon"
        │
        ▼
POST /chat { text, sessionId? }
        │
        ▼
chat.ts: generates processId, spawns background task
        │
        ▼  returns immediately
{ processId: "1712345678-abc123" }
        │
        ▼
Frontend polls GET /chat/status/:processId every 200ms
        │
        ▼
Background: processChat(text, itineraryId, onThink, sessionId)
  1. sanitizeInput() — strip HTML, control chars, truncate to 4000
  2. detectPromptInjection() — reject if user tries to override system prompt
  3. detectOffTopic() — reject coding/security questions
  4. loadPreferences(sessionId) — mobility, interests, budget, home_base
  5. getHKTime() + getWeather() — current HK context
  6. Build system prompt with HK context + user preferences
  7. Load conversation history (last 20 messages from DB)
  8. Call chatCompletion() → LLM responds
  9. Parse tool calls (custom <|tool_call|> format OR native tool_calls array)
  10. Execute tool(s) → get results
  11. For native models: feed results back to LLM (loop max 5)
  12. Save messages to DB if sessionId
  13. Set process done = true
        │
        ▼
Frontend receives: { thinking: [...], done: true, result: { response, places, itinerary } }
```

### 3B. Tool Calling Architecture

```typescript
chatCompletion(messages, tools?, overrides?)
         │
         ├── provider = "local"  → POST http://127.0.0.1:8081/v1/chat/completions
         ├── provider = "openai" → POST https://api.openai.com/v1/...
         ├── provider = "anthropic" → POST https://api.anthropic.com/v1/...
         └── provider = "google" → POST https://generativelanguage.googleapis.com/...
         │
         ▼
   parseResponse(data, provider)
         │
         ▼
   { content, toolCalls: [{ id, name, args }], reasoningContent, finishReason }
```

### 3C. Tool Execution

```
LLM decides: "I need to search for museums"
         │
         ▼
parseToolCalls() or native tool_calls array
         │
         ▼
tool: search_places(query, region?, budget?)
  → resolveStops(stops, region, budget)
    → query places DB WHERE place_type = $1 AND category = $2
      [optional: AND region = $3, AND budget = $4]
    → ORDER BY accessibility_score DESC, RANDOM() LIMIT 3
    → fallback: Overpass API → Nominatim → random seed coords
  → Return { placeId, label, lat, lng }
         │
         ▼
tool: create_itinerary(days, preferences)
  → planTrip(preferences) via LLM → { stops, days }
  → resolveStops(stops) → save itinerary + items to DB
  → optimize route (nearest-neighbor reorder)
  → Return { itineraryId, stops }
         │
         ▼
tool: check_accessibility(place_name)
  → queryDbAccessibility(name) — checks places.accessibility_tags
  → fallback: queryOverpassAccessibility(name)
  → Return { wheelchair, tags, notes }
```

### 3D. Multi-Round Agent Loop

```
For Qwythos-9B (custom format):
  Round 1: LLM outputs TOOL calls → execute → return (no second LLM call)

For gemma4/GPT (native tool_calls):
  Round 1: LLM outputs tool_calls → execute → send results back → LLM
  Round 2: LLM may output more tool calls or final response
  ...
  Round 5: Force break, return whatever LLM produced
```

---

## 4. API Routes

### Health
| Method | Path | Response |
|--------|------|----------|
| GET | /health | `{ status, llm, llm_status/llm_error }` |

### Chat
| Method | Path | Purpose |
|--------|------|---------|
| POST | /chat | Submit message → returns `processId` |
| GET | /chat/status/:processId | Poll for thinking steps + result |

### Sessions
| Method | Path | Purpose |
|--------|------|---------|
| GET | /sessions | List last 30 sessions |
| POST | /sessions | Create new session → `{ id }` |
| GET | /sessions/:id | Get session + message history |

### Itineraries
| Method | Path | Purpose |
|--------|------|---------|
| GET | /itineraries | List all itineraries with stop counts |
| GET | /itinerary/:id | Full detail with items + costSummary |
| POST | /itinerary/:id/confirm | Lock all items (`confirmed_at=NOW()`) |
| POST | /itinerary/:id/unlock | Unlock all items |

### Places
| Method | Path | Purpose |
|--------|------|---------|
| GET | /places?limit=&offset= | Paginated place list |

### Models
| Method | Path | Purpose |
|--------|------|---------|
| GET | /models | List .gguf files + running model + providers |
| POST | /models/switch | Switch model or provider (restarts llama-server) |

### Preferences
| Method | Path | Purpose |
|--------|------|---------|
| GET | /preferences/:sessionId | Load user prefs |
| POST | /preferences/:sessionId | Save/merge user prefs |
| DELETE | /preferences/:sessionId | Reset to defaults |

---

## 5. Key Files & Functions

### `backend/src/index.ts` — Express Entry
- **Constants**: `LLAMA_HOST=http://127.0.0.1:8081`, `PORT=4000`
- Mounts all routers. Health endpoint checks LLM reachability.

### `backend/src/db/client.ts` — Database Layer
- **`query(text, params?)`** — Executes SQL via pg.Pool, logs duration
- **`savePlace(place)`** → INSERT with `ON CONFLICT DO NOTHING` on unique constraint
- **`saveItinerary(userText, region)`** → returns new itinerary id
- **`saveItineraryItem(item)`** — Saves all 14 columns (incl. costs, transport_mode, confirmed)
- **`getFullItinerary(id)`** — Joins with places, returns items + costSummary (totalTransport, totalEntry, totalAll, confirmedCount)
- **`createSession(title)`, `listSessions()`, `getSession(id)`** — Session management
- **`saveMessage(msg)`** — Saves to `session_messages`, updates session `updated_at`

### `backend/src/services/apiClient.ts` — LLM Gateway
- **`chatCompletion(messages, tools?, overrides?)`** — Single entry for all 4 providers
- **`setApiConfig(config)`** — Switches provider/model/API key
- **`parseResponse(data, provider)`** — Routes JSON response by provider shape
- **`listProviders()`** → `['local', 'openai', 'anthropic', 'google']`

### `backend/src/services/agent.ts` — Agent Orchestrator
- **`processChat(text, itineraryId?, onThink?, sessionId?)`** — Full agent pipeline
  - Security checks → load prefs → build system prompt with context → fetch history → call LLM → parse tool calls → execute loop → save messages → return response
- **`parseToolCalls(text)`** — Parses both `TOOL: Name {json}` and `<|tool_call|>call:Name{...}<|tool_call|>` formats
- **`SYSTEM_PROMPT_BASE`** — System prompt describing all 12 tools

### `backend/src/services/tools.ts` — Tool Registry
- **`TOOLS` array** — 12 tool definitions (OpenAI function-calling schema format)
- **`executeTool(name, args, emit)`** — Dispatches to implementation by name
- **12 implementations**: `searchPlaces`, `createItineraryTool`, `editItineraryTool`, `getItineraryTool`, `listItinerariesTool`, `deleteItineraryTool`, `searchPlaces`, `checkAccessibility`, `routeDistance`, `findTransport`, `getTravelTime`, `optimizeRoute`
- **`firstOf(args, ...keys)`** — Maps unpredictable model arg names (e.g. `query` vs `query_text` vs `keyword`)
- **`nearestNeighborReorder(stops)`** — Orders stops to minimize walking distance
- **`MTR_STATIONS`** → 49 Kowloon MTR stations with lat/lng for transport lookup

### `backend/src/services/placeResolver.ts` — Place Resolution
- **`resolveStops(stops, region?, budget?)`** — DB-first resolution
  - Builds SQL dynamically with `$1,$2,...` parameter indices
  - Filters by `place_type`, `category`, optional `region` + `budget`
  - Orders by `accessibility_score DESC, RANDOM()`
  - Fallback chain: Overpass API → Nominatim → random seed coords
- **`CATEGORY_OVERPASS`** — Maps categories to Overpass QL queries
- **`queryOverpass(category, label)`** — POST to Overpass API
- **`queryNominatim(q, category)`** — GET to Nominatim bounded search

### `backend/src/services/accessibilityService.ts` — Accessibility
- **`getAccessibility(placeName)`** → DB first (places.accessibility_tags), then Overpass
- **`queryDbAccessibility(name)`** → Returns wheelchair status + tags from curated data
- **`queryAllAccessibility()`** → Bulk Overpass query for nearby wheelchair tags
- **`queryOverpassAccessibility(name)`** → Named Overpass query

### `backend/src/services/preferencesService.ts` — User Preferences
- **`getPreferences(sessionId)`** → Returns from `user_preferences` table, defaults if none
- **`setPreferences(sessionId, prefs)`** → Upsert via `ON CONFLICT DO UPDATE`
- **`formatPreferences(prefs)`** → Renders as "User profile: wheelchair user, interested in museums, moderate budget."
- **`getHKTime()`** → Returns `{ datetime, weekday, hour, dateStr }` in Asia/Hong_Kong
- **`getWeather(hour)`** → Returns descriptive weather string based on hour

### `backend/src/services/routingService.ts` — Routing
- **`getRoute(fromLat, fromLng, toLat, toLng)`** → OSRM walking route with speed sanity check (>8 km/h = fallback)
- **`haversineFallback(...)`** → Estimated road distance (haversine × 1.4) when OSRM unreachable
- **`haversine(lat1, lng1, lat2, lng2)`** → Pure Haversine distance

### `backend/src/services/guard.ts` — Security
- **`sanitizeInput(text)`** — Strips HTML tags + control characters, truncates to 4000
- **`detectPromptInjection(text)`** — Rejects attempts to override system prompt
- **`detectOffTopic(text)`** — Rejects coding/security/infrastructure questions

### `backend/src/services/llmGateway.ts` — Structured LLM Calls
- **`planTrip(userText, context?)`** — Calls LLM with JSON schema prompt, parses `{ stops, days, focus_areas }`
- **`llmClassify(userText, hasItinerary)`** — Classifies intent: plan_trip, find_places, add_to_itinerary, modify_itinerary, get_info, respond
- **`parseLLMResponse(content)`** — Extracts JSON from LLM response, validates shape

### `frontend/src/pages/index.tsx` — Main UI (690 lines)
- **State**: tab, input, msgs[ChatMsg], loading, currentPlaces, currentItineraryId, itineraries[], sessionId, sessionTitle, sessions[], storedPlaces[], detail[ItineraryDetail], prefs, regionFilter, etc.
- **Functions**:
  - `md(s)` — Simple markdown-to-HTML (bold, italic, code, lists)
  - `send()` — POST /chat, starts polling with 200ms interval
  - `newSession()` / `loadSession(id)` — Session management
  - `loadItineraries()` — GET /itineraries list
  - `loadItineraryDetail(id)` — GET /itinerary/:id
  - `handleConfirm(id)` / `handleUnlock(id)` — POST confirm/unlock
  - `loadStoredPlaces(region?)` — GET /places with optional region query param
  - `toggleThinking(idx)` — Collapse/expand thinking steps
  - `handlePrefsSave()` — POST /preferences/:sessionId
- **Tabs**: Chat | Itinerary (day-filtered) | Map | Places (map+list view, region filter dropdown)
- **Components**: PreferencesModal, Confirm/Unlock buttons, CostSummary, Accessibility badge (♿ score/5)

### `frontend/src/components/MapView.tsx` — Leaflet Map
- **Props**: `markers[{lat, lng, label, category, day}]`, `routes[{from, to, geometry, distance}]`
- **Constants**: `COLORS{}` — category→color mapping, `KOWLOON_CENTER=[22.31,114.17]`
- CartoDB light tiles, numbered colored circle markers with popups, polyline routes
- Auto-bounds on marker change, preserves user pan/zoom

### `frontend/src/styles/globals.css` — All CSS
- Tab bar (horizontal), chat bubbles, thinking steps (collapsible), map, itinerary cards, place cards, preferences modal, model switcher
- No CSS framework — pure CSS with variables for colors

---

## 6. Configuration & Environment

### Backend (`.env`)
| Variable | Default | Purpose |
|----------|---------|---------|
| PORT | 4000 | Express listen port |
| LLAMA_HOST | http://127.0.0.1:8081 | llama-server URL |
| PGHOST | localhost | PostgreSQL host |
| PGPORT | 5432 | PostgreSQL port |
| PGUSER | postgres | DB user |
| PGPASSWORD | postgres | DB password |
| PGDATABASE | inclusive_tourism_v1 | DB name |
| OSRM_BASE | https://router.project-osrm.org | OSRM routing API |
| OVERPASS_BASE | https://overpass-api.de/api/interpreter | Overpass API |
| NOMINATIM_BASE | https://nominatim.openstreetmap.org | Nominatim geocoding |

### Frontend (`.env.local`)
| Variable | Default | Purpose |
|----------|---------|---------|
| NEXT_PUBLIC_API_HOST | http://localhost:4000 | Backend URL |

### LLM
| Path | Purpose |
|------|---------|
| `C:\Users\totot\llama-b9247-bin-win-cuda-12.4-x64\llama-server.exe` | llama-server binary |
| `C:\Users\totot\.llama\models\*.gguf` | Model files |
| Default model: `Qwythos-9B-Claude-Mythos-5-1M-Q4_K_M.gguf` | Primary agent model |

---

## 7. Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| **DB-first resolution** | Places query DB before Overpass/Nominatim → fast, reliable, avoids API rate limits |
| **Async polling** (not WebSocket) | Simple, works without persistent connections; 200ms polling is sufficient |
| **Two agent paths** | `agent.ts` for tool-calling (12 tools), `agentService.ts` for simpler classification |
| **Dynamic SQL params** | Template strings with `$1,$2,...` (incrementing idx) cleaner than complex ternary SQL |
| **Custom tool format** for Qwythos | Qwythos ignores `tools` param in API → tool definitions in system prompt only |
| **firstOf() arg mapping** | Different models output different arg names for same tool → `firstOf(args, 'query', 'query_text', 'q')` |
| **No CSS framework** | Simple plain CSS avoids dependency bloat for a single-page app |
| **Migration files** | SQL migrations in `database/migrations/` for repeatable schema changes |
| **Seeds not normalized** | Places seeded with accessibility scores baked in (not computed) — pragmatic for curated dataset |
| **One Express app** (no separate API) | Backend = Express directly, no Next.js API routes; simpler separation |
| **processId in memory** (not DB) | Chat status is ephemeral; in-memory Map auto-cleaned after 5 min |
| **Preferences injected in system prompt** | LLM sees user profile as context, enabling personalized recommendations |
| **Cost tracking in DB** | transport_cost, entry_cost stored per-item, computed totals in SQL |

---

## 8. Testing

| Test | Command | What it verifies |
|------|---------|------------------|
| Tool tests | `node test-tools.mjs` | 14 tests: place search, itinerary CRUD, routing, accessibility, edge cases |
| API tests | `node test-tools.mjs` | Health, Places (159), Models, Sessions, Prefs, Itineraries, Confirm/Unlock |
| Security tests | `node test-security.mjs` | Prompt injection, off-topic, XSS |

---

## 9. Startup Order

```
1. PostgreSQL service (must be running before backend)
2. llama-server.exe (model loads ~30s)
3. Backend (npx tsx src/index.ts)
4. Frontend (npm run dev)
```

The `start.bat` script automates this:
- Checks/scans PostgreSQL service `postgresql-x64-18`
- Kills existing llama-server, starts new with default model
- Waits 30s for model to load
- Starts backend + frontend in separate windows
- Opens http://localhost:3000 in browser
