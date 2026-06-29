# Guide – Web MVP

This document describes what the Web MVP is supposed to achieve and the constraints we are working under.

## Goal
Build a minimal but functional web application that lets a user:
- Type a natural-language description of a trip in Kowloon.
- Have a local LLM (llama.cpp) convert that description into a structured itinerary.
- Enrich that itinerary with real road distances and routes using a free routing API (OpenRouteService).
- Store the itinerary and its places in PostgreSQL.
- Visualize the result on an interactive web map.

## Scope
- Region: Kowloon only (later versions expand to all Hong Kong).
- No login or user accounts; one session-driven flow is enough for MVP.
- No accessibility tags yet; focus is on proving the itinerary + routing pipeline.
- Frontend: Next.js + React.
- Backend: Node.js + TypeScript.
- LLM: local llama.cpp running on the developer laptop.
- Routing: OpenRouteService (OSM-based, free tier).
- Database: PostgreSQL, with optional pgvector for later RAG.

## Success Criteria
- A judge or user can:
  1. Open the web MVP, enter a trip description for Kowloon.
  2. See a generated itinerary with 3–6 stops and reasonable ordering.
  3. See distances and routes on a map that follow roads, not straight lines.
  4. Reload an itinerary via its id and get consistent results.

If these behaviours work reliably for a handful of test prompts, the MVP is successful and ready for Web v1.
