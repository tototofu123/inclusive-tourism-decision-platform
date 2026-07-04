# Next Plans — Inclusive Tourism Platform V3

Last fix batch: 30+ issues resolved (Jun 2026). Builds passing: backend tsc ✓, frontend build ✓.

---

## Priority 1 — Demo Readiness (do first)

### [HIGH] Deferred: MTR dataset merge
**Files**: `tools.ts:737` (MTR_STATIONS[76]) + `accessibilityService.ts:16` (ACCESSIBLE_MTR[78])
**Plan**: Add `accessible: boolean` field to each entry in `MTR_STATIONS[]`, compute from the existing `ACCESSIBLE_MTR` lookup. Then replace all `isMTRStationAccessible()` calls with direct field access. Delete `ACCESSIBLE_MTR` object.
**Why deferred**: No code path broken — both datasets coexist and overlap; `isMTRStationAccessible` already works.

### [HIGH] Split 797-line frontend component
**File**: `frontend/src/pages/index.tsx:48-844`
**Plan**: Extract into 4 files:
- `components/ChatPanel.tsx` — messages, input, retry, thinking
- `components/MapPanel.tsx` — filters + MapView wrapper
- `components/ItineraryPanel.tsx` — detail view, day groups, stop cards
- `components/Header.tsx` — title, badges, buttons, dropdowns (sessions, prefs, settings, models)

### [HIGH] Extract inline styles → CSS classes
**File**: `frontend/src/pages/index.tsx` (~50 inline `style={{}}` objects)
**Plan**: Move all reusable styles to `globals.css` — button variants, dropdown containers, input fields, panels, badges. This improves render performance (no recreated objects) and enables theme changes.

---

## Priority 2 — Stability & Quality

### [MED] Remaining silent catch handlers
**File**: `frontend/src/pages/index.tsx` (check for remaining `.catch(() => {})`)
**Plan**: Replace with proper error handling — show toast for network failures, inline error for critical ops.

### [MED] Split `tools.ts` into modules
**File**: `backend/src/services/tools.ts` (1019 lines, single file)
**Plan**: Extract:
- `tools/mtr.ts` — MTR stations, travel times, nearest station, estimate time
- `tools/search.ts` — `searchPlaces`, `searchDatabaseTool`, `getPlaceAlternativesTool`
- `tools/itinerary.ts` — `createItineraryTool`, `editItineraryTool`, `getItineraryTool`, etc.
- `tools/route.ts` — `routeDistanceTool`, `findTransportTool`, `getTravelTimeTool`, `optimizeRouteTool`
- `tools/prefs.ts` — `setPreferencesTool`
- `tools/accessibility.ts` — `checkAccessibilityTool`

### [MED] Centralize HK region constants
**Currently**: 4+ copies of HK bounding boxes, 3+ copies of Kowloon center, region inference duplicated.
**Plan**: All region data in `constants.ts` (already created). Update `inferRegion()` in `placesPipeline.ts`, `resolveToolCoords()` in `tools.ts`, `inferRegion` in `placeResolver.ts`, and the bboxes in `placeResolver.ts` to use the shared constants.

### [MED] Injection pattern hardening
**File**: `backend/src/services/guard.ts`
**Plan**: Add detection for obfuscated attacks (zero-width chars, Unicode confusables, base64-encoded instructions). Add rate-based protection (3+ injection attempts = temp block).

---

## Priority 3 — Performance

### [LOW] Remove unused TripPlan flow
**Files**: `llmGateway.ts` (used), `types.ts` (LLMResponse), `agent.ts` (calls `planTrip` via tools)
**Plan**: Keep as-is — `planTrip` is called by `create_itinerary` tool. Dead code was already removed (`llmClassify`).

### [LOW] DB query — single trip plan query
**File**: `backend/src/db/client.ts` (`getFullItinerary`: 3 queries for itinerary + items + totals)
**Plan**: Merge into 2 queries (itinerary + items with calculated summary via window functions).

### [LOW] Preload MTR travel time matrix
**File**: `backend/src/services/tools.ts` (estimateMtrTime walks hashmap)
**Plan**: Precompute full `MTR_TRAVEL_TIMES` distance matrix at startup (Floyd-Warshall for all 76 stations) to handle any route without hardcoding.

---

## Already Good (no action needed)
- All DB queries use parameterized `$1, $2` ✓
- Dynamic import for Leaflet (SSR-safe) ✓
- Error boundary exists (softer reset now) ✓
- Rate limiting on all route groups ✓
- Process cleanup interval ✓
- Redis/DB caching for places + sessions ✓
- Overpass 30-min cache ✓
- Key redaction in settings ✓
- Pipeline Bearer token guard ✓

---

## Summary
High-impact items first: split the frontend component (797 lines → 4 files) and merge the MTR datasets. These are the biggest quality wins. Then tackle module extraction for tools.ts (1019 lines). Everything else is incremental improvement that can be done during demo downtimes.
