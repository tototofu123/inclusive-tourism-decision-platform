/**
 * Database migration — creates tables for MVP.
 * Run: node src/database/migrate.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { getPool } = require('./pool');

const SQL = `
-- Enable array operators
CREATE EXTENSION IF NOT EXISTS intarray;

-- Places table
CREATE TABLE IF NOT EXISTS places (
  id                 SERIAL PRIMARY KEY,
  name               TEXT NOT NULL,
  category           TEXT NOT NULL DEFAULT 'attraction',
  lat                DOUBLE PRECISION NOT NULL,
  lng                DOUBLE PRECISION NOT NULL,
  address            TEXT,
  description        TEXT,
  accessibility_tags TEXT[] NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast bounding box queries
CREATE INDEX IF NOT EXISTS idx_places_lat ON places (lat);
CREATE INDEX IF NOT EXISTS idx_places_lng ON places (lng);

-- GIN index for fast array tag filtering
CREATE INDEX IF NOT EXISTS idx_places_tags ON places USING GIN (accessibility_tags);

-- User profiles (lightweight for MVP — no auth)
CREATE TABLE IF NOT EXISTS user_profiles (
  id             SERIAL PRIMARY KEY,
  session_id     TEXT UNIQUE NOT NULL,
  mobility       TEXT NOT NULL DEFAULT 'normal',
  needs_rest     BOOLEAN NOT NULL DEFAULT FALSE,
  dietary_tags   TEXT[] NOT NULL DEFAULT '{}',
  lang           TEXT NOT NULL DEFAULT 'en',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Plan history (for future analytics)
CREATE TABLE IF NOT EXISTS plan_history (
  id           SERIAL PRIMARY KEY,
  session_id   TEXT,
  request_msg  TEXT,
  response     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

async function migrate() {
  const pool = getPool();
  try {
    console.log('Running migrations...');
    await pool.query(SQL);
    console.log('✅ Migrations complete.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
