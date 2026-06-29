# Files Needed – Web MVP

This document lists the concrete files and modules required to implement the Web MVP.

## Frontend Files
- `pages/chat.tsx`
  - Chat UI for entering trip descriptions.
  - Sends `POST /plan` requests.
- `pages/itinerary/[id].tsx`
  - Displays itinerary details and map.
- `components/ChatInput.tsx`
  - Textarea/input + submit button.
- `components/MessageBubble.tsx`
  - Renders user and system messages.
- `components/ItineraryList.tsx`
  - Renders ordered list of stops.
- `components/MapView.tsx`
  - Wraps Leaflet/MapLibre map and markers.

## Backend Files
- `src/index.ts`
  - Express/NestJS app bootstrap.
- `src/routes/plan.ts`
  - Defines `POST /plan` handler.
- `src/routes/itinerary.ts`
  - Defines `GET /itinerary/:id` handler.
- `src/services/llmGateway.ts`
  - Encapsulates calls to llama.cpp.
- `src/services/placeResolver.ts`
  - Maps categories to concrete places.
- `src/services/routing.ts`
  - Encapsulates OpenRouteService calls.
- `src/db/client.ts`
  - PostgreSQL connection and query helper.

## Database Files
- `db/migrations/001_init.sql`
  - Creates `places`, `itineraries`, `itinerary_items` tables.
- `db/migrations/002_embeddings.sql` (optional)
  - Creates `places_embeddings` for RAG.

## LLM / Agent Files
- `llm/prompts/planning-agent.txt`
  - Prompt template for the Planning Agent.
- `llm/config/llama-cpp-config.json`
  - Configuration for the local model (path, parameters).

These files give agents and humans a concrete target for code generation and manual implementation.
