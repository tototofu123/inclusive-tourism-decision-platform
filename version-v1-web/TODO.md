# V1 TODO (Feb 7 — Next Steps)

## Phase A ✅ (Complete)
- [x] User preferences system (table + API + HK time/weather)
- [x] Agent integration (prefs injected into system prompt, multi-round loop)
- [x] Security guardrails (injection/off-topic detection + sanitization)
- [x] Architecture fixes (fetchWithTimeout in utils/http.ts, apiClient as single LLM entry point)
- [x] 14/14 tool tests pass

## Phase B ✅ (Complete)
- [x] Migration 005 applied (region, budget, accessibility_tags, area, place_type columns)
- [x] 159 places seeded across all 3 HK regions (Kowloon: 67, HK Island: 52, New Territories: 40)
- [x] DB-first placeResolver (searches places table before Overpass/Nominatim)
- [x] DB-first accessibilityService (checks places.accessibility_tags before Overpass)
- [x] Region-aware search (tools.ts passes region/budget to resolveStops)

## Phase C ✅ (Complete)
- [x] Migration 006 applied (transport_cost, entry_cost, transport_mode, confirmed, confirmed_at on itinerary_items)
- [x] saveItineraryItem/getFullItinerary updated with cost summary + confirmed count
- [x] Itinerary confirm/unlock routes set confirmed_at=NOW()
- [x] Frontend: Preferences modal (mobility, interests, budget_level, home_base)
- [x] Frontend: Cost summary + confirm/unlock buttons in Itinerary tab
- [x] Frontend: Region filter + accessibility score badges in Places tab

## Phase D 🔲 (Needs Verification)
- [ ] Verify multi-round agent loop with real queries (native tool-calling models)
- [ ] Test itinerary confirm/unlock flow end-to-end
- [ ] Test region filter with all 159 places
- [ ] Test preferences injection into system prompt

## Known Issues
- Overpass API unreachable from current network (transient — affects real-time POI fallback)
- Frontend `globals.css` copied from MVP — may need V1-specific style updates
- DB default changed from `inclusive_tourism_mvp` to `inclusive_tourism_v1`
- Seed script needs `NODE_PATH=backend/node_modules` or run from backend dir
- Preferences modal uses comma-separated input for interests (not array chips)
