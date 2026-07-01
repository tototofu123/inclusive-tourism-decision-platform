# V1 — Inclusive Tourism HK (Tool-Calling)

V1 builds on the MVP with PostgreSQL persistence, a fake LLM API layer with multi-provider support (`apiClient.ts`), security guardrails, and thorough tool-calling verification. All LLM calls route through a unified interface.

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ (native install, no Docker)
- [llama.cpp](https://github.com/ggerganov/llama.cpp) with a 3B–9B GGUF model (Qwythos-9B-Claude-Mythos-5-1M-Q4_K_M.gguf recommended)

### 1. Database

```bash
createdb inclusive_tourism_v1
cd version-v1-web/database
node run_migration.mjs  # runs 001_init.sql, 002_sessions_and_places.sql, 003_day_number.sql
```

### 2. Backend

```bash
cd version-v1-web/backend
cp .env.example .env          # edit DB credentials, LLAMA_HOST
npm install
npx tsx src/index.ts          # starts on :4000
```

### 3. Frontend

```bash
cd version-v1-web
npm install
npx webpack serve             # starts on :3000
```

### 4. LLM

```bash
llama-server -m models/Qwythos-9B-Claude-Mythos-5-1M-Q4_K_M.gguf --port 8081 -ngl 99
```

Open http://localhost:3000

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Server + DB + LLM health check |
| POST | `/chat` | Send message, returns `processId` immediately |
| GET | `/chat/status/:processId` | Poll for result (every 200ms) |
| GET | `/models` | List available `.gguf` models + API providers |
| POST | `/models/switch` | Switch model (local GGUF) or provider (openai/anthropic/google) |
| GET | `/itineraries` | List all saved itineraries |
| POST | `/sessions` | Create new chat session |
| GET | `/sessions` | List chat sessions |
| GET | `/sessions/:id` | Get session details + messages |

### POST /chat

```json
{ "text": "find museums in kowloon", "sessionId": 1 }
```

Response: `{ "processId": "1717200000000-abc12345" }`

Then poll `GET /chat/status/1717200000000-abc12345` until `done: true`.

## Architecture

```
Browser (no framework, plain HTML/CSS/TS)
  └─ Tabbed SPA: Chat | Map | Itinerary | Places
       └─ POST /chat → processId (two-phase polling)
            └─ backend/src/services/agent.ts
                 ├─ apiClient.ts  ──►  llama.cpp :8081 (or OpenAI/Anthropic/Google)
                 ├─ tools.ts      ──►  12 tool implementations
                 │                    search_places, create_itinerary, get_itinerary,
                 │                    list_itineraries, edit_itinerary, delete_itinerary,
                 │                    route_distance, find_transport, get_travel_time,
                 │                    get_place_alternatives, check_accessibility, optimize_route
                 ├─ parseToolCalls()  ──►  TOOL: and <|tool_call|> format parsing
                 └─ guard.ts          ──►  Prompt injection & off-topic detection
```

## Tool Calling Flow (Qwythos-9B)

1. User sends message → `POST /chat` → returns `processId` immediately
2. Background `processChat()` sends messages to LLM (no `tools` param — Qwythos ignores native tool calling)
3. LLM responds with `<|tool_call|>call:ToolName{args}<|tool_call|>` or `TOOL: ToolName { args }`
4. `parseToolCalls()` extracts name/args, `executeTool()` runs the tool
5. Tool result returned directly (no second LLM call for custom-format models)
6. Frontend polls `GET /chat/status/:processId` every 200ms for real-time thinking updates

For models that support native `tool_calls` (gemma4, GPT-4o), a second LLM call generates natural language from tool results.

## Key Files

| File | Purpose |
|------|---------|
| `backend/src/services/apiClient.ts` | Unified LLM API layer — local/openai/anthropic/google |
| `backend/src/services/agent.ts` | `processChat()`, `parseToolCalls()`, dual-format parser |
| `backend/src/services/tools.ts` | 12 tool implementations with `firstOf()` flexible arg mapping |
| `backend/src/services/guard.ts` | Input sanitization, prompt injection & off-topic detection |
| `backend/src/services/placeResolver.ts` | Overpass/Nominatim place resolution with MTR station matching |
| `backend/src/routes/chat.ts` | Two-phase polling chat endpoint |
| `backend/src/routes/models.ts` | Model listing and switching (local GGUF + API providers) |
| `database/migrations/` | 3 SQL migration files (5 tables) |
| `SPEC.md` | Complete codebase analysis (all files, functions, tools, DB schema, API deps) |
| `POSSIBLE-FEATURES.md` | V2+ enhancements (caching, auth, data quality, UX, monitoring) |

## Tests

```bash
cd version-v1-web
node test-tools.mjs   # 14 tool-calling tests
```

## External APIs

| API | Purpose | Key Required |
|-----|---------|-------------|
| Overpass API | Place search by category (Kowloon bounding box) | No |
| Nominatim | Fallback place search | No |
| OSRM | Walking route distance/duration | No |
| llama.cpp | All LLM inference (local) | No |

## Provider Switching

Switch between LLM providers at runtime via `POST /models/switch`:

```json
{ "provider": "openai", "apiKey": "sk-...", "model": "gpt-4o" }
{ "provider": "local", "model": "Qwythos-9B-Claude-Mythos-5-1M-Q4_K_M.gguf" }
```
