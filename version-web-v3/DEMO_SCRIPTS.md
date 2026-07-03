# Inclusive Tourism Decision Platform V3 — Hackathon Demo Scripts

## Setup Checklist (before demo starts)

- [ ] Backend running on `localhost:4000` — `GET /health` returns `{"status":"ok"}`
- [ ] Frontend running on `localhost:3000` — loads the 4-tab UI
- [ ] LLM reachable: check `GET /models` shows at least one model (Gemini or local)
- [ ] Places DB pre-seeded: `GET /places` returns ~100+ entries
- [ ] Clear browser cache / start fresh session for each script
- [ ] Open browser DevTools → Network tab (to show judge real-time tool calls)

---

## Script 1: Wheelchair User — "Accessible museums in Kowloon"

### Exact User Query

> "I use a wheelchair and I want to visit accessible museums in Kowloon. I also need an itinerary for a day trip starting from Tsim Sha Tsui with accessible transport."

### System Flow (tool calls the LLM makes)

```
→ set_preferences(mobility: "wheelchair")
→ search_places(query: "museums in Kowloon", region: "kowloon")
→ check_accessibility(place_name: "Hong Kong Museum of Art")
→ check_accessibility(place_name: "Hong Kong Space Museum")
→ check_accessibility(place_name: "Hong Kong Heritage Discovery Centre")
→ create_itinerary(preferences: "wheelchair-accessible museums in Kowloon starting from Tsim Sha Tsui", days: 1)
```

### What Judge Sees On Screen

| Stage | Tab | Visual |
|-------|-----|--------|
| Typing query | **Chat** | User message appears in blue bubble |
| `set_preferences` | **Chat** | Thinking steps show: *"Running tool: set_preferences... Saved your preferences!"* |
| `search_places` | **Chat** | Thinking: *"Searching kowloon for matching places... Found 5 places in kowloon"* |
| `check_accessibility` (×3) | **Chat** | Thinking: *"Running tool: check_accessibility..."* for each museum |
| Final response | **Chat** | LLM outputs wheelchair-accessible recommendations with step-free details |
| "Itinerary #1" button appears | **Chat** | Button: *"Itinerary #1 ›"* and *"Show on Map (3)"* |
| Click "Itinerary #1 ›" | **Itinerary** | Day 1 card: 3 stops with walking distances, times, route lines |
| Click "Show on Map" | **Map** | 3 markers (numbered 1→2→3) with walking route polylines between them |

### What to Tell Judges

> "The LLM immediately saved 'wheelchair' as the user's mobility preference. Every subsequent search and check was filtered for step-free access. The itinerary reordered stops to minimize walking distance and called `find_transport` behind the scenes to verify MTR stations on the route have elevators. The Map tab shows the walking route with real OSRM data, not straight-line distances."

### Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| LLM skips `check_accessibility` | Gemini not reading system prompt correctly | Switch to local model via Model dropdown in header, or rephrase query with "only wheelchair accessible" |
| "429 Resource Exhausted" | Gemini quota exceeded | Auto-fallback to local llama (check `GET /health` for LLM status). Or manually switch model |
| Itinerary shows 0 stops | Museum category not in search_places DB | Check `GET /places` has entries with category `museum` in `kowloon` region |
| No route lines on map | OSRM unreachable | `check OSRM_BASE` env var; app falls back to straight-line (still shows markers) |

---

## Script 2: Hearing-Impaired User — "Cultural spots in Hong Kong"

### Exact User Query

> "I am hard of hearing. What cultural spots in Hong Kong work well for hearing-impaired visitors? Plan a route between 2-3 of them."

### System Flow (tool calls the LLM makes)

```
→ set_preferences(mobility: "hearing_impaired")
→ search_places(query: "cultural spots Hong Kong", region: "hong_kong")
→ check_accessibility(place_name: "Hong Kong Museum of History")
→ check_accessibility(place_name: "Hong Kong Cultural Centre")
→ check_accessibility(place_name: "Chi Lin Nunnery")
→ route_distance(from_lat, from_lng, to_lat, to_lng)   # 1st → 2nd
→ route_distance(from_lat, from_lng, to_lat, to_lng)   # 2nd → 3rd
```

### What Judge Sees On Screen

| Stage | Tab | Visual |
|-------|-----|--------|
| User query | **Chat** | Blue bubble with query |
| `set_preferences` | **Chat** | *"Saved your preferences: mobility: hearing_impaired"* |
| `search_places` | **Chat** | *"Found 4 places in hong kong"* — semantic search may supplement |
| `check_accessibility` (×3) | **Chat** | Each returns accessibility tags — judge sees *"hearing loop: ✅"* if available in OSM data |
| `route_distance` (×2) | **Chat** | *"Walking distance: 1.2 km (approx 14 min)"* between stops |
| Final response | **Chat** | LLM recommends visual-heavy spots, mentions hearing loops, suggests quiet times |
| "Show on Map (3)" | **Map** | 3 markers with route lines between them |

### What to Tell Judges

> "The LLM recognized 'hard of hearing' as `hearing_impaired` mobility type. It searches broadly across Hong Kong for cultural spots, then calls `check_accessibility` for each — if OpenStreetMap data includes `hearing_loop=yes` or `tactile_paving=yes`, the response surfaces that. The `route_distance` tool uses OSRM walking data so the judge sees real road distances, not Euclidean. The final recommendation prioritises visual/quiet venues over audio-heavy ones."

### Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| No hearing loop tags returned | OSM data missing for HK venues | Expected — system shows "unknown" and notes to contact venue. Judge can see the graceful fallback UX |
| Route distance is straight-line | OSRM timeout | Fallback to haversine — still fine for demo; mention it's a degraded fallback |
| Only 1-2 places found | Search_places limited by region param | Rephrase query with "Hong Kong Island" instead of "hong_kong" to avoid region ambiguity |

---

## Script 3: Slow Walker — "Parks close together on HK Island"

### Exact User Query

> "I walk slowly and get tired easily. Find me parks and peaceful spots in Hong Kong Island that are close together, no more than 5 minutes walking between them."

### System Flow (tool calls the LLM makes)

```
→ set_preferences(mobility: "slow")
→ search_places(query: "parks and peaceful spots", region: "hong_kong_island")
→ check_accessibility(place_name: "Hong Kong Park")
→ check_accessibility(place_name: "Kowloon Park")
→ check_accessibility(place_name: "Victoria Peak Garden")
→ optimize_route(stops: [Hong Kong Park, Kowloon Park, Victoria Peak Garden])
→ route_distance(from_lat, from_lng, to_lat, to_lng)   # optimized 1st → 2nd
→ route_distance(from_lat, from_lng, to_lat, to_lng)   # optimized 2nd → 3rd
```

### What Judge Sees On Screen

| Stage | Tab | Visual |
|-------|-----|--------|
| User query | **Chat** | Blue bubble |
| `set_preferences` | **Chat** | *"mobility: slow"* saved |
| `search_places` | **Chat** | Parks matching "peaceful" in HK Island |
| `check_accessibility` (×3) | **Chat** | Step-free paths, benches, shade info |
| `optimize_route` | **Chat** | *"Optimized route: Hong Kong Park → Zoo & Botanical Garden → Victoria Peak Garden"* |
| `route_distance` (×2) | **Chat** | Each returns real walking distances |
| Final response | **Chat** | LLM confirms all segments under 5 min walking for slow pace (~300m each), suggests rest spots |
| "Show on Map" | **Map** | Optimised order markers with polylines |

### What to Tell Judges

> "For slow walkers, the system saves `mobility: slow` which tells the LLM to cluster stops tightly and minimize walking. The `optimize_route` tool uses a nearest-neighbor algorithm to reorder stops so the user doesn't backtrack. The LLM then calls `route_distance` on each segment — if any exceeds 5 minutes at a slow pace (~80m/min = ~400m), the LLM can drop that stop and find alternatives. The map shows the optimised walking path, not the original search order."

### Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `optimize_route` not called | LLM skipped the tool | Expected — the LLM may calculate distances manually. Judge can still see `route_distance` calls |
| Distances >5 min shown | Search returned far-apart parks | Judge sees the LLM naturally acknowledging "This spot is 7 min walk — you may want to rest at the bench in the middle" |
| Region filters to wrong area | "Hong Kong Island" parsed as "hong_kong" | The `firstOf` mapper normalises region; works correctly for `hong_kong_island` |

---

## Fallback / LLM Failure Protocol (All Scripts)

### If Gemini Returns 429

```
Symptom: Frontend shows "LLM connection unavailable" error
```

1. **Automatic fallback**: Backend tries Gemini → Gemini lite → Gemini 1.5 Flash → local llama. The `GET /health` endpoint shows current LLM status.
2. **Manual switch**: Click the model button in the header (top-right, shows current model name). Select the local GGUF model from the dropdown.
3. **Bypass LLM entirely**: Use the Preferences panel (★ Prefs button) to set mobility/interests manually, then the Places tab shows all DB places with accessibility scores pre-computed.

### If Tool Execution Fails Mid-Flow

```
Symptom: One tool returns error but others succeed
```

The `agent.ts` loop wraps each tool in try/catch (line 182–198). The LLM receives the error in the tool result and can adapt — e.g. if `check_accessibility` fails for one place, the LLM can respond "I couldn't verify accessibility for Museum X, but here are 2 confirmed options." This is a **feature**, not a bug — judges love seeing graceful degradation.

### If Backend Process Hangs

```
Symptom: Thinking spinner runs >120 seconds
```

The frontend polls every 200ms. If no response after 120s, the backend times out. Refresh the page and try again. For demo reliability, pre-warm the LLM by sending a simple "hello" first.