// Database client — tries PostgreSQL first, falls back to local SQLite
import pg from 'pg';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const { Pool } = pg;

// ── PostgreSQL setup ──
const dbConfig = {
  host: process.env.CLOUD_SQL_HOST || process.env.PGHOST || 'localhost',
  port: parseInt(process.env.CLOUD_SQL_PORT || process.env.PGPORT || '5432'),
  user: process.env.CLOUD_SQL_USER || process.env.PGUSER || 'postgres',
  password: process.env.CLOUD_SQL_PASSWORD || process.env.PGPASSWORD || 'postgres',
  database: process.env.CLOUD_SQL_DATABASE || process.env.PGDATABASE || 'inclusive_tourism_v1',
};
if (process.env.CLOUD_SQL_HOST) (dbConfig as any).ssl = { rejectUnauthorized: false };

const pool = new Pool(dbConfig);
pool.on('error', () => { /* silent — fallback handles */ });

// Simple in-memory query cache (1-min TTL)
const queryCache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 60_000;

function cachedQuery(cacheKey: string, fetcher: () => Promise<any>, ttl = CACHE_TTL): Promise<any> {
  const cached = queryCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < ttl) return Promise.resolve(cached.data);
  return fetcher().then(data => {
    queryCache.set(cacheKey, { data, ts: Date.now() });
    if (queryCache.size > 50) {
      const oldest = [...queryCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
      if (oldest) queryCache.delete(oldest[0]);
    }
    return data;
  });
}

export function invalidateCache(pattern?: string) {
  if (!pattern) { queryCache.clear(); return; }
  for (const key of queryCache.keys()) if (key.includes(pattern)) queryCache.delete(key);
}

// ── Local SQLite fallback ──
const DB_DIR = process.env.LOCAL_DB_DIR || path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'tourism.db');
let localDb: Database.Database | null = null;

function getLocalDb(): Database.Database {
  if (!localDb) {
    fs.mkdirSync(DB_DIR, { recursive: true });
    localDb = new Database(DB_PATH);
    localDb.pragma('journal_mode = WAL');
    localDb.pragma('foreign_keys = ON');
    initLocalSchema();
  }
  return localDb;
}

function initLocalSchema() {
  const db = localDb!;
  db.exec(`
    CREATE TABLE IF NOT EXISTS places (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      category TEXT,
      description TEXT,
      source_api TEXT DEFAULT 'osm',
      region TEXT,
      budget TEXT,
      price_level TEXT,
      phone TEXT,
      website TEXT,
      opening_hours TEXT,
      accessibility_score INTEGER DEFAULT 0,
      accessibility_tags TEXT,
      address TEXT DEFAULT '',
      tags TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      area TEXT DEFAULT '',
      place_type TEXT DEFAULT 'attraction',
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(name, lat, lng)
    );
    CREATE TABLE IF NOT EXISTS itineraries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_text TEXT,
      region TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS itinerary_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      itinerary_id INTEGER REFERENCES itineraries(id),
      place_id INTEGER REFERENCES places(id),
      stop_index INTEGER,
      label TEXT,
      start_time TEXT,
      end_time TEXT,
      road_distance_meters REAL DEFAULT 0,
      duration_minutes INTEGER DEFAULT 60,
      route_geometry_json TEXT,
      day_number INTEGER DEFAULT 1,
      transport_cost REAL DEFAULT 0,
      entry_cost REAL DEFAULT 0,
      transport_mode TEXT DEFAULT 'walking',
      confirmed INTEGER DEFAULT 0,
      confirmed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT DEFAULT 'New Chat',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS session_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER REFERENCES sessions(id),
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      intent TEXT,
      thinking TEXT,
      places_json TEXT,
      itinerary_id INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS global_preferences (
      id INTEGER PRIMARY KEY DEFAULT 1,
      mobility TEXT DEFAULT 'none',
      interests TEXT DEFAULT '[]',
      budget_level TEXT DEFAULT 'medium',
      home_base TEXT DEFAULT '',
      urgent_mode INTEGER DEFAULT 0,
      confirmed_itinerary_id INTEGER,
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS usage_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

// ── Auto-detect: try PG, fall back to local ──
let useLocal = false;

async function testPgConnection(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      // Use a raw TCP test instead of pg.connect to avoid protocol timeouts
      const net = await import('node:net');
      const reachable = await new Promise<boolean>((resolve) => {
        const socket = net.createConnection({
          host: dbConfig.host, port: dbConfig.port, timeout: 3000
        });
        socket.on('connect', () => { socket.end(); resolve(true); });
        socket.on('error', () => resolve(false));
        socket.on('timeout', () => { socket.destroy(); resolve(false); });
      });
      clearTimeout(timeout);
      if (!reachable) return false;
      // TCP reachable, try actual PG connect
      const client = await pool.connect();
      client.release();
      return true;
    } catch {
      clearTimeout(timeout);
      return false;
    }
  } catch {
    return false;
  }
}

// Test on first import
let initPromise: Promise<void> | null = null;
async function ensureConnected() {
  if (!initPromise) {
    initPromise = (async () => {
      useLocal = !(await testPgConnection());
      if (useLocal) {
        console.log('DB: PostgreSQL unavailable, using local SQLite at', DB_PATH);
        getLocalDb(); // init schema
      } else {
        console.log('DB: PostgreSQL connected');
      }
    })();
  }
  await initPromise;
}

// Initialize immediately (non-blocking)
ensureConnected().catch(() => { useLocal = true; getLocalDb(); });

// ── Query function ──
export async function query(text: string, params?: any[]) {
  await ensureConnected();
  if (useLocal) return localQuery(text, params);
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    console.log('DB', { text: text.slice(0, 80), duration: Date.now() - start, rows: res.rowCount });
    return res;
  } catch (err) {
    // If PG fails mid-session, don't auto-fallback (might cause partial state)
    throw err;
  }
}

function localQuery(text: string, params?: any[]): any {
  const db = getLocalDb();
  // Map PostgreSQL-style $1,$2 to SQLite ? placeholder
  const sqliteText = text.replace(/\$(\d+)/g, '?');
  
  // Normalize boolean::type casts for SQLite
  const normalized = sqliteText
    .replace(/::text/gi, '')
    .replace(/::integer/gi, '')
    .replace(/::real/gi, '')
    .replace(/::timestamp/gi, '')
    .replace(/::timestamptz/gi, '')
    .replace(/::date/gi, '');

  if (params) {
    // Convert boolean params for SQLite
    const sqliteParams = params.map(p => {
      if (typeof p === 'boolean') return p ? 1 : 0;
      return p;
    });

    if (normalized.trim().toUpperCase().startsWith('SELECT') || normalized.trim().toUpperCase().startsWith('WITH') || normalized.trim().toUpperCase().startsWith('RETURNING') || normalized.includes('RETURNING')) {
      // For SELECT / RETURNING — use all()
      const stmt = db.prepare(normalized);
      const rows = stmt.all(...sqliteParams) as any[];
      if (normalized.includes('COUNT(*) OVER()')) {
        return { rows, rowCount: rows.length };
      }
      return { rows, rowCount: rows.length };
    } else {
      const stmt = db.prepare(normalized);
      const info = stmt.run(...sqliteParams);
      // Handle RETURNING — better-sqlite3 doesn't support it directly
      if (normalized.includes('RETURNING')) {
        const lastId = (info as any).lastInsertRowid as number;
        const returningCol = normalized.match(/RETURNING\s+(\w+)/i);
        if (returningCol) {
          const col = returningCol[1];
          const table = normalized.match(/INTO\s+(\w+)/i)?.[1] || normalized.match(/UPDATE\s+(\w+)/i)?.[1] || 'places';
          try {
            const result = db.prepare(`SELECT ${col} FROM ${table} WHERE rowid = ?`).get(lastId) || 
                          db.prepare(`SELECT ${col} FROM ${table} WHERE id = ?`).get(lastId);
            return { rows: result ? [result] : [], rowCount: result ? 1 : 0 };
          } catch { return { rows: [{ id: lastId }], rowCount: 1 }; }
        }
        return { rows: [{ id: lastId }], rowCount: 1 };
      }
      return { rows: [], rowCount: (info as any).changes as number };
    }
  }
  
  const stmt = db.prepare(normalized);
  if (normalized.trim().toUpperCase().startsWith('SELECT') || normalized.includes('RETURNING')) {
    const rows = stmt.all() as any[];
    return { rows, rowCount: rows.length };
  }
  const info = stmt.run();
  return { rows: [], rowCount: (info as any).changes as number };
}

// ── Places ──
export async function savePlace(place: {
  name: string; lat: number; lng: number; category?: string;
  description?: string; source_api?: string;
  price_level?: string; phone?: string; website?: string; opening_hours?: string;
}): Promise<number> {
  await ensureConnected();
  if (useLocal) {
    const db = getLocalDb();
    const existing = db.prepare('SELECT id FROM places WHERE name = ? AND lat = ? AND lng = ?').get(place.name, place.lat, place.lng) as any;
    if (existing) return existing.id;
    const info = db.prepare(
      `INSERT INTO places (name, lat, lng, category, description, source_api, price_level, phone, website, opening_hours)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    ).run(place.name, place.lat, place.lng, place.category || null, place.description || null,
      place.source_api || 'osm', place.price_level || null, place.phone || null,
      place.website || null, place.opening_hours || null);
    return (info as any).lastInsertRowid as number;
  }
  const r = await query(
    `INSERT INTO places (name, lat, lng, category, description, source_api, price_level, phone, website, opening_hours)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT ON CONSTRAINT places_name_lng_lat_key DO NOTHING RETURNING id`,
    [place.name, place.lat, place.lng, place.category || null, place.description || null,
     place.source_api || 'osm', place.price_level || null, place.phone || null,
     place.website || null, place.opening_hours || null]
  );
  if (r.rows.length > 0) return r.rows[0].id;
  const e = await query('SELECT id FROM places WHERE name=$1 AND lat=$2 AND lng=$3', [place.name, place.lat, place.lng]);
  return e.rows[0]?.id;
}

export async function listPlaces(limit = 50, offset = 0) {
  const cacheKey = `places_${limit}_${offset}`;
  return cachedQuery(cacheKey, async () => {
    if (useLocal) {
      const db = getLocalDb();
      const total = (db.prepare('SELECT COUNT(*) as c FROM places').get() as any).c;
      const places = db.prepare('SELECT *, ? as total_count FROM places ORDER BY name LIMIT ? OFFSET ?').all(total, limit, offset);
      return { places, total };
    }
    const r = await query('SELECT *, COUNT(*) OVER() as total_count FROM places ORDER BY name LIMIT $1 OFFSET $2', [limit, offset]);
    return { places: r.rows, total: r.rows.length > 0 ? parseInt(r.rows[0].total_count) : 0 };
  }, 30_000);
}

// ── Itineraries ──
export async function saveItinerary(userText: string, region: string): Promise<number> {
  await ensureConnected();
  if (useLocal) {
    const db = getLocalDb();
    const info = db.prepare('INSERT INTO itineraries (user_text, region) VALUES (?,?)').run(userText, region);
    return (info as any).lastInsertRowid as number;
  }
  const r = await query('INSERT INTO itineraries (user_text, region) VALUES ($1,$2) RETURNING id', [userText, region]);
  return r.rows[0].id;
}

export async function saveItineraryItem(item: {
  itinerary_id: number; place_id: number; stop_index: number; label?: string;
  start_time?: string; end_time?: string; road_distance_meters?: number;
  duration_minutes?: number; route_geometry?: any; day_number?: number;
  transport_cost?: number; entry_cost?: number; transport_mode?: string; confirmed?: boolean;
}) {
  await ensureConnected();
  if (useLocal) {
    const db = getLocalDb();
    db.prepare(
      `INSERT INTO itinerary_items (itinerary_id, place_id, stop_index, label, start_time, end_time, road_distance_meters, duration_minutes, route_geometry_json, day_number, transport_cost, entry_cost, transport_mode, confirmed)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(item.itinerary_id, item.place_id, item.stop_index, item.label || null,
      item.start_time || null, item.end_time || null,
      item.road_distance_meters || 0, item.duration_minutes || 60,
      item.route_geometry ? JSON.stringify(item.route_geometry) : null,
      item.day_number || 1, item.transport_cost || 0, item.entry_cost || 0,
      item.transport_mode || 'walking', item.confirmed ? 1 : 0);
    return;
  }
  await query(
    `INSERT INTO itinerary_items (itinerary_id, place_id, stop_index, label, start_time, end_time, road_distance_meters, duration_minutes, route_geometry_json, day_number, transport_cost, entry_cost, transport_mode, confirmed)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [item.itinerary_id, item.place_id, item.stop_index, item.label || null,
     item.start_time || null, item.end_time || null,
     item.road_distance_meters || 0, item.duration_minutes || 60,
     item.route_geometry ? JSON.stringify(item.route_geometry) : null,
     item.day_number || 1, item.transport_cost || 0, item.entry_cost || 0,
     item.transport_mode || 'walking', item.confirmed ?? false]
  );
}

export async function getFullItinerary(id: number) {
  await ensureConnected();
  if (useLocal) {
    const db = getLocalDb();
    const itin = db.prepare('SELECT * FROM itineraries WHERE id=?').get(id) as any;
    if (!itin) return null;
    const items = db.prepare(
      `SELECT ii.*, p.name as place_name, p.lat, p.lng, p.category, p.description,
              p.accessibility_score, p.accessibility_tags,
              p.opening_hours, p.price_level, p.phone, p.website
       FROM itinerary_items ii JOIN places p ON ii.place_id = p.id
       WHERE ii.itinerary_id=? ORDER BY ii.stop_index`
    ).all(id) as any[];
    const totalTransport = items.reduce((s: number, r: any) => s + parseFloat(r.transport_cost || 0), 0);
    const totalEntry = items.reduce((s: number, r: any) => s + parseFloat(r.entry_cost || 0), 0);
    const confirmedCount = items.filter((r: any) => r.confirmed).length;
    return {
      itinerary: itin,
      items,
      costSummary: { totalTransport, totalEntry, totalAll: totalTransport + totalEntry, confirmedCount },
    };
  }
  const itin = await query('SELECT * FROM itineraries WHERE id=$1', [id]);
  if (itin.rows.length === 0) return null;
  const items = await query(
    `SELECT ii.*, p.name as place_name, p.lat, p.lng, p.category, p.description,
            p.accessibility_score, p.accessibility_tags,
            p.opening_hours, p.price_level, p.phone, p.website
     FROM itinerary_items ii JOIN places p ON ii.place_id = p.id WHERE ii.itinerary_id=$1 ORDER BY ii.stop_index`, [id]
  );
  const rows = items.rows;
  const totalTransport = rows.reduce((s: number, r: any) => s + parseFloat(r.transport_cost || 0), 0);
  const totalEntry = rows.reduce((s: number, r: any) => s + parseFloat(r.entry_cost || 0), 0);
  const confirmedCount = rows.filter((r: any) => r.confirmed).length;
  return {
    itinerary: itin.rows[0],
    items: rows,
    costSummary: { totalTransport, totalEntry, totalAll: totalTransport + totalEntry, confirmedCount },
  };
}

// ── Sessions ──
export async function createSession(title?: string): Promise<number> {
  await ensureConnected();
  if (useLocal) {
    const db = getLocalDb();
    const info = db.prepare('INSERT INTO sessions (title) VALUES (?)').run(title || 'New Chat');
    invalidateCache('sessions');
    return (info as any).lastInsertRowid as number;
  }
  const r = await query('INSERT INTO sessions (title) VALUES ($1) RETURNING id', [title || 'New Chat']);
  invalidateCache('sessions');
  return r.rows[0].id;
}

export async function listSessions() {
  await ensureConnected();
  const cacheKey = 'sessions_list';
  return cachedQuery(cacheKey, async () => {
    if (useLocal) {
      const db = getLocalDb();
      const rows = db.prepare(
        `SELECT s.*,
          (SELECT COUNT(*) FROM session_messages WHERE session_id=s.id) as msg_count,
          (SELECT content FROM session_messages WHERE session_id=s.id AND role='user' ORDER BY created_at LIMIT 1) as first_msg
         FROM sessions s ORDER BY s.updated_at DESC LIMIT 30`
      ).all() as any[];
      return rows.map((row: any) => ({
        ...row,
        display_title: row.title && row.title !== 'New Chat' ? row.title :
          row.first_msg ? (row.first_msg.length > 35 ? row.first_msg.slice(0, 35) + '…' : row.first_msg) : 'New Chat',
      }));
    }
    const r = await query(`SELECT s.*,
      (SELECT COUNT(*) FROM session_messages WHERE session_id=s.id) as msg_count,
      (SELECT content FROM session_messages WHERE session_id=s.id AND role='user' ORDER BY created_at LIMIT 1) as first_msg
      FROM sessions s ORDER BY s.updated_at DESC LIMIT 30`);
    return r.rows.map((row: any) => ({
      ...row,
      display_title: row.title && row.title !== 'New Chat' ? row.title :
        row.first_msg ? (row.first_msg.length > 35 ? row.first_msg.slice(0, 35) + '…' : row.first_msg) : 'New Chat',
    }));
  }, 15_000);
}

export async function getSession(id: number) {
  await ensureConnected();
  if (useLocal) {
    const db = getLocalDb();
    const s = db.prepare('SELECT * FROM sessions WHERE id=?').get(id) as any;
    if (!s) return null;
    const msgs = db.prepare('SELECT * FROM session_messages WHERE session_id=? ORDER BY created_at').all(id);
    const firstMsg = (msgs as any[]).find((m: any) => m.role === 'user');
    s.display_title = s.title && s.title !== 'New Chat' ? s.title :
      firstMsg ? (firstMsg.content.length > 35 ? firstMsg.content.slice(0, 35) + '…' : firstMsg.content) : 'New Chat';
    return { session: s, messages: msgs };
  }
  const s = await query('SELECT * FROM sessions WHERE id=$1', [id]);
  if (s.rows.length === 0) return null;
  const msgs = await query('SELECT * FROM session_messages WHERE session_id=$1 ORDER BY created_at', [id]);
  const row = s.rows[0];
  const firstMsg = msgs.rows.find((m: any) => m.role === 'user');
  row.display_title = row.title && row.title !== 'New Chat' ? row.title :
    firstMsg ? (firstMsg.content.length > 35 ? firstMsg.content.slice(0, 35) + '…' : firstMsg.content) : 'New Chat';
  return { session: row, messages: msgs.rows };
}

export async function saveMessage(msg: {
  session_id: number; role: string; content: string; intent?: string;
  thinking?: string; places_json?: any; itinerary_id?: number | null;
}) {
  await ensureConnected();
  if (useLocal) {
    const db = getLocalDb();
    const info = db.prepare(
      `INSERT INTO session_messages (session_id, role, content, intent, thinking, places_json, itinerary_id)
       VALUES (?,?,?,?,?,?,?)`
    ).run(msg.session_id, msg.role, msg.content, msg.intent || null,
      msg.thinking || null, msg.places_json ? JSON.stringify(msg.places_json) : null,
      msg.itinerary_id || null);
    db.prepare('UPDATE sessions SET updated_at=datetime(?) WHERE id=?').run('now', msg.session_id);
    invalidateCache('sessions');
    return (info as any).lastInsertRowid as number;
  }
  const r = await query(
    `INSERT INTO session_messages (session_id, role, content, intent, thinking, places_json, itinerary_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [msg.session_id, msg.role, msg.content, msg.intent || null,
     msg.thinking || null, msg.places_json ? JSON.stringify(msg.places_json) : null,
     msg.itinerary_id || null]
  );
  await query('UPDATE sessions SET updated_at=NOW() WHERE id=$1', [msg.session_id]);
  invalidateCache('sessions');
  return r.rows[0].id;
}
