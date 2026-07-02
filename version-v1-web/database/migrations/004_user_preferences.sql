CREATE TABLE IF NOT EXISTS user_preferences (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
  mobility TEXT DEFAULT 'none',
  interests TEXT[] DEFAULT '{}',
  budget_level TEXT DEFAULT 'medium',
  home_base TEXT DEFAULT '',
  urgent_mode BOOLEAN DEFAULT false,
  confirmed_itinerary_id INTEGER DEFAULT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_prefs_session ON user_preferences(session_id);
