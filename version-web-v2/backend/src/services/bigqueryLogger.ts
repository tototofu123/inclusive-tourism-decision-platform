/**
 * bigqueryLogger.ts
 *
 * Logs anonymised usage events to BigQuery.
 * Always fire-and-forget — never awaited in the request path.
 *
 * Events logged:
 *   - itinerary_generated  (source, latency, mobility tags, location)
 *   - place_viewed         (placeId, accessibility tags)
 *   - fallback_triggered   (reason, error type)
 */

import { BigQuery } from '@google-cloud/bigquery';

const DATASET = process.env.BIGQUERY_DATASET || 'inclusive_tourism';
const TABLE = process.env.BIGQUERY_TABLE || 'usage_events';

let _client: BigQuery | null = null;
function getClient() {
  if (!_client) _client = new BigQuery({ projectId: process.env.VERTEX_PROJECT_ID });
  return _client;
}

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
    if (process.env.BIGQUERY_ENABLED !== 'true') return;
    try {
      await getClient()
        .dataset(DATASET)
        .table(TABLE)
        .insert([{ ...payload, mobilityTags: (payload.mobilityTags ?? []).join(',') }]);
    } catch (err) {
      // Silent — analytics must never surface to the user
      if (process.env.NODE_ENV === 'development') {
        console.debug('  [bq] insert failed (non-fatal):', (err as Error).message);
      }
    }
  },
};

export { bigqueryLogger };
