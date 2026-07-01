# External APIs Used

## Places & POI

| API | Endpoint | Key Required | Rate Limit | Usage | Notes |
|-----|----------|-------------|------------|-------|-------|
| **OpenStreetMap Overpass API** | `overpass-api.de/api/interpreter` | No | ~10k req/day per IP | Primary place search by category within Kowloon bounding box (22.29-22.34, 114.15-114.20) | Generous rate limit. Used in `placeResolver.ts`. |
| **Nominatim (OSM)** | `nominatim.openstreetmap.org` | No | 1 req/sec | Fallback when Overpass returns nothing. Searches "X Kowloon Hong Kong" | Strict 1 req/sec rate limit. Used in `placeResolver.ts`. User-Agent header required. |
| **HK Tourism Board Open Data** | `data.gov.hk` datasets | No | Unclear | Not yet integrated — available for future curated POI data | Via DATA.GOV.HK platform |
| **HK Access Guide (data.gov.hk)** | `accessguide.hk` (Atom feeds) | No | Unclear | Accessible facilities dataset (attractions, hotels, shopping/dining, other venues) | XML/Atom format. Currently not accessible as raw data feed (redirects to Joomla site). |

## Routing & Transport

| API | Endpoint | Key Required | Rate Limit | Usage | Notes |
|-----|----------|-------------|------------|-------|-------|
| **OSRM (Open Source Routing Machine)** | `router.project-osrm.org` | No | Generous | Walking route distance/duration between two coordinates | Used in `routingService.ts`. Fallback to Haversine * 1.4 on failure. |

## Accessibility

| API | Endpoint | Key Required | Rate Limit | Usage | Notes |
|-----|----------|-------------|------------|-------|-------|
| **Overpass wheelchair tags** | `overpass-api.de/api/interpreter` | No | Same as above | Queries `wheelchair=yes/limited/no`, `tactile_paving`, `wheelchair_toilet`, `ramp` tags | Used in `accessibilityService.ts`. Same endpoint as place search. |
| **Curated JSON dataset** | Local file `places-data/hong-kong/places-curated.json` | N/A | N/A | 53 places with `accessibility_tags` and `accessibility_score` fields | Local fallback when Overpass has no data. |

## Other

| API | Endpoint | Key Required | Rate Limit | Usage | Notes |
|-----|----------|-------------|------------|-------|-------|
| **llama.cpp (local LLM)** | `127.0.0.1:8081` | No | Local | All LLM inference: tool calling, itinerary planning, Q&A | Local server. Must be running for the app to work. |

## Notes

- All non-local APIs are free and don't require API keys
- Overpass and Nominatim are public OSM services — be respectful with request frequency
- OSRM public instance may be rate-limited at high volumes; consider self-hosting for production
- No API keys are stored in the codebase or `.env`
