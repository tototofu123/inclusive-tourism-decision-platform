/**
 * localFallback.ts
 *
 * Identical to v1 logic: llama.cpp + SQLite.
 * Activated when VERTEX_AI_ENABLED=false OR when cloud pipeline throws.
 *
 * Inputs/outputs match the cloud pipeline exactly so
 * cloudAiGateway.ts can swap them transparently.
 */

import type { ItineraryRequest, ItineraryItem } from './cloudAiGateway';

// In v1 this would import callLlama() and query sql.js.
// Keeping as a typed stub here — copy actual v1 implementation in.
export async function localFallback(req: ItineraryRequest): Promise<ItineraryItem[]> {
  console.log('  [local] running llama.cpp + SQLite fallback');

  // TODO: import { callLlama } from '../../../version-web-v1/backend/src/services/llama';
  // TODO: import { queryPlaces } from '../../../version-web-v1/backend/src/db/places';

  // Stub response — replace with real v1 logic
  return [
    {
      placeId: 'stub-001',
      name: 'Sample Accessible Spot (local fallback)',
      address: req.location,
      accessibilityTags: req.userProfile.mobilityTags,
      arrivalTime: '09:00',
      durationMins: 45,
    },
  ];
}
