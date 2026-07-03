CREATE TABLE IF NOT EXISTS usage_events (
  id SERIAL PRIMARY KEY,
  event TEXT NOT NULL,
  source TEXT,
  latency_ms INTEGER,
  mobility_tags JSONB,
  location TEXT,
  place_id TEXT,
  reason TEXT,
  ts TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
