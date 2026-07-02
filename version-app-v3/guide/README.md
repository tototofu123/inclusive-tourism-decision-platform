# Guide – App v3

This document describes App v3 as the first mobile-enabled version of the platform.

## Goal
Bring the core value of the web experience onto mobile devices and add capabilities that only make sense on phones:
- Offline caching of itineraries and basic map data.
- Wake word for hands-free interaction during navigation.
- Live location tracking to show the user on the route and adapt if needed.

## Scope
- Mobile app built with React Native or Flutter (final choice can be made during implementation).
- Shares the same backend and cloud AI stack as Web v2.
- Focuses on the traveller's experience; merchant/city dashboards remain web-only at this stage.

## Behavioural Expectations
A typical App v3 use case:
1. User plans their itinerary on web or mobile.
2. App downloads the itinerary + essential map data and stores it locally.
3. During the trip, user can:
   - Open the app without network and still see current itinerary.
   - Use the wake word to ask simple questions ("what's next stop?", "how far?").
   - See their live position on the route.

## Constraints
- On-device LLM is optional; most intelligence still comes from backend/cloud when online.
- Offline mode prioritises clarity and reliability over full feature parity.

App v3 should demonstrate that the platform works in real travel conditions, not just at a desktop.
