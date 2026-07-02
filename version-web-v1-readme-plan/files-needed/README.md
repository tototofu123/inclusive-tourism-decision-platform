# Files Needed – Web v1

This document lists the additional files and modules required for Web v1.

## Frontend Additions
- `components/PreferencesForm.tsx`
  - UI for selecting walking speed, categories, budget, crowd tolerance.
- `hooks/usePreferences.ts`
  - Manages preference state in session/local storage.

## Backend Additions
- `src/services/preferences.ts`
  - Validates and normalises preference input.
- `src/services/rag.ts`
  - Handles embeddings and pgvector queries over `places`.

## Database Additions
- `db/migrations/003_preferences.sql`
  - If needed, adds tables for storing preferences with session ids.
- `db/migrations/004_embeddings-data.sql`
  - Seeds or updates embeddings.

## LLM / Prompt Additions
- `llm/prompts/planning-agent-v1.txt`
  - Prompt variant that includes preferences and candidate places.

Web v1 reuses most MVP files, adding focused modules for preferences and RAG.
