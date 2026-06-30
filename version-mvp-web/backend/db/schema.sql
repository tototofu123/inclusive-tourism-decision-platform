-- Inclusive Tourism MVP — SQLite Schema
-- Run: sqlite3 mvp.sqlite < schema.sql

CREATE TABLE IF NOT EXISTS places (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_zh TEXT,
  district TEXT NOT NULL,
  lat REAL,
  lng REAL,
  category TEXT,           -- 'attraction' | 'rest_stop' | 'restaurant' | 'transport'
  accessibility_score INTEGER DEFAULT 0,  -- 0-100
  has_ramp INTEGER DEFAULT 0,
  has_lift INTEGER DEFAULT 0,
  has_accessible_toilet INTEGER DEFAULT 0,
  has_tactile_path INTEGER DEFAULT 0,
  bench_count INTEGER DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT UNIQUE NOT NULL,
  mobility_type TEXT,      -- 'wheelchair' | 'walker' | 'slow_walker' | 'standard'
  needs_frequent_rest INTEGER DEFAULT 0,
  dietary_tags TEXT,       -- JSON array as text: '["halal","vegetarian"]'
  language TEXT DEFAULT 'en',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS itineraries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  user_request TEXT NOT NULL,
  ai_response TEXT,        -- raw AI JSON string
  parsed_plan TEXT,        -- cleaned plan JSON
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_places_district ON places(district);
CREATE INDEX IF NOT EXISTS idx_places_accessibility ON places(accessibility_score);
CREATE INDEX IF NOT EXISTS idx_itineraries_session ON itineraries(session_id);
