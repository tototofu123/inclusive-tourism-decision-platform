# Skill: Inclusive Tourism V1 — Tool Calling & Preferences

## When to load
When working on `version-v1-web/` or any reference to `inclusive_tourism_v1` database.

## Behavior
1. Always load `user_preferences` for the session before any LLM response generation
2. Always use `firstOf()` when extracting tool args from model output
3. Preference fields: mobility, interests[], budget_level, home_base, urgent_mode, confirmed_itinerary_id
4. For urgent mode (`urgent_mode=true`): append "This itinerary is CONFIRMED" to LLM prompt
5. HK date/time: use `worldtimeapi.org/api/timezone/Asia/Hong_Kong` or fallback to `Intl.DateTimeFormat` with HK timezone
6. Weather: rough estimate from hour (06-09 sunrise/mild, 09-12 morning/warm, 12-15 afternoon/hot, etc.)
7. Places: DB-first lookups via `places` table, then Overpass fallback
8. Accessibility: check `places.accessibility_tags` before Overpass wheelchair query
9. Costs: map budget levels (free=0, cheap=50, moderate=200, expensive=500 HKD)
10. Tool call flow: `parseToolCalls()` → `executeTool()` → loop (max 5 rounds) via `agent.ts`

## Files to touch
- `backend/src/services/agent.ts` — system prompt injection, agent loop
- `backend/src/services/tools.ts` — tool implementations with firstOf()
- `backend/src/services/preferencesService.ts` — load/save preferences
- `backend/src/services/placeResolver.ts` — DB-first, region-aware
- `backend/src/routes/preferences.ts` — REST endpoints
- `frontend/src/pages/index.tsx` — UI for prefs, confirm, region filter

## Verification
After any change, run: `node test-tools.mjs` and `node test-security.mjs`
