# Flow – App v3

This document describes App v3 flows.

## Sync Flow
1. User opens app.
2. App fetches latest itinerary from backend.
3. App stores itinerary and key map data locally.

## Offline Flow
1. Network becomes unavailable.
2. App uses cached itinerary and stored routes.
3. On-device helper answers simple questions.

## Live Location Flow
1. App subscribes to OS location services.
2. App shows current position on map.
3. Optional: app sends location to backend for analytics.

## Wake Word Flow
1. Native module listens for wake word.
2. On detection, opens voice interaction and forwards requests to backend or local helper.
