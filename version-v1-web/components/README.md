# Components – V1

This document describes reusable components in the V1 codebase.

## UI Components
- `ChatInput`
  - Used on the chat page.
  - Can be reused in mobile app later.

- `MessageBubble`
  - Renders user/system messages.

- `ItineraryList`
  - Displays stops; later can be extended with accessibility info.

- `MapView`
  - Handles map rendering, markers, and polylines.

## Utility Components / Modules
- `apiClient`
  - Thin wrapper over `fetch`/`axios` for calling backend.

- `routeFormatter`
  - Converts raw route geometry into map-friendly format.

These components give a clear inventory for agents to reference when generating or modifying code.
