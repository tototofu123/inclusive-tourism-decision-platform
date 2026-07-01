# Frontend – Web MVP

This document describes the frontend design and behaviour for the Web MVP.

## Pages
- `chat` page
  - Entry point for the app.
  - Contains:
    - A text input area for the trip description.
    - A submit button.
    - A simple log of system responses (e.g. "Planning your itinerary...").

- `itinerary/[id]` page
  - Shows:
    - The structured itinerary (list of stops, durations).
    - A map with markers and route polylines.

## Components
- `ChatInput`
  - Handles text input, validation (non-empty), and submit.
- `MessageBubble`
  - Displays user messages and system feedback in a simple chat layout.
- `ItineraryList`
  - Renders each stop with name, category, notes, and time estimates.
- `MapView`
  - Wraps Leaflet/MapLibre.
  - Accepts props for markers and polylines.

## State Management
- Minimal state, relying on:
  - Local component state for current input.
  - URL params (`id`) to fetch and display itineraries.
- No global auth or profile state in MVP.

## UX Considerations
- Focus on clarity over aesthetics.
- Clear loading and error states when planning or fetching itineraries.
- Simple mobile-responsive layout (single-column) for hackathon demo.

This frontend spec should be enough for agents or you to generate initial components and iterate.
