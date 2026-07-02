# Inclusive Tourism Decision Platform — V1 Workspace Guide

## Project
- `version-v1-web/` is the active development directory
- `version-mvp-web/` is frozen — do not edit
- Backend: `backend/src/index.ts` (port 4000, tsx)
- Frontend: `frontend/src/pages/index.tsx` (port 3000, webpack)
- Database: `inclusive_tourism_v1` on localhost:5432
- LLM: llama.cpp on `http://127.0.0.1:8081`

## Tool Calling Convention
- Qwythos-9B uses `<|tool_call|>call:Name{...}<|tool_call|>` format (custom parser in `parseToolCalls()`)
- gemma4/GPT use native OpenAI `tool_calls` array
- All LLM calls go through `apiClient.chatCompletion()` in `services/apiClient.ts`
- `firstOf(args, ...keys)` maps unpredictable model arg names in `services/tools.ts`
- Tool results returned directly for custom-format models; second LLM call for native models

## Preferences
- `user_preferences` table, one row per session
- Fields: mobility, interests[], budget_level, home_base, urgent_mode, confirmed_itinerary_id
- Loaded in `agent.ts` before building messages, injected into system prompt
- Updated via `POST /preferences/:sessionId`

## Testing
- `node test-tools.mjs` — 14 tool-calling tests
- `node test-security.mjs` — security edge cases
- Run after every phase change

## Phases Implemented
- Phase A: User preferences, urgent mode, confirm itinerary
- Phase B: ~300 places across 3 regions in `places` table, region-aware resolver
- Phase C: Cost tracking, transport cost, itinerary confirm/lock
- Phase D: HK date/time, weather inference, multi-round agent loop
