# Inclusive Tourism Decision Platform — V3 Workspace Guide

## Project
- `version-web-v3/` is the active development directory
- `version-web-v2/` is frozen reference
- Backend: `backend/src/index.ts` (port 4000, tsx)
- Frontend: `frontend/src/pages/index.tsx` (port 3000, Next.js)
- Database: `inclusive_tourism_v1` on `CLOUD_SQL_HOST:5432`

## LLM Flow
- **Primary**: Gemini API via AI Studio key (`GEMINI_API_KEY` in `.env`)
- **Fallback**: local llama.cpp at `LLAMA_HOST` (default `http://127.0.0.1:8081`)
- Models tried in order: `gemini-2.0-flash-001` → `gemini-2.0-flash-lite` → `gemini-1.5-flash-002` → local llama
- All calls through `apiClient.chatCompletion()` in `services/apiClient.ts`

## Tool Calling
- Gemini uses native `functionDeclarations` / `functionCall` format
- Local llama uses OpenAI-compatible `tool_calls` array
- All tools defined in `services/tools.ts` `TOOLS` array
- `firstOf(args, ...keys)` maps unpredictable model arg names
- Tool results returned to LLM for summarization

## Accessibility
- `accessibilityService.ts` has hardcoded list of 55+ accessible MTR stations
- `check_accessibility` tool queries: DB → Overpass (OSM tags) → returns "unknown"
- `getAccessibleTransitRoute` in `routingService.ts` uses Google Routes TRANSIT mode
- When user mobility is set, system prompt explicitly tells LLM to filter results

## Preferences
- `user_preferences` table, one row per session
- Fields: mobility, interests[], budget_level, home_base, urgent_mode, confirmed_itinerary_id
- Loaded in `agent.ts` before building messages, injected into system prompt
- Updated via `POST /preferences/:sessionId` or by LLM's `set_preferences` tool

## Routes
| Route | Purpose |
|-------|---------|
| `POST /chat` | Async chat, returns processId, poll `/chat/status/:id` |
| `GET /chat/status/:id` | Poll for completion |
| `GET /itineraries` | List all itineraries |
| `GET /itinerary/:id` | Full itinerary details |
| `POST /itinerary/:id/confirm` | Urgent mode — lock itinerary |
| `POST /itinerary/:id/unlock` | Release urgent mode |
| `GET /places` | Search places from DB |
| `GET /preferences/:sessionId` | Get session preferences |
| `POST /preferences/:sessionId` | Update session preferences |
| `GET /health` | Server health with LLM status |

## Hackathon Demo Flow
1. User types "I use a wheelchair, find accessible museums"
2. LLM calls `set_preferences` → saves mobility=wheelchair
3. LLM calls `search_places` → queries DB for museums in region
4. LLM calls `check_accessibility` for each result → filters to step-free only
5. LLM calls `create_itinerary` → plans route with short walking distances
6. Response includes wheelchair-accessible museum recommendation with transit directions
