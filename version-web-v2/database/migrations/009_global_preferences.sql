CREATE TABLE IF NOT EXISTS global_preferences (
  id INTEGER PRIMARY KEY DEFAULT 1,
  mobility TEXT DEFAULT 'none',
  interests TEXT[] DEFAULT '{}',
  budget_level TEXT DEFAULT 'medium',
  home_base TEXT DEFAULT '',
  updated_at TIMESTAMP DEFAULT NOW()
);
INSERT INTO global_preferences (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
