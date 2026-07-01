# V1 Specification

> Based on MVP codebase copied from `version-mvp-web`.  
> Generated: 2026-07-01

## Overview

Full-stack web MVP for accessible Kowloon (Hong Kong) trip planning.
- **Backend**: Express.js TypeScript, port 4000
- **Frontend**: Next.js Pages Router, port 3000
- **Database**: PostgreSQL (native, no Docker)
- **LLM**: Local llama.cpp on port 8081 via OpenAI-compatible `/v1/chat/completions`
- **External APIs**: Overpass API (POI), Nominatim (geocoding), OSRM (walking routes)

---

## 1. Directory Structure

```
version-v1-web/
├── backend/
│   └── src/
│       ├── index.ts              # Express entry, mounts 6 routers + GET /health
│       ├── types.ts              # ChatResponse, Place, LLMStop, LLMResponse, ItineraryRow, ItineraryItemRow
│       ├── db/
│       │   └── client.ts         # pg.Pool singleton, all CRUD functions (places, itineraries, sessions, messages)
│       ├── routes/
│       │   ├── chat.ts           # POST /chat (two-phase poll), GET /chat/status/:processId, GET /itineraries
│       │   ├── plan.ts           # POST /plan (direct LLM plan → resolve → save)
│       │   ├── itinerary.ts      # GET /itinerary/:id
│       │   ├── sessions.ts       # GET /sessions, POST /sessions, GET /sessions/:id
│       │   ├── places.ts         # GET /places?limit=9999&offset=0
│       │   └── models.ts         # GET /models, POST /models/switch (llama-server lifecycle)
│       ├── services/
│       │   ├── agent.ts          # processChat() — main chat pipeline, system prompt, tool call handling
│       │   ├── agentService.ts   # Older simplified agent (not imported by current routes)
│       │   ├── llmGateway.ts     # planTrip(), llmClassify(), fetchWithTimeout()
│       │   ├── tools.ts          # 12 tool definitions + implementations + MTR data + nearest-neighbor optimizer
│       │   ├── placeResolver.ts  # resolveStops() — Overpass + Nominatim → real places
│       │   ├── routingService.ts # getRoute() — OSRM walking routing with speed sanity check
│       │   └── accessibilityService.ts  # wheelchair tag queries from Overpass
│       ├── database/             # Legacy JS files (migrate.js, pool.js, seed.js — OLD schema, not used)
│       └── server.js             # Legacy Express entry — NOT used (index.ts is active)
├── frontend/
│   ├── next.config.js            # rewrites /api/* → http://localhost:4000/*
│   ├── package.json              # next 15.5, react 19.2, react-leaflet 5, leaflet 1.9
│   ├── src/
│   │   ├── pages/
│   │   │   ├── index.tsx         # SPA: tabbed chat/map/itinerary/places, model switcher, two-phase polling
│   │   │   └── _app.tsx          # Next.js App wrapper, <Head> with title
│   │   ├── components/
│   │   │   └── MapView.tsx       # Leaflet map, colored markers by category, route polylines, zoom caching
│   │   └── styles/
│   │       └── globals.css       # All custom CSS (flexbox layout, tab system, thinking UI, model dropdown)
│   └── public/
│       └── favicon.svg
├── database/
│   └── migrations/
│       ├── 001_init.sql           # places, itineraries, itinerary_items
│       ├── 002_sessions_and_places.sql  # sessions, session_messages
│       ├── 003_day_number.sql     # ALTER itinerary_items ADD day_number
│       └── run_migration.mjs      # Runs all .sql files in order
├── places-data/
│   └── hong-kong/
│       └── places-curated.json    # 53 researched Kowloon places with source_url citations
├── agent/                         # Doc: README.md only
├── api/                           # Doc: README.md only
├── architecture/                  # Doc: README.md only
├── assets/                        # Doc: README.md only
├── components/                    # Doc: README.md only
├── files-needed/                  # Doc: README.md only
├── flow/                          # Doc: README.md only
├── guide/                         # Doc: README.md only
├── APIs.md                        # External API reference
├── test-tools.mjs                 # Node.js E2E tool calling tests
├── test-tools.ps1                 # PowerShell tool calling tests
├── start-mvp.cmd                  # 4 windows: backend, frontend, LLM, console
├── start-mvp.ps1                  # PowerShell startup
└── README.md                      # Project README
```

---

## 2. Backend — Files & Functions

### Entry Point: `backend/src/index.ts`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Express app setup, router mounting, health endpoint |
| **Called when** | `npx tsx src/index.ts` (dev) or `npm start` |
| **Port** | 4000 (env `PORT`) |
| **Middleware** | cors({ origin: true }), express.json() |
| **Routes** | 6 routers: plan, itinerary, chat, sessions, places, models |
| **GET /health** | Pings LLM `/health` (3s timeout), returns `{ status, llm, llm_status?, llm_error? }` |
| **Does NOT** | Serve static files, handle auth, rate-limit |

### Types: `backend/src/types.ts`

| Interface | Fields | Used by |
|-----------|--------|---------|
| `ChatResponse` | `thinking: string[], response: string, sessionTitle?, places?, itinerary?, allItineraries?` | agent.ts → chat.ts route |
| `Place` | `id, name, lat, lng, category?, description?, source_api?` | db/client, placeResolver, tools |
| `ItineraryRow` | `id, session_id?, user_text?, region?, created_at` | db/client |
| `ItineraryItemRow` | `id, itinerary_id, place_id, stop_index, label?, start_time?, end_time?, road_distance_meters?, duration_minutes?, route_geometry_json?, place_name?, lat?, lng?, category?, description?, day_number?` | db/client |
| `LLMStop` | `label, category, approx_duration_minutes, notes?, day?` | llmGateway → placeResolver |
| `LLMResponse` | `stops: LLMStop[], total_duration_minutes, days?, focus_areas?, ordering_hint?` | planTrip output |

### DB Client: `backend/src/db/client.ts`

| Function | Parameters | Returns | SQL |
|----------|-----------|---------|-----|
| `query(text, params?)` | SQL string + optional params array | pg result | Generic |
| `savePlace(Place)` | Place object | `number` (id) | `INSERT INTO places ... ON CONFLICT DO NOTHING RETURNING id` |
| `listPlaces(limit, offset)` | limit=50, offset=0 | `{ places, total }` | `SELECT * FROM places ORDER BY name LIMIT/OFFSET` |
| `saveItinerary(userText, region)` | userText string, region string | `number` (id) | `INSERT INTO itineraries RETURNING id` |
| `saveItineraryItem(item)` | itinerary item object | void | `INSERT INTO itinerary_items` with all fields |
| `getFullItinerary(id)` | number | `{ itinerary, items }` or null | SELECT with JOIN |
| `createSession(title?)` | optional title string | `{ id }` | `INSERT INTO sessions RETURNING id` |
| `listSessions()` | none | rows[] with display_title | SELECT with subqueries for msg_count, first_msg |
| `getSession(id)` | number | `{ session, messages }` | SELECT session + all messages |
| `saveMessage(msg)` | `{ session_id, role, content, intent?, thinking?, places_json?, itinerary_id? }` | void | `INSERT INTO session_messages` |

**Env**: `PGHOST=localhost`, `PGPORT=5432`, `PGUSER=postgres`, `PGPASSWORD=postgres`, `PGDATABASE=inclusive_tourism_mvp`

### Routes

#### `chat.ts`

| Endpoint | Method | Purpose | Body/Params | Process |
|----------|--------|---------|-------------|---------|
| `/chat` | POST | Start async chat processing | `{ text, itineraryId?, sessionId? }` | Returns `{ processId }` immediately. Background: calls `processChat()`, saves messages to DB, updates session title |
| `/chat/status/:processId` | GET | Poll for results | processId path param | Returns `{ thinking[], done, result?, error? }`. Strips result until done |
| `/itineraries` | GET | List last 20 itineraries | none | Returns array of `{ id, user_text, created_at, stop_count }` |

**Inline type**: `ProcessState { thinking: string[], done: boolean, result?: any, error?: string }`  
**Cleanup**: Stale processes removed after 5 minutes via setInterval

#### `plan.ts`

| Endpoint | Method | Purpose | Body |
|----------|--------|---------|------|
| `/plan` | POST | Direct trip planning (bypasses chat) | `{ text: string }` |

Calls `planTrip()` → LLM → `resolveStops()` → save itinerary → return `{ itineraryId, itinerary, places }`.

#### `itinerary.ts`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/itinerary/:id` | GET | Get full itinerary with items |

#### `sessions.ts`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/sessions` | GET | List all sessions |
| `/sessions` | POST | Create session (`{ title? }`) → `{ id }` |
| `/sessions/:id` | GET | Get session with messages |

#### `places.ts`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/places` | GET | List places (default limit 9999) |

#### `models.ts`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/models` | GET | List .gguf files in models dir |
| `/models/switch` | POST | Kill llama-server, spawn with new model |

---

## 3. Services — Functions & Data Flow

### `agent.ts` — Main Chat Pipeline

```
processChat(text, itineraryId?, onThink?, sessionId?) → ChatResponse
```

**Flow**:
1. Extract itinerary reference from text (`#N` pattern)
2. Fetch conversation history from DB (last 20 messages) if sessionId provided
3. Build messages: `[system_prompt + history + current_user_message]`
4. Call LLM (`max_tokens: 4096, temperature: 0.1`, NO tools parameter — model uses custom `<|tool_call|>` format)
5. Extract `reasoning_content` as thinking steps
6. Check for tool calls:
   - **Native**: OpenAI `tool_calls` format (gemma4, etc.)
   - **Custom**: `<|tool_call|>call:Name{json}<tool_call|>` text format (Qwythos)
7. Parse args: `firstOf()` handles multiple possible key names
8. Execute ALL tool calls sequentially, collect results
9. For native format tools: make 2nd LLM call with tool results → natural response
10. For custom format tools: return tool result text directly
11. Return `ChatResponse` with thinking trace, response text, places, itinerary data

**System Prompt**:
- Kowloon travel agent (scope limited to Kowloon peninsula)
- Lists 12 tools with purpose descriptions
- `TOOL: toolName { "key": "value" }` format instruction
- Conversation context awareness
- "Be concise. Answer naturally."

**Error Handling**:
- LLM connection fail → fallback message
- Tool execution error → error message appended
- Empty LLM response → throws error
- History fetch failure → non-fatal (continues without history)

### `llmGateway.ts` — LLM Communication

| Function | Purpose | LLM Call | Timeout |
|----------|---------|----------|---------|
| `fetchWithTimeout(url, opts, ms)` | AbortController-based fetch wrapper | - | configurable |
| `planTrip(userText, context?)` | Trip planning JSON generation | `reasoning_effort: 0, max_tokens: 2048` | 120s |
| `llmClassify(userText, hasItinerary)` | Intent classification | single word response | 30s |

**Note**: `llmClassify` is NOT called from `agent.ts` anymore. Only `planTrip` is used (by `tools.ts` `createItineraryTool`).

### `tools.ts` — 12 Tool Implementations

| # | Tool Name | Args | What It Does | DB? | API? |
|---|-----------|------|-------------|-----|------|
| 1 | `search_places` | `query` | Keyword-match query → categories → resolveStops → return places | Read | Overpass/Nominatim |
| 2 | `get_place_alternatives` | `place_name, reason, category?` | Query DB for different places in same category | Read | - |
| 3 | `check_accessibility` | `place_name` | Query Overpass wheelchair tags | - | Overpass |
| 4 | `create_itinerary` | `preferences, days?, existing_itinerary_id?` | LLM plan → resolve → nearest-neighbor reorder → save | Write | Overpass/Nominatim/OSRM/LLM |
| 5 | `edit_itinerary` | `itinerary_id, changes` | Add/remove/reorder stops | R/W | Overpass/Nominatim/LLM |
| 6 | `get_itinerary` | `itinerary_id` | Fetch full itinerary from DB | Read | - |
| 7 | `list_itineraries` | none | List last 20 itineraries | Read | - |
| 8 | `delete_itinerary` | `itinerary_id` | Delete itinerary + items | Write | - |
| 9 | `route_distance` | `from_lat/lng, to_lat/lng` | OSRM walking route + Haversine fallback | - | OSRM |
| 10 | `find_transport` | `from/to_name/lat/lng` | Walking vs MTR transport estimate | Read | - |
| 11 | `get_travel_time` | `from/to_lat/lng, mode` | Walking or transit time estimate | - | OSRM/MTR lookup |
| 12 | `optimize_route` | `stops[]` | Nearest-neighbor reordering | - | - |

**Internal Helpers**:
- `nearestNeighborReorder(stops)` — greedy TSP optimizer (Haversine)
- `firstOf(args, ...keys)` — flexible arg extraction
- `resolveToolCoords(args, ...keys)` — resolves coords from args/DB/MTR/fallback
- `resolvePlaceName(name)` — resolves name from DB/MTR stations
- `findNearestMtr(lat, lng)` — nearest station within 0.05° from 23 stations
- `estimateMtrTime(from, to)` — from hardcoded travel time matrix
- `haversine(lat1, lng1, lat2, lng2)` — standard distance

**MTR Data**: 23 stations with coords, zone, line. Travel time matrix for 8 core stations.

### `placeResolver.ts` — Place Resolution

```
resolveStops(stops: LLMStop[]) → [{ placeId, label, lat, lng, duration }]
```

**Flow** (per stop):
1. Look up Overpass query by category (museum, cafe, etc.) within Kowloon bbox
2. If Overpass fails: Nominatim geocoding (`"X Kowloon Hong Kong"`)
3. If both fail: generate random Kowloon coords (`22.305 + random * 0.03, 114.165 + random * 0.03`)
4. Save to DB via `savePlace()`
5. Cache wheelchair tags from `queryAllAccessibility()`

**Category→Overpass mapping**: museum, cafe, restaurant, park, temple, shopping_mall, viewpoint, market, art_gallery, historic_site

**Fallback Categories**: Each OSM category maps to 1-2 Overpass tags (e.g., `museum → ['museum', 'historic']`)

### `routingService.ts` — Walking Routes

```
getRoute(fromLat, fromLng, toLat, toLng) → { distance_meters, duration_seconds, geometry }
```

- Calls OSRM walking profile: `${OSRM_BASE}/route/v1/walking/${lng1},${lat1};${lng2},${lat2}`
- **Sanity check**: speed > 8 km/h → reject (driving data), fallback to Haversine × 1.4
- **Walking speed**: 1.4 m/s (5 km/h)

### `accessibilityService.ts` — Wheelchair Data

- `queryAllAccessibility()` — bulk Overpass query for wheelchair tags in Kowloon
- `getAccessibility(placeName)` — single place query
- Checks: `wheelchair`, `tactile_paving`, `wheelchair_toilet`, `elevator`, `ramp` tags

---

## 4. Frontend — Components & State

### `pages/index.tsx` — Main SPA

**State**:
| Variable | Type | Description |
|----------|------|-------------|
| `messages` | `Message[]` | Chat messages `{ role, text, thinking, places, itinerary, sessionTitle, fakeUntil }` |
| `input` | string | Current input text |
| `loading` | boolean | Waiting for bot response |
| `processId` | string\|null | Current polling process ID |
| `sessionId` | number\|null | Active session ID |
| `itineraryId` | number\|null | Active itinerary ID |
| `currentItinerary` | object\|null | Full itinerary with stops |
| `markers` | `Marker[]` | Map markers `{ lat, lng, name, category, label? }` |
| `routes` | coordinate[][] | Map polylines |
| `activeTab` | string | Current tab: chat, map, itinerary, places |
| `sessions` | Session[] | Session list for dropdown |
| `showSessions` | boolean | Session dropdown visibility |
| `itineraries` | ItinerarySummary[] | Itinerary list |
| `sessionTitle` | string | Current session display title |
| `currentModel` | string | Current LLM model name |
| `models` | string[] | Available models |
| `modelSwitching` | boolean | Model switch in progress |
| `showModels` | boolean | Model dropdown visibility |
| `places` | Place[] | Places tab data |
| `placesViewMode` | 'list'\|'map' | Places tab view toggle |
| `placesLoading` | boolean | Places fetch loading |

**Key Behaviors**:
- **Two-phase polling**: `POST /chat` returns `processId` immediately; polls `GET /chat/status/:processId` every 200ms
- **Thinking UI**: Fake progress bar for first 2.5s, then real thinking steps (mutually exclusive)
- **Tab system**: 4 tabs (Chat, Map, Itinerary, Places), context-sensitive header buttons
- **Markdown**: `md(s)` function renders `**bold**`, `*italic*`, `` `code` ``, `- lists` as HTML via `dangerouslySetInnerHTML`
- **Model switcher**: header gear button opens dropdown of .gguf models, switching restarts llama-server
- **Session management**: header dropdown for sessions, "New Chat" button, auto-title from first message
- **MapView always mounted**: CSS `display:none` to preserve zoom state across tab switches
- **Itinerary detail**: default view is detail when active (list via header dropdown)

### `components/MapView.tsx`

**Props**: `{ markers, routes, dayFilter, className? }`  
**State**: `mapRef, markerLayer, routeLayer` (useRef)  
**Behavior**:
- CartoDB tiles (faster than OSM)
- Colored markers by category (10 colors)
- Route polylines between stops
- Zoom caching: `userInteracted` ref prevents auto-rezoom
- `invalidateSize()` on mount to fix Leaflet layout
- `fitBounds` with `[80,80]` padding, `maxZoom: 15`

### `globals.css`

Pure flexbox layout (no absolute positioning). Tab system, thinking animation, model dropdown, typewriter effect.

---

## 5. Database Schema

### Tables

#### `places`
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PK |
| name | TEXT | NOT NULL |
| lat | DOUBLE PRECISION | NOT NULL |
| lng | DOUBLE PRECISION | NOT NULL |
| category | TEXT | nullable |
| description | TEXT | nullable |
| source_api | TEXT | DEFAULT 'osm' |
| created_at | TIMESTAMP | DEFAULT NOW() |
| **UNIQUE** | (name, lat, lng) | |

#### `itineraries`
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PK |
| session_id | TEXT | nullable |
| user_text | TEXT | nullable |
| region | TEXT | DEFAULT 'Kowloon' |
| created_at | TIMESTAMP | DEFAULT NOW() |

#### `itinerary_items`
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PK |
| itinerary_id | INTEGER | FK → itineraries ON DELETE CASCADE |
| place_id | INTEGER | FK → places |
| stop_index | INTEGER | NOT NULL |
| label | TEXT | nullable |
| start_time | TEXT | nullable |
| end_time | TEXT | nullable |
| road_distance_meters | INTEGER | DEFAULT 0 |
| duration_minutes | INTEGER | DEFAULT 60 |
| route_geometry_json | JSONB | nullable |
| day_number | INTEGER | DEFAULT 1 |

#### `sessions`
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PK |
| title | TEXT | NOT NULL DEFAULT 'New Chat' |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |
| **Index** | idx_sessions_updated | (updated_at DESC) |

#### `session_messages`
| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL | PK |
| session_id | INTEGER | NOT NULL FK → sessions ON DELETE CASCADE |
| role | TEXT | CHECK (role IN ('user','assistant')) |
| content | TEXT | NOT NULL |
| intent | TEXT | nullable |
| thinking | TEXT | nullable |
| places_json | JSONB | nullable |
| itinerary_id | INTEGER | FK → itineraries ON DELETE SET NULL |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| **Index** | idx_session_messages_session | (session_id) |

### Migrations
- `001_init.sql` — places, itineraries, itinerary_items
- `002_sessions_and_places.sql` — sessions, session_messages
- `003_day_number.sql` — ALTER itinerary_items ADD COLUMN day_number
- `run_migration.mjs` — runner script (connects as postgres to inclusive_tourism_mvp)

---

## 6. External API Dependencies

| API | Endpoint | When Called | Rate Limit | Auth |
|-----|----------|-------------|-----------|------|
| **Overpass API** | `https://overpass-api.de/api/interpreter` | placeResolver.resolveStops, accessibilityService queries | ~10k req/day per IP | None |
| **Nominatim** | `https://nominatim.openstreetmap.org/search` | placeResolver fallback geocoding | 1 req/sec | User-Agent header |
| **OSRM** | `https://router.project-osrm.org/route/v1/walking/...` | routingService.getRoute | Generous (but rate-limited at high volume) | None |
| **llama.cpp** | `http://127.0.0.1:8081/v1/chat/completions` | agent.ts, llmGateway.ts, llmClassify | N/A (local) | None |

**No API keys are stored** — all external APIs are free and keyless.

---

## 7. Configuration & Environment

### Backend `.env`
```
PORT=4000
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=inclusive_tourism_mvp
LLAMA_HOST=http://127.0.0.1:8081
OSRM_BASE=https://router.project-osrm.org
OVERPASS_BASE=https://overpass-api.de/api/interpreter
NOMINATIM_BASE=https://nominatim.openstreetmap.org
```

### Frontend `.env.local`
```
NEXT_PUBLIC_API_HOST=http://localhost:4000
```

### next.config.js
```js
reactStrictMode: true
rewrites: [{ source: '/api/:path*', destination: 'http://localhost:4000/:path*' }]
```

---

## 8. Test Coverage

| File | What It Tests | Status |
|------|--------------|--------|
| `test-tools.mjs` | 14 tests: search, create, get, list, edit, delete, route, transport, alternatives, accessibility, optimize, search DB | All pass |
| `test-tools.ps1` | PowerShell version of same suite | Pass |

**Test flow**: Creates session → sends messages → polls for results → checks responses.

---

## 9. What Exists vs What Needs Building

### ✅ Already Working
- All 12 tool implementations
- Chat pipeline with conversation history
- Two-phase polling for real-time thinking
- Frontend SPA with 4 tabs
- Map rendering with markers and routes
- Database with 5 tables + 3 migrations
- Place resolution from Overpass/Nominatim
- Walking route calculation from OSRM
- Accessibility data from Overpass
- Model switching for llama.cpp
- 14 end-to-end tests passing

### 🔧 Needs Setup / Config for V1
- PostgreSQL connection (already running, may need V1 database)
- Frontend Next.js dependencies (npm install)
- LLM server must be running

### 📋 Planned for V1 Iteration
- Test tool calling in ALL situations (edge cases, multi-turn, error recovery)
- Verify places info correctness (cross-check curated data)
- Verify itineraries are humanly doable (walking distances, opening hours, accessibility)
- Build fake LLM API calling layer that mirrors online API format (OpenAI-compatible)
- Iterate on tool calling until all scenarios work reliably

### 🔮 Future Considerations (V2+)
See `POSSIBLE-FEATURES.md`
