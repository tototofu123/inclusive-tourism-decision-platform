# Backend – Web MVP

This document describes the backend API service for the Web MVP.

## Tech Stack
- Node.js + TypeScript.
- Express or NestJS (framework choice can be made during implementation).

## Core Responsibilities
- Expose HTTP endpoints to the frontend.
- Call the Planning Agent (llama.cpp) with user text.
- Resolve abstract stops into real places.
- Call OpenRouteService for routing and distances.
- Persist data in PostgreSQL.

## Routes
- `POST /plan`
  - Request: `{ text: string }`.
  - Response: `{ itineraryId: string, itinerary: {...}, places: [...] }`.

- `GET /itinerary/:id`
  - Request: `id` path parameter.
  - Response: same structured data as returned from `/plan`, loaded from DB.

## Services
- `llmGateway`
  - Handles prompt construction and parsing of llama.cpp responses.

- `placeResolver`
  - Maps categories from the itinerary JSON to concrete places (via free APIs or a seed dataset).

- `routingService`
  - Calls OpenRouteService.
  - Normalizes API responses into internal route geometry and distance.

- `dbService`
  - Wraps PostgreSQL queries.
  - Provides functions like `saveItinerary`, `getItineraryById`.

## Logging and Errors
- Log LLM failures, routing failures, and DB errors with enough context to debug.
- Return concise error messages to the frontend; do not leak internal stack traces.

This backend spec provides clear hooks for implementation and for future agents to attach code.
