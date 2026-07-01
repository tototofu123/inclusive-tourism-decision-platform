# API – Web MVP

This document specifies the APIs used and exposed in the Web MVP.

## Public REST Endpoints

### `POST /plan`
- **Request body**:
  ```json
  {
    "text": "Tomorrow afternoon in Kowloon, I want to visit a museum and a cafe"
  }
  ```
- **Response body** (example):
  ```json
  {
    "itineraryId": "abc123",
    "itinerary": {
      "stops": [
        { "label": "Museum", "placeId": 1, "startTime": "...", "endTime": "..." },
        { "label": "Cafe", "placeId": 2, "startTime": "...", "endTime": "..." }
      ]
    },
    "places": [
      { "id": 1, "name": "Kowloon Museum", "lat": 22.3, "lng": 114.17 },
      { "id": 2, "name": "Nice Cafe", "lat": 22.31, "lng": 114.18 }
    ]
  }
  ```

### `GET /itinerary/:id`
- **Request**: path parameter `id`.
- **Response**: same shape as `/plan`, loaded from DB.

## Internal / External APIs

### llama.cpp
- Called via `llmGateway` service.
- Request: prompt string.
- Response: raw text with both explanation and JSON block.

### OpenRouteService
- Endpoint: `/v2/directions/<profile>` (e.g. `driving-car`, `foot-walking`).
- Request: coordinates for origin and destination.
- Response: route geometry and distance.

These APIs form the backbone of the MVP, and later versions will add more endpoints and cloud-based AI services.
