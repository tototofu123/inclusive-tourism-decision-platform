import { BigQuery } from '@google-cloud/bigquery';

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

const datasetId = 'tourism_analytics';
const tableId = 'usage_events';

let bq: BigQuery | null = null;

function getBq(): BigQuery {
  if (!bq) {
    bq = new BigQuery();
  }
  return bq;
}

async function ensureTable(): Promise<void> {
  try {
    const dataset = getBq().dataset(datasetId);
    const [exists] = await dataset.exists();
    if (!exists) return;

    const table = dataset.table(tableId);
    const [tableExists] = await table.exists();
    if (!tableExists) {
      await dataset.createTable(tableId, {
        schema: {
          fields: [
            { name: 'event', type: 'STRING', mode: 'REQUIRED' },
            { name: 'source', type: 'STRING' },
            { name: 'latency_ms', type: 'INTEGER' },
            { name: 'mobility_tags', type: 'JSON' },
            { name: 'location', type: 'STRING' },
            { name: 'place_id', type: 'STRING' },
            { name: 'reason', type: 'STRING' },
            { name: 'ts', type: 'STRING', mode: 'REQUIRED' },
          ],
        },
      });
    }
  } catch {
    // Non-fatal
  }
}

// Lazy init
let initPromise: Promise<void> | null = null;

const bigqueryLogger = {
  async logEvent(payload: UsageEvent): Promise<void> {
    try {
      if (!initPromise) initPromise = ensureTable();
      await initPromise;

      await getBq().dataset(datasetId).table(tableId).insert([{
        event: payload.event,
        source: payload.source || null,
        latency_ms: payload.latencyMs ?? null,
        mobility_tags: payload.mobilityTags ? JSON.stringify(payload.mobilityTags) : null,
        location: payload.location || null,
        place_id: payload.placeId || null,
        reason: payload.reason || null,
        ts: payload.ts,
      }]);
    } catch {
      // Silent — analytics must never surface to the user
    }
  },
};

export { bigqueryLogger };
