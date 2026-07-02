# Plan: Personalized Features & Expanded Places

## AGENTS.md + SKILL.md
See Phase A — guides for future agents on this project.

---

## Phase A — Foundation: User Preferences + Agent Memory

**Goal:** Remember who the user is (mobility, interests, budget, home base) and let LLM act intentionally across long conversations.

### DB — `user_preferences` table
```sql
CREATE TABLE user_preferences (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
  mobility TEXT DEFAULT 'none',              -- 'wheelchair' | 'cane' | 'walking' | 'none'
  interests TEXT[] DEFAULT '{}',              -- e.g. {'museum','park','shopping'}
  budget_level TEXT DEFAULT 'medium',         -- 'low' | 'medium' | 'high'
  home_base TEXT DEFAULT '',                  -- e.g. 'Tsim Sha Tsui'
  urgent_mode BOOLEAN DEFAULT false,          -- itinerary confirmed = locked
  confirmed_itinerary_id INTEGER DEFAULT NULL, -- which itin is locked
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### API
| Method | Path | Description |
|--------|------|-------------|
| GET | `/preferences/:sessionId` | Get preferences |
| POST | `/preferences/:sessionId` | Set/update preferences (partial, same endpoint) |
| DELETE | `/preferences/:sessionId` | Reset to defaults |

### Integration into `agent.ts`
- Load preferences from DB before building messages
- Inject into system prompt as: `"User profile: wheelchair user, interested in museums & parks, medium budget, staying in TST."`
- When `urgent_mode=true` and `confirmed_itinerary_id` set: append `"This itinerary #N is CONFIRMED — do not suggest changes unless user asks."`
- Thinking steps: already emitting real-time via `onThink()` — extend to show "Checking preferences...", "Loading itinerary #N...", "Searching places near TST..."

### Frontend
- Preference panel in header gear icon (modal with fields)
- "Confirm Itinerary" / "Unlock" button per itinerary view
- Confirmed = lock icon, edit/delete hidden, unlock button shown
- Thinking steps displayed in chat area (not blank box — shows real progress)

### Files
| File | Action |
|------|--------|
| `AGENTS.md` | **NEW** |
| `.opencode/skills/v1-tool-calling/SKILL.md` | **NEW** |
| `database/migrations/004_user_preferences.sql` | **NEW** |
| `backend/src/services/preferencesService.ts` | **NEW** — load/save/merge logic |
| `backend/src/routes/preferences.ts` | **NEW** — REST endpoints |
| `backend/src/routes/chat.ts` | **MODIFY** — load prefs before calling processChat |
| `backend/src/services/agent.ts` | **MODIFY** — inject prefs into system prompt |
| `backend/src/services/tools.ts` | **MODIFY** — accept budget/prefs in search_places |
| `frontend/src/pages/index.tsx` | **MODIFY** — prefs modal, confirm button, thinking display |

---

## Phase B — Expanded Places (~300) + Database Seed

**Goal:** Replace JSON-only curated dataset with database-backed place catalog across all 3 HK regions.

### DB-first approach
- `places` table already exists (from migration 001) with: `id, name, lat, lng, category, description, source_api`
- **Add columns** (migration 005):
  - `region TEXT` — `'kowloon' | 'hong_kong_island' | 'new_territories'`
  - `budget TEXT` — `'free' | 'cheap' | 'moderate' | 'expensive'`
  - `accessibility_tags TEXT[]` — e.g. `{'wheelchair_accessible','accessible_toilet'}`
  - `accessibility_score INTEGER` — 0-5
  - `address TEXT`, `opening_hours TEXT`, `tags TEXT[]`, `notes TEXT`
  - `area TEXT` — fine-grained district (e.g. 'Tsim Sha Tsui', 'Central')
  - `place_type TEXT` — `'attraction' | 'hotel' | 'restaurant' | 'transport_hub' | 'toilet' | 'rest_stop'`

### ~300 place seed script
- Create `database/seed_places_v1.mjs` that inserts ~300 places across 3 regions
  - Kowloon: ~100 (museums, parks, shopping malls, MTR stations, viewpoints, temples, markets, historic sites, hotels, restaurants)
  - HK Island: ~100 (Central, Admiralty, Wan Chai, Causeway Bay, The Peak, Sheung Wan, Kennedy Town)
  - New Territories: ~100 (Sha Tin, Tsuen Wan, Tuen Mun, Yuen Long, Tai Po, Sai Kung)
- Run: `node database/seed_places_v1.mjs`

### Place source strategy
| Source | Priority | Used for |
|--------|----------|----------|
| Curated data (manually compiled) | 1 | Core ~300 places with verified accessibility data |
| Overpass API | 2 | Real-time POI search for dynamic queries |
| Nominatim fallback | 3 | When nothing else found |

### `placeResolver.ts` updates
- First: search `places` table by region + category + keyword
- If not found: fall back to Overpass (region-specific bounding boxes)
- Overpass bounding boxes:
  - Kowloon: `(22.29,114.15,22.34,114.20)`
  - HK Island: `(22.24,114.12,22.30,114.28)`
  - New Territories: `(22.35,113.95,22.55,114.35)`
- `resolveToolCoords()`: also search new places table by region

### `tools.ts` updates
- `search_places`: accept `region`, `budget` params in `firstOf()`
- `check_accessibility`: check places table `accessibility_tags` BEFORE Overpass query
- New tool idea: `find_nearby_hotel(budget, area)` — query places where `place_type='hotel'`

### Frontend
- Places tab: region filter (All / Kowloon / HK Island / New Territories)
- Place cards: show accessibility score, budget level, region badge
- Map: color-coded markers per region

### Files
| File | Action |
|------|--------|
| `database/migrations/005_places_expand.sql` | **NEW** — add region, budget, accessibility columns |
| `database/seed_places_v1.mjs` | **NEW** — insert ~300 places |
| `backend/src/services/placeResolver.ts` | **MODIFY** — region-aware, DB-first lookups |
| `backend/src/services/tools.ts` | **MODIFY** — region/budget filters, hotel search |
| `backend/src/services/accessibilityService.ts` | **MODIFY** — check DB tags before Overpass |
| `backend/src/db/client.ts` | **MODIFY** — add seed-check function |
| `frontend/src/pages/index.tsx` | **MODIFY** — region filter, badges |

---

## Phase C — Itinerary Deepening: Cost, Hotels, Confirmation, Transport

**Goal:** Itineraries become actionable plans with real costs, accommodation, transport modes, and a confirm/lock flow.

### DB — new columns on `itinerary_items`
Migration 006:
```sql
ALTER TABLE itinerary_items ADD COLUMN IF NOT EXISTS stop_type TEXT DEFAULT 'attraction';
ALTER TABLE itinerary_items ADD COLUMN IF NOT EXISTS estimated_cost TEXT DEFAULT 'moderate';
ALTER TABLE itinerary_items ADD COLUMN IF NOT EXISTS accessibility_note TEXT DEFAULT '';
ALTER TABLE itinerary_items ADD COLUMN IF NOT EXISTS transport_mode TEXT DEFAULT '';  -- 'walk' | 'mtr' | 'bus' | 'taxi'
ALTER TABLE itinerary_items ADD COLUMN IF NOT EXISTS transport_cost NUMERIC DEFAULT 0;  -- HKD estimate
ALTER TABLE itinerary_items ADD COLUMN IF NOT EXISTS hotel_id INTEGER REFERENCES places(id);
ALTER TABLE itinerary_items ADD COLUMN IF NOT EXISTS confirmed BOOLEAN DEFAULT false;
```

### Flow
1. User builds itinerary → items created with `confirmed=false`
2. User clicks "Confirm Itinerary" → frontend calls `POST /itineraries/:id/confirm`
3. Backend sets `confirmed=true`, updates `user_preferences.urgent_mode=true, confirmed_itinerary_id=id`
4. LLM system prompt for subsequent messages: "Current itinerary #N is CONFIRMED. Only modify if user explicitly asks."
5. Frontend: confirmed items show lock icon, edit/delete hidden, "Unlock" button shown

### Cost tracking
- `tools.ts`: `create_itinerary` returns estimated total cost (sum of `estimated_cost` → numeric mapping)
  - free=0, cheap=50, moderate=200, expensive=500
  - Transport costs summed from `transport_cost`
- `search_places`: `budget` param filters places (DB query)
- LLM prompt includes: "User budget: medium" → LLM avoids recommending expensive places

### Transport mode
- `findTransportTool`: returns MTR/bus/walk option with `transport_cost` estimate
  - MTR: ~5-15 HKD per trip
  - Bus: ~4-12 HKD per trip  
  - Taxi: ~24 HKD flagfall + per-km
- Store chosen `transport_mode` + `transport_cost` on `itinerary_items`
- Itinerary view shows total ± transport cost breakdown

### Accessibility inline
- Each itinerary stop shows accessibility tags from `places` table
- `check_accessibility` tool always called during itinerary creation flow
- LLM prompt always includes user mobility profile

### Files
| File | Action |
|------|--------|
| `database/migrations/006_itinerary_items_expand.sql` | **NEW** |
| `backend/src/routes/itinerary.ts` | **MODIFY** — add `/confirm` endpoint |
| `backend/src/services/tools.ts` | **MODIFY** — cost estimates, transport mode tracking |
| `backend/src/services/routingService.ts` | **MODIFY** — HKD cost estimates per mode |
| `backend/src/services/agent.ts` | **MODIFY** — urgent mode prompt injection |
| `frontend/src/pages/index.tsx` | **MODIFY** — confirm button, lock state, cost summary |

---

## Phase D — Date/Time + Weather + Long-Task Agent Loop

**Goal:** LLM knows the current HK date/time/weather, can plan day-by-day realistically, and runs as a persistent agent across long conversations (not one-shot).

### HK Date/Time
- `preferencesService.ts`: `getHKTime()` function
  - Option A: `fetch('https://worldtimeapi.org/api/timezone/Asia/Hong_Kong')` → live HK time
  - Option B: fallback = `new Date().toLocaleString('en-HK', {timeZone:'Asia/Hong_Kong'})`
  - Returns: `{ datetime, weekday, hour, date_str }`
- Injected into system prompt: `"Current HK time: Friday 14:30, 3 July 2026. Weather: sunny, 32°C."`

### Weather (rough)
- No live weather API (V2 feature)
- Infer from hour:
  - 06-09: "sunrise, mild ~25°C"
  - 09-12: "morning, warm ~28°C"
  - 12-15: "afternoon, hot ~32°C"
  - 15-18: "late afternoon, warm ~30°C"
  - 18-21: "evening, mild ~26°C"
  - 21-06: "night, cool ~23°C"
- Season hint: July = "summer, hot and humid, chance of rain"

### Long-task Agent Loop
- Current: one LLM call → tool execution → return (or second LLM call for native models)
- New: **agent can chain multiple tool calls** in a single user message
  - Example: "Plan a 3-day Kowloon trip for a wheelchair user" → LLM calls `search_places` (x3 categories) → `create_itinerary` → `check_accessibility` (x3 stops) → `find_transport` (x2 routes) → returns final plan
- This already works with the tool-calling format (`TOOL:` or `<|tool_call|>`)
- Enhancement: **loop the agent** — after tool results, feed back to LLM with instruction "Continue or summarize" until LLM outputs no tool calls
  - Currently: custom format models skip second LLM call
  - Change: always make second LLM call with `"Continue planning or summarize"` instruction, keep looping until LLM responds naturally
  - Max 5 iterations to prevent infinite loops

### Thinking step visibility
- Each LLM call iteration emits a thinking step:
  - `"Planning day 1 stops..."` / `"Checking accessibility for Museum of History..."` / `"Calculating transport costs..."` 
  - `"Replanning based on accessibility results..."` / `"Finalizing itinerary..."` / `"Done!"`
- Frontend: thinking steps shown as a live-updating list in chat area (already done, just need richer steps)

### Files
| File | Action |
|------|--------|
| `backend/src/services/preferencesService.ts` | **MODIFY** — add `getHKTime()`, `getWeather()` |
| `backend/src/services/agent.ts` | **MODIFY** — loop agent (max 5 rounds), inject date/time/weather |
| `backend/src/services/tools.ts` | **MODIFY** — accept `day` in stops for multi-day planning |
| `backend/src/services/placeResolver.ts` | **MODIFY** — region-aware day distribution |
| `frontend/src/pages/index.tsx` | **MODIFY** — richer thinking display with iteration counter |

---

## Implementation Order

```
Phase A (Foundation) ───────► Phase B (Places) ───────► Phase C (Itinerary) ───────► Phase D (Agent Loop)
     Prefs table                ~300 places DB seed         Confirm/lock flow               HK time/weather
     Prefs API                  Region query                 Cost tracking                   Multi-round agent
     Prompt injection           DB-first resolver            Transport cost                  Richer thinking
     Prefs modal + frontend     Accessibility from DB        Inline accessibility            5-iteration loop
```

Each phase builds on the previous. Verify all edge cases before moving to next.

---

## Guiding Principles
1. **No Docker** — PostgreSQL native install only
2. **Dataset in DB, not JSON** — all curated places stored in `places` table with migrations
3. **apiClient.ts is the single entry point** for all LLM calls — all phases update it consistently
4. **No black box** — every LLM step visible in chat via thinking steps
5. **Edge case testing after every phase** — run full test suite, verify security, verify no regressions
