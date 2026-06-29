# Web MVP Version

This folder contains the specifications for the initial web MVP.

## Guide
- Scope: Chat → local LLM → JSON itinerary → road-routed map → stored in DB (Kowloon only).
- No login, no accessibility tags yet.

## Agent
- Primary agent: Planning agent that converts user text into structured itinerary JSON.
- Runs on llama.cpp locally during development.

## Flow
- User types trip description in web chat.
- Backend calls local LLM with prompt template.
- LLM returns human-readable explanation + itinerary JSON.
- Backend enriches itinerary with real routes via OpenRouteService.
- Backend stores places + itinerary in PostgreSQL.
- Frontend renders itinerary list + interactive map.

## Files Needed
- Frontend: Next.js + React pages and components for chat and itinerary view.
- Backend: Node.js + TypeScript API service with endpoints `/plan` and `/itinerary/:id`.
- DB: PostgreSQL schema for `places`, `itineraries`, `itinerary_items`.
- LLM: llama.cpp server config and prompt templates.

## Architecture
- Web UI (Next.js/React) → Backend API (Node/TS) → Local LLM (llama.cpp) → Routing API (OpenRouteService) → PostgreSQL.

## Frontend
- `pages/chat.tsx` – chat interface.
- `pages/itinerary/[id].tsx` – itinerary + map view.
- Components for message bubbles, itinerary cards, map wrapper.

## Backend
- `src/routes/plan.ts` – handles planning requests.
- `src/routes/itinerary.ts` – fetches itinerary by id.
- `src/services/llmGateway.ts` – calls llama.cpp.
- `src/services/routing.ts` – calls OpenRouteService.

## Database
- SQL migrations for `places`, `itineraries`, `itinerary_items`.
- Optional `places_embeddings` for future RAG.

## API
- `POST /plan` – body: `{ text: string }` → returns itinerary JSON + id.
- `GET /itinerary/:id` – returns stored itinerary.

## Assets
- Diagrams for MVP architecture (to be added later).

## Components
- Chat UI components.
- Itinerary and place card components.
- Map component using Leaflet/MapLibre.
