CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS places (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  name_zh TEXT,
  district TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  category TEXT NOT NULL DEFAULT 'attraction',
  accessibility_score INTEGER NOT NULL DEFAULT 50,
  has_ramp BOOLEAN DEFAULT FALSE,
  has_lift BOOLEAN DEFAULT FALSE,
  has_accessible_toilet BOOLEAN DEFAULT FALSE,
  has_tactile_path BOOLEAN DEFAULT FALSE,
  bench_count INTEGER DEFAULT 0,
  notes TEXT,
  embedding vector(384),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id SERIAL PRIMARY KEY,
  session_id TEXT UNIQUE NOT NULL,
  mobility_type TEXT DEFAULT 'standard',
  needs_frequent_rest BOOLEAN DEFAULT FALSE,
  dietary_tags TEXT DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS itineraries (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_request TEXT NOT NULL,
  ai_response JSONB,
  parsed_plan JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_places_district ON places(district);
CREATE INDEX IF NOT EXISTS idx_places_accessibility ON places(accessibility_score);
CREATE INDEX IF NOT EXISTS idx_places_embedding ON places USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);
CREATE INDEX IF NOT EXISTS idx_itineraries_session ON itineraries(session_id);
