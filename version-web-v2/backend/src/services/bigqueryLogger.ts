import { query } from '../db/client';

export interface UsageEvent {
  event: string;
  source?: string;
  latencyMs?: number;
  mobilityTags?: string[];
  location?: string;
  placeId?: string;
  reason?: string;
  ts: string;
}

const bigqueryLogger = {
  async logEvent(payload: UsageEvent): Promise<void> {
    try {
      await query(
        `INSERT INTO usage_events (event, source, latency_ms, mobility_tags, location, place_id, reason, ts)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          payload.event,
          payload.source || null,
          payload.latencyMs ?? null,
          payload.mobilityTags ? JSON.stringify(payload.mobilityTags) : null,
          payload.location || null,
          payload.placeId || null,
          payload.reason || null,
          payload.ts,
        ]
      );
    } catch {
      // Silent — analytics must never surface to the user
    }
  },
};

export { bigqueryLogger };
