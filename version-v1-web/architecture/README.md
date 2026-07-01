# Architecture – Web MVP

This document describes the architecture for the Web MVP in more detail, including components and data flow.

## Components Overview
- **Web Frontend (Next.js + React)**
  - Provides chat interface and itinerary view.
  - Renders an interactive map using Leaflet/MapLibre with OSM tiles.

- **Backend API (Node.js + TypeScript)**
  - Exposes REST endpoints (`/plan`, `/itinerary/:id`).
  - Coordinates LLM calls, place resolution, routing, and DB writes.

- **Local LLM Server (llama.cpp)**
  - Runs on the developer laptop.
  - Implements the Planning Agent that turns free text into itinerary JSON.

- **Routing API (OpenRouteService)**
  - Provides road-aware directions and distances between places.

- **Database (PostgreSQL)**
  - Stores places, itineraries, and itinerary items.
  - Optional pgvector extension for future RAG.

## Data Flow
1. Frontend sends user text to `/plan`.
2. Backend calls llama.cpp with planning prompt.
3. LLM returns explanatory text + itinerary JSON.
4. Backend resolves abstract stops to concrete places.
5. Backend calls OpenRouteService for each leg.
6. Backend writes data into PostgreSQL.
7. Frontend fetches itinerary by id and renders UI.

## Design Rationale
- **Local-first AI** avoids burning cloud API keys during early experimentation.
- **Kowloon-only scope** keeps routing and place resolution manageable.
- **Clear separation** between LLM planning and routing ensures that bugs in one part do not corrupt the other.
- **REST endpoints** keep the interface simple for both web and future mobile clients.

## Future Evolution
- Web v1 adds preference profiles and RAG over a larger place dataset.
- Web v2 moves AI and RAG to Google Cloud while keeping local LLM as fallback.

This architecture is intentionally straightforward to fit hackathon time, while leaving room to evolve.
