import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

const pool = new Pool({
  host: process.env.CLOUD_SQL_HOST || 'localhost',
  port: parseInt(process.env.CLOUD_SQL_PORT || '5432'),
  user: process.env.CLOUD_SQL_USER || 'postgres',
  password: process.env.CLOUD_SQL_PASSWORD || 'postgres',
  database: process.env.CLOUD_SQL_DATABASE || 'inclusive_tourism_v1',
});

if (process.env.CLOUD_SQL_HOST) {
  (pool as any).ssl = { rejectUnauthorized: false };
}

const OVERPASS_BASE = process.env.OVERPASS_BASE || 'https://overpass-api.de/api/interpreter';

const BOX = '(22.15,113.8,22.45,114.4)';
const QUERY = `[out:json][timeout:60];(node["wheelchair"]${BOX};way["wheelchair"]${BOX};relation["wheelchair"]${BOX};);out center tags 100;`;

function mapWheelchairToScore(wc: string): number {
  if (wc === 'yes' || wc === 'designated') return 5;
  if (wc === 'limited') return 3;
  if (wc === 'no') return 1;
  return 0;
}

function buildTags(el: any): string[] {
  const tags: string[] = [];
  const t = el.tags || {};
  if (t.wheelchair_toilet === 'yes') tags.push('accessible toilet');
  if (t.tactile_paving === 'yes') tags.push('tactile paving');
  if (t.elevator === 'yes') tags.push('elevator');
  if (t.ramp === 'yes') tags.push('ramp');
  if (t.ramp === 'limited') tags.push('ramp (limited)');
  if (t.hearing_loop === 'yes') tags.push('hearing loop');
  if (t.braille === 'yes') tags.push('braille signage');
  if (t.wheelchair === 'yes' || t.wheelchair === 'designated') tags.push('step-free access');
  if (t.wheelchair === 'limited') tags.push('partial step-free access');
  if (t.wheelchair === 'no') tags.push('not wheelchair accessible');
  return tags;
}

async function main() {
  console.log('Fetching OSM elements with wheelchair tags in HK bounding box...');

  let elements: any[];
  try {
    const res = await fetch(OVERPASS_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'InclusiveTourismSeed/1.0' },
      body: new URLSearchParams({ data: QUERY }),
    });
    if (!res.ok) {
      console.error(`Overpass API error: ${res.status} ${res.statusText}`);
      await pool.end();
      process.exit(1);
    }
    const data = (await res.json()) as any;
    elements = data.elements || [];
    console.log(`Received ${elements.length} elements from Overpass`);
  } catch (err) {
    console.error('Connection error — failed to reach Overpass API:', err);
    await pool.end();
    process.exit(1);
  }

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const name = el.tags?.name;
    if (!name) { skipped++; continue; }

    if (i > 0 && i % 100 === 0) {
      console.log(`Progress: ${i}/${elements.length} (updated: ${updated}, skipped: ${skipped}, failed: ${failed})`);
    }

    try {
      const dbRes = await pool.query(
        'SELECT id, accessibility_score FROM places WHERE LOWER(name) LIKE $1 LIMIT 1',
        [`%${(name as string).toLowerCase()}%`],
      );
      if (dbRes.rows.length === 0) { skipped++; continue; }

      const score = mapWheelchairToScore(el.tags.wheelchair || '');
      const tags = buildTags(el);

      await pool.query(
        'UPDATE places SET accessibility_tags = $1, accessibility_score = $2 WHERE id = $3',
        [tags, score, dbRes.rows[0].id],
      );
      updated++;
    } catch {
      failed++;
    }
  }

  console.log(`Done. Updated: ${updated}, Skipped: ${skipped}, Failed: ${failed}`);
  await pool.end();
}

main();