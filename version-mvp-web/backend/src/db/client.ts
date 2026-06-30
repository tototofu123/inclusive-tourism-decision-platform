import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'inclusive_tourism_mvp',
});

pool.on('error', err => console.error('Unexpected DB pool error:', err));

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const res = await pool.query(text, params);
  console.log('DB', { text: text.slice(0, 80), duration: Date.now() - start, rows: res.rowCount });
  return res;
}

// Places
export async function savePlace(place: { name: string; lat: number; lng: number; category?: string; description?: string; source_api?: string }): Promise<number> {
  const r = await query(
    `INSERT INTO places (name, lat, lng, category, description, source_api) VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT ON CONSTRAINT places_name_lng_lat_key DO NOTHING RETURNING id`,
    [place.name, place.lat, place.lng, place.category || null, place.description || null, place.source_api || 'osm']
  );
  if (r.rows.length > 0) return r.rows[0].id;
  const e = await query('SELECT id FROM places WHERE name=$1 AND lat=$2 AND lng=$3', [place.name, place.lat, place.lng]);
  return e.rows[0]?.id;
}

export async function listPlaces(limit = 50, offset = 0) {
  const r = await query('SELECT * FROM places ORDER BY name LIMIT $1 OFFSET $2', [limit, offset]);
  const c = await query('SELECT COUNT(*) as t FROM places');
  return { places: r.rows, total: parseInt(c.rows[0].t) };
}

// Itineraries
export async function saveItinerary(userText: string, region: string): Promise<number> {
  const r = await query('INSERT INTO itineraries (user_text, region) VALUES ($1,$2) RETURNING id', [userText, region]);
  return r.rows[0].id;
}

export async function saveItineraryItem(item: {
  itinerary_id: number; place_id: number; stop_index: number; label?: string;
  start_time?: string; end_time?: string; road_distance_meters?: number;
  duration_minutes?: number; route_geometry?: any; day_number?: number
}) {
  await query(
    `INSERT INTO itinerary_items (itinerary_id, place_id, stop_index, label, start_time, end_time, road_distance_meters, duration_minutes, route_geometry_json, day_number)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [item.itinerary_id, item.place_id, item.stop_index, item.label || null,
     item.start_time || null, item.end_time || null,
     item.road_distance_meters || 0, item.duration_minutes || 60,
     item.route_geometry ? JSON.stringify(item.route_geometry) : null,
     item.day_number || 1]
  );
}

export async function getFullItinerary(id: number) {
  const itin = await query('SELECT * FROM itineraries WHERE id=$1', [id]);
  if (itin.rows.length === 0) return null;
  const items = await query(
    `SELECT ii.*, p.name as place_name, p.lat, p.lng, p.category, p.description
     FROM itinerary_items ii JOIN places p ON ii.place_id = p.id WHERE ii.itinerary_id=$1 ORDER BY ii.stop_index`, [id]
  );
  return { itinerary: itin.rows[0], items: items.rows };
}

// Sessions
export async function createSession(title?: string): Promise<number> {
  const r = await query('INSERT INTO sessions (title) VALUES ($1) RETURNING id', [title || 'New Chat']);
  return r.rows[0].id;
}

export async function listSessions() {
  const r = await query('SELECT s.*, (SELECT COUNT(*) FROM session_messages WHERE session_id=s.id) as msg_count FROM sessions s ORDER BY s.updated_at DESC LIMIT 30');
  return r.rows;
}

export async function getSession(id: number) {
  const s = await query('SELECT * FROM sessions WHERE id=$1', [id]);
  if (s.rows.length === 0) return null;
  const msgs = await query('SELECT * FROM session_messages WHERE session_id=$1 ORDER BY created_at', [id]);
  return { session: s.rows[0], messages: msgs.rows };
}

export async function saveMessage(msg: {
  session_id: number; role: string; content: string; intent?: string;
  thinking?: string; places_json?: any; itinerary_id?: number | null;
}) {
  const r = await query(
    `INSERT INTO session_messages (session_id, role, content, intent, thinking, places_json, itinerary_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [msg.session_id, msg.role, msg.content, msg.intent || null,
     msg.thinking || null, msg.places_json ? JSON.stringify(msg.places_json) : null,
     msg.itinerary_id || null]
  );
  await query('UPDATE sessions SET updated_at=NOW() WHERE id=$1', [msg.session_id]);
  return r.rows[0].id;
}
