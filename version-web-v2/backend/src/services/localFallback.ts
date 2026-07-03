/**
 * localFallback.ts
 *
 * V1 fallback path: llama.cpp + PostgreSQL + 12 tool-calling agent.
 * Activated when VERTEX_AI_ENABLED=false OR when cloud pipeline throws.
 *
 * Delegates to the V1 agent.ts processChat() which handles all
 * tool calling, place resolution, itinerary creation, and routing.
 */

import type { ItineraryRequest, ItineraryItem } from './cloudAiGateway';
import { processChat } from './agent';

export async function localFallback(req: ItineraryRequest): Promise<ItineraryItem[]> {
  console.log('  [local] running V1 fallback (llama.cpp + tool-calling agent)');

  const ctx: string[] = [];
  if (req.userProfile?.mobilityTags?.length) {
    ctx.push(`Mobility needs: ${req.userProfile.mobilityTags.join(', ')}`);
  }
  if (req.userProfile?.dietaryTags?.length) {
    ctx.push(`Dietary preferences: ${req.userProfile.dietaryTags.join(', ')}`);
  }
  if (req.location && req.location !== 'Hong Kong') {
    ctx.push(`Location: ${req.location}`);
  }
  if (req.durationHours) {
    ctx.push(`Duration: about ${req.durationHours} hours`);
  }

  const text = ctx.length > 0
    ? `${req.userQuery} (${ctx.join('; ')})`
    : req.userQuery;

  const result = await processChat(text);

  const items: ItineraryItem[] = [];
  if (result.itinerary?.stops) {
    for (let i = 0; i < result.itinerary.stops.length; i++) {
      const s = result.itinerary.stops[i];
      items.push({
        placeId: String(s.placeId || `gen-${i}`),
        name: s.label,
        address: '',
        accessibilityTags: [],
        arrivalTime: s.startTime || '09:00',
        durationMins: 45,
      });
    }
  }

  if (items.length === 0 && result.places?.length) {
    for (const p of result.places) {
      items.push({
        placeId: String(p.id),
        name: p.name,
        address: '',
        accessibilityTags: [],
        arrivalTime: '09:00',
        durationMins: 45,
      });
    }
  }

  if (items.length === 0) {
    items.push({
      placeId: 'v1-response',
      name: result.response.slice(0, 80),
      address: req.location,
      accessibilityTags: req.userProfile?.mobilityTags || [],
      arrivalTime: '09:00',
      durationMins: 45,
    });
  }

  return items;
}
