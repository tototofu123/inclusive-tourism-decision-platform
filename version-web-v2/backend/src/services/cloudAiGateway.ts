/**
 * cloudAiGateway.ts
 *
 * The single decision point for all AI calls.
 * - If VERTEX_AI_ENABLED=true  → try Vertex AI + ADK pipeline
 * - On any error              → fall through to localFallback
 * - BigQuery event is always logged (fire-and-forget)
 */

import { runAdkPipeline } from './adkAgents';
import { localFallback } from './localFallback';
import { bigqueryLogger } from './bigqueryLogger';

export interface ItineraryRequest {
  userQuery: string;
  userProfile: {
    mobilityTags: string[];
    dietaryTags: string[];
    language: string;
  };
  location: string;
  durationHours: number;
}

export interface ItineraryResponse {
  itinerary: ItineraryItem[];
  source: 'cloud' | 'local';
  latencyMs: number;
}

export interface ItineraryItem {
  placeId: string;
  name: string;
  address: string;
  accessibilityTags: string[];
  arrivalTime: string;
  durationMins: number;
  directions?: object;
}

export async function generateItinerary(
  req: ItineraryRequest
): Promise<ItineraryResponse> {
  const start = Date.now();
  const cloudEnabled = process.env.VERTEX_AI_ENABLED === 'true';

  let result: ItineraryItem[];
  let source: 'cloud' | 'local';

  if (cloudEnabled) {
    try {
      console.log('  [gateway] trying Vertex AI pipeline...');
      result = await runAdkPipeline(req);
      source = 'cloud';
      console.log(`  [gateway] ✓ cloud responded (${Date.now() - start}ms)`);
    } catch (err) {
      console.warn('  [gateway] ✗ cloud failed, falling back to local:', (err as Error).message);
      result = await localFallback(req);
      source = 'local';
    }
  } else {
    console.log('  [gateway] cloud disabled, using local fallback');
    result = await localFallback(req);
    source = 'local';
  }

  const latencyMs = Date.now() - start;

  // Fire-and-forget — never blocks the response
  bigqueryLogger.logEvent({
    event: 'itinerary_generated',
    source,
    latencyMs,
    mobilityTags: req.userProfile.mobilityTags,
    location: req.location,
    ts: new Date().toISOString(),
  }).catch(() => { /* analytics never breaks the app */ });

  return { itinerary: result, source, latencyMs };
}
