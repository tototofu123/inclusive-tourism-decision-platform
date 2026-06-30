const express = require('express');
const router = express.Router();
const db = require('../db/database');
const crypto = require('crypto');

router.post('/', async (req, res) => {
  const { mobility_type, needs_frequent_rest, dietary_tags, session_id } = req.body;
  const sid = session_id || crypto.randomUUID();
  const existing = await db.get('SELECT id FROM user_profiles WHERE session_id = ?', [sid]);
  if (existing) {
    await db.run(
      'UPDATE user_profiles SET mobility_type=?, needs_frequent_rest=?, dietary_tags=? WHERE session_id=?',
      [mobility_type || 'standard', needs_frequent_rest ? 1 : 0, JSON.stringify(dietary_tags || []), sid]
    );
  } else {
    await db.run(
      'INSERT INTO user_profiles (session_id, mobility_type, needs_frequent_rest, dietary_tags) VALUES (?,?,?,?)',
      [sid, mobility_type || 'standard', needs_frequent_rest ? 1 : 0, JSON.stringify(dietary_tags || [])]
    );
  }
  res.json({ success: true, session_id: sid });
});

router.get('/:session_id', async (req, res) => {
  const profile = await db.get('SELECT * FROM user_profiles WHERE session_id = ?', [req.params.session_id]);
  if (!profile) return res.status(404).json({ success: false, error: 'Not found' });
  if (profile.dietary_tags) profile.dietary_tags = JSON.parse(profile.dietary_tags);
  res.json({ success: true, data: profile });
});

module.exports = router;
