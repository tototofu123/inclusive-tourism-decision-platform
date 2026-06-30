# Data Flow — Web v2

## Happy Path (Cloud)

```
1. User submits query: "half-day accessible tour near Central, HK, wheelchair"

2. Frontend → POST /api/itinerary
   { userQuery, userProfile: { mobilityTags: ["wheelchair"] }, location: "Central, HK", durationHours: 4 }

3. cloudAiGateway checks VERTEX_AI_ENABLED=true → calls runAdkPipeline()

4. PlaceSelector:
   a. Embeds query → 768-dim vector via text-embedding-004
   b. Queries Vertex AI Vector Search → top-20 places by cosine similarity
   c. Gemini filters by wheelchair tag → selects 8 best places

5. RoutePlanner:
   a. Calls Maps Directions API: Place1→Place2→...→Place8 (walking)
   b. Builds timed schedule from 09:00

6. CityInsight:
   a. Gemini adds 1-sentence accessibility note per place

7. Response sent to frontend:
   { itinerary: [...], source: "cloud", latencyMs: 1240 }

8. BigQuery logs event (async, ~50ms after response sent)
```

## Fallback Path (Cloud Fails)

```
1–3. Same as above

4. runAdkPipeline() throws (e.g. Vertex AI timeout)

5. cloudAiGateway catches → calls localFallback()

6. localFallback: llama.cpp generates itinerary, SQLite queries places

7. Response sent to frontend:
   { itinerary: [...], source: "local", latencyMs: 3800 }

Frontend receives same shape — no error shown to user.
```

## Analytics Flow

```
After response is sent:
  bigqueryLogger.logEvent({ event, source, latencyMs, mobilityTags, location, ts })
    └→ BigQuery streaming insert → usage_events table
    └→ Available in BigQuery within ~1 min for dashboards
```
