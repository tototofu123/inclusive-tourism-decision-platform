# V3 Codebase — 51 Issues Found During Audit

## 🔴 CRITICAL (5)

### C1. LIVE API KEYS IN `.env`
Both `GEMINI_API_KEY` and `MAPS_API_KEY` are in plaintext. The `.env` file may have been committed before being added to `.gitignore`.

### C2. GEMINI_API_KEY FORMAT
Key starts with `AQ.` instead of `AIza`. May be invalid or truncated. Every Gemini call fails with auth errors.

### C3. FRONTEND POLLING LOOP HAS NO CLEANUP
`index.tsx:229-289` — 200ms polling loop with no AbortController. Runs indefinitely on unmount, causing React state warnings and memory leaks.

### C4. SECRETS DIRECTORY EMPTY
`GOOGLE_APPLICATION_CREDENTIALS=./secrets/app-sa-key.json` — file doesn't exist. Vertex AI fallback always fails.

### C5. RATE LIMITER `setInterval` NO CLEANUP
`rateLimiter.ts:67` and `chat.ts:24` — module-level `setInterval` accumulates with hot-reload, causing memory leaks.

---

## 🟡 MAJOR (11)

### M1. `GET /models` AND `POST /models/switch` DO NOT EXIST
Frontend calls these but no backend routes exist. Model dropdown is permanently empty. Feature is broken.

### M2. RAG IS A TOY
`ragService.ts` uses `simpleEmbed` — char-code bucket fill, not semantic embedding. Search loads ALL rows into memory. RAG toggle in settings does nothing.

### M3. ITINERARY DAY ASSIGNMENT BROKEN AFTER REORDER
`tools.ts:346-381` — `llmPlan.stops[i]?.day` references pre-reorder index `i` after `nearestNeighborReorder`. Day assignments get scrambled.

### M4. WALKING SPEED NOT ADJUSTED FOR MOBILITY
`tools.ts:551` and `index.tsx:363` — hardcoded 80m/min (~4.8 km/h). Wheelchair users (~2-3 km/h) and slow walkers get overestimated times.

### M5. OVERPASS REGEX INJECTION VULNERABILITY
`accessibilityService.ts:130` — place name interpolated into Overpass QL query with minimal sanitization. SSRF vector.

### M6. OVERPASS BOUNDING BOX TOO SMALL
`accessibilityService.ts:130` — `(22.29,114.15,22.34,114.20)` covers only central Kowloon (~5km²). HK Island and NT never match.

### M7. FRONTEND BYPASSES NEXT.JS API PROXY
`index.tsx:5` uses `localhost:4000` directly instead of `/api` path. Rewrites in `next.config.js` are useless.

### M8. placesPipeline INSERT CAN DUPLICATE
`placesPipeline.ts:66-79` — `ON CONFLICT DO NOTHING` without confirmed unique constraint. Pipeline runs create duplicates.

### M9. MTR STATIONS: 23 NOT 40+
Actual data has 23 stations (all Kowloon). Documentation claims 40+. Missing HK Island line, Tsuen Wan, Tung Chung, Airport Express, Disney, South Island, East Rail.

### M10. MTR_TRAVEL_TIMES VERY SPARSE
`tools.ts:723-733` — only 9 of 23 stations have entries. Most lookups fall through to heuristic defaults (15 min).

### M11. NO ABORT CONTROLLER FOR DUPLICATE CHATS
If user sends second message while first is loading, two polling loops run, both updating last message slot. Race conditions.

---

## 🔵 MINOR (23)

### m1. `/places/pipeline` IN WRONG FILE
Defined in `chat.ts:144-153` instead of `places.ts`.

### m2. DEFAULT PLACES LIMIT 9999
`places.ts:8` — returns nearly all rows. Should default to 50-100.

### m3. "FAKE UI" LABEL VISIBLE
`index.tsx:596` — red "FAKE UI" debug text visible during demo. Alarming to judges.

### m4. RATE LIMITER `/api/*` PREFIX DOESN'T MATCH ROUTES
Routes registered without `/api` prefix (`/chat`, `/places`) but rate limiter middleware targets `/api/chat`, etc.

### m5. PROCESS ID CLEANUP BUG
`chat.ts:27` — `parseInt(id.split('-')[0])` returns `NaN` for IDs without `-`, never cleaned up.

### m6. `getHKTime()` DUPLICATED
`timeService.ts` and `preferencesService.ts` both define `getHKTime()` and `getWeather()`. Dead code in preferencesService.

### m7. CONTRADICTORY FORCE-STOP MESSAGES
`agent.ts:199,205` — two different "stop calling tools" messages with different forcefulness. Confuses LLM.

### m8. CSS TYPEWRITER EXCESSIVE max-height
`globals.css:88-89` — `max-height: 2000px` causes visible layout jumps.

### m9. NO ERROR BOUNDARY
`_app.tsx` — no React Error Boundary. Any render crash kills the whole app.

### m10. NO ALT TEXT OR ARIA LABELS
Gear button (`⚙`), model switcher, dropdowns — no `aria-label`, no `role` attributes, no keyboard nav.

### m11. TIMER NOT CLEANED ON UNMOUNT
`index.tsx:167` — `setTimeout` in `fetchDetail` not cleaned if component unmounts before completion.

### m12. MOBILITY NORMALIZATION INCONSISTENCY
`tools.ts:656-682` — LLM might pass `wheelchair_user` while DB stores `wheelchair`. Normalization works but no inconsistency detection.

### m13. SEARCH KEYWORD MATCHING BRITTLE
`tools.ts:258-271` — only `.includes()` on exact terms. "bistro", "diner", "brunch" miss all categories.

### m14. EUCLIDEAN DISTANCE FOR GEOGRAPHIC COORDS
`tools.ts:240` — `Math.sqrt((lat diff)² + (lng diff)²)` should use haversine formula.

### m15. resolveToolCoords FALLBACK IS KOWLOON CENTER
`tools.ts:516` — unresolved place names get `22.319, 114.170`. HK Island places get wildly wrong distances.

### m16. findNearestMtr DISTANCE TOO LARGE
`tools.ts:720` — `bestDist < 0.05` (~5.5 km). Should be ~1-2 km for realistic walking.

### m17. simpleEmbed 128-DIM BUT OTHER MODELS DIFFERENT
`ragService.ts:15` — 128-dim vector. Real embedding models use 768+ dims. Mixing dimensions gives garbage.

### m18. SESSION HISTORY NO DEDUPLICATION
`agent.ts:82-92` — session messages loaded from DB may contain duplicates from race conditions.

### m19. NO TYPE SAFETY FOR TOOL ARGUMENTS
`tools.ts:768-834` — all args pass through `firstOf()` string matching. No Zod/TypeScript guards.

### m20. ENV VARIABLE NAMING MISMATCH
`index.tsx:5` — uses `NEXT_PUBLIC_API_HOST` but `.env.local` defines `NEXT_PUBLIC_API_URL`.

### m21. placesPipeline SEARCHES FOR MTR (DUPLICATE)
Pipeline searches "accessible MTR station" but MTR data is hardcoded separately. Creates unsynchronized duplicates.

### m22. MAP INITIALLY CENTERS ON KOWLOON
`MapView.tsx:11` — `KOWLOON_CENTER: [22.31, 114.17]`. Brief flash of wrong area for HK Island/NT itineraries.

### m23. L IMPORTS RELY ON SIDE EFFECTS
`MapView.tsx:61` — `L.latLngBounds([])` depends on unshakable default import. Fragile with tree-shaking.

---

## ⚪ MISSING FEATURES (12)

### F1. NO MODEL SELECTION API (BACKEND)
`GET /models` and `POST /models/switch` don't exist. Model dropdown UI is permanently broken.

### F2. NO USER AUTHENTICATION
Zero auth. Sessions by numeric ID. No data isolation. Refresh loses all state.

### F3. NO RESPONSIVE DESIGN
Header buttons overflow on narrow screens. No media queries. Tablet/projector viewport breaks.

### F4. NO LOADING SKELETONS
"Itinerary loading..." text. No shimmer/skeleton effects.

### F5. NO ERROR RECOVERY / RETRY
If chat fails mid-way, no "Retry" button. Stuck loading forever if polling returns 404.

### F6. RAG TOGGLE DOES NOTHING
Settings has RAG toggle but both "local" and "text-embedding-004" use toy embedding. No actual RAG.

### F7. NO CACHING LAYER
Every `search_places` hits DB. Same query twice = two DB calls. No in-memory cache.

### F8. NO NOTIFICATIONS FOR URGENT MODE
`confirmed_itinerary_id` stored but never acted on. No email/SMS/notification integration.

### F9. NO SHARE ITINERARY
No export, no share link, no PDF. Itinerary exists only in DB.

### F10. FRONTEND ITSELF NOT ACCESSIBLE
No `aria-` attributes, no keyboard nav, no `role`, no `lang`, no contrast check, no focus indicators.

### F11. NO TESTS
Zero unit, integration, or E2E tests in V3.

### F12. favicon.svg VALIDITY UNVERIFIED
`frontend/public/favicon.svg` may be invalid SVG.

---

**Total: 51 issues**
