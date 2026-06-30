const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { randomUUID } = require('crypto');

// POST /api/profile — create or update user profile
router.post('/', (req, res) => {
  const { session_id, mobility_type, needs_frequent_rest, dietary_tags, language } = req.body;

  const sessionId = session_id || randomUUID();

  const upsert = db.prepare(`
    INSERT INTO user_profiles (session_id, mobility_type, needs_frequent_rest, dietary_tags, language)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(session_id) DO UPDATE SET
      mobility_type = excluded.mobility_type,
      needs_frequent_rest = excluded.needs_frequent_rest,
      dietary_tags = excluded.dietary_tags,
      language = excluded.language
  `);

  try {
    upsert.run(
      sessionId,
      mobility_type || 'standard',
      needs_frequent_rest ? 1 : 0,
      JSON.stringify(dietary_tags || []),
      language || 'en'
    );

    const profile = db.prepare('SELECT * FROM user_profiles WHERE session_id = ?').get(sessionId);
    res.json({ success: true, session_id: sessionId, data: profile });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/profile/:session_id
router.get('/:session_id', (req, res) => {
  const profile = db.prepare('SELECT * FROM user_profiles WHERE session_id = ?').get(req.params.session_id);
  if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });
  res.json({ success: true, data: profile });
});

module.exports = router;
