# Flow – V1

This document describes the end-to-end flow for V1 from user input to rendered itinerary.

## High-Level Steps
1. **User opens the web app** and lands on the chat page.
2. **User enters a trip description** in natural language (e.g. "Tomorrow afternoon in Kowloon, I want to visit a museum and then find a nice cafe").
3. **Frontend sends `POST /plan`** with the text body to the backend.
4. **Backend calls the Planning Agent (llama.cpp)** with a prompt that requests explanatory text + itinerary JSON.
5. **Backend parses the JSON**, validates basic fields (categories, durations, number of stops).
6. **Backend resolves abstract stops to concrete places** using a free places API or a small seeded dataset.
7. For each consecutive pair of places, **backend calls OpenRouteService** to get real road routes and distances.
8. **Backend writes data to PostgreSQL**:
   - `places` records.
   - `itineraries` record.
   - `itinerary_items` records including route geometry.
9. **Backend returns itinerary id + structured data** to the frontend.
10. **Frontend navigates to `/itinerary/:id`** and renders:
    - List of stops with names and descriptions.
    - Map with markers and polylines for the route.

## Error and Fallback Flow
- If llama.cpp fails to produce valid JSON:
  - Backend returns a clear error message to the frontend.
  - Frontend shows a prompt to try a simpler description.
- If OpenRouteService fails:
  - Backend can fall back to straight-line distance as a temporary measure, but marks the route as approximate.
- If DB write fails:
  - Backend logs the error and returns an error to frontend; no partial itinerary should be considered saved.

## Data Consistency
- `itinerary_id` is the single key used to retrieve the itinerary later.
- Frontend always uses the API to fetch the itinerary by id rather than reusing stale local state.

V1 uses two-phase polling (`POST /chat` → `processId`, then `GET /chat/status/:processId` every 200ms) for real-time feedback during LLM planning.
