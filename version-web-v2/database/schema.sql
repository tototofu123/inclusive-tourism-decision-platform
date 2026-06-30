-- Inclusive Tourism Platform v2 — AlloyDB Schema
-- Compatible with PostgreSQL 15+
-- Run once on a fresh AlloyDB instance.

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── Places ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS places (
  place_id          TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  address           TEXT,
  city              TEXT,
  lat               FLOAT,
  lng               FLOAT,
  accessibility_tags TEXT[],
  embedding         vector(768),
  source_url        TEXT,
  verified          BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS places_city_idx ON places (city);
CREATE INDEX IF NOT EXISTS places_tags_idx ON places USING GIN (accessibility_tags);
CREATE INDEX IF NOT EXISTS places_embedding_idx
  ON places USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ─── User Profiles ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id           TEXT PRIMARY KEY,
  mobility_tags     TEXT[] DEFAULT '{}',
  dietary_tags      TEXT[] DEFAULT '{}',
  language          TEXT DEFAULT 'en',
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- ─── Itinerary History ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS itineraries (
  id                SERIAL PRIMARY KEY,
  user_id           TEXT REFERENCES user_profiles(user_id) ON DELETE SET NULL,
  query             TEXT,
  location          TEXT,
  result_json       JSONB,
  source            TEXT CHECK (source IN ('cloud', 'local')),
  latency_ms        INT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS itineraries_user_idx ON itineraries (user_id);
CREATE INDEX IF NOT EXISTS itineraries_location_idx ON itineraries (location);
