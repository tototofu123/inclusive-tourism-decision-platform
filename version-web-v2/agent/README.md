# ADK Agents — Web v2

Three agents run in sequence inside `adkAgents.ts`. Each is a structured Vertex AI + Gemini call with a defined role, input schema, and output schema.

## Agent 1: Place Selector

**Input:** user query, mobility tags, location, duration  
**Step 1:** Calls `cloudRag.queryCandidatePlaces()` → gets top-20 semantically similar places from Vector Search  
**Step 2:** Gemini re-ranks and selects the best N places for the trip duration  
**Output:** `[{ placeId, name, address, accessibilityTags }]`

**Prompt contract:**
- Must return valid JSON array
- Must only select places from the candidate list (no hallucination)
- Must filter by mobility tags (e.g. "no stairs" eliminates staired venues)

## Agent 2: Route Planner

**Input:** selected places list from Agent 1  
**Step 1:** Calls `mapsDirections.getDirections()` between consecutive places (walking mode by default)  
**Step 2:** Calculates arrival times from 09:00 base, adding transit time + visit duration  
**Output:** `[{ ...place, arrivalTime, durationMins, directions }]`

**Logic:**
- Default visit duration: 45 mins per place
- Start time: 09:00
- `nextArrival = prevArrival + durationMins + transitMins`
- If Maps API fails, falls back to 10-min walking estimate

## Agent 3: City Insight

**Input:** routed itinerary from Agent 2  
**Step 1:** Single Gemini call to enrich each place with a practical accessibility note  
**Output:** same array with `notes` field added per place

**Prompt contract:**
- 1 sentence per place (practical, not marketing)
- Language matches `userProfile.language`
- Example: "Ramp entrance on the east side; elevator inside to all floors."

## Session State

All three agents share the same session context (user profile + location) passed through from `cloudAiGateway.ts`. No external session store is needed — state lives in the in-process function call chain.

## Error Handling

If any agent throws, `runAdkPipeline()` throws, and `cloudAiGateway.ts` catches it and routes to `localFallback.ts`. The frontend always gets a response.
