# Flow – Web v2

This document describes the Web v2 flow.

## Steps
1. User sets preferences and enters trip description as in Web v1.
2. Frontend sends request to backend AI gateway.
3. Backend:
   - Calls Vector Search to retrieve candidate places from cloud.
   - Invokes ADK agents (Route Planner, Place Selector) via Vertex AI.
4. Cloud agents return a planned itinerary and suggested places.
5. Backend calls Google Maps Directions API for final routes.
6. Backend writes data to DB (PostgreSQL/AlloyDB) and returns to frontend.
7. Frontend renders itinerary and map.

If cloud calls fail, backend falls back to Web v1 local path.
