const express = require('express');
const router = express.Router();
const pg = require('../db/pg');
const crypto = require('crypto');

router.post('/', async (req, res) => {
  try {
    const { session_id, mobility_type, needs_frequent_rest, dietary_tags } = req.body;
    const sid = session_id || crypto.randomUUID();
    await pg.query(`INSERT INTO user_profiles (session_id, mobility_type, needs_frequent_rest, dietary_tags)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (session_id) DO UPDATE SET
        mobility_type = EXCLUDED.mobility_type,
        needs_frequent_rest = EXCLUDED.needs_frequent_rest,
        dietary_tags = EXCLUDED.dietary_tags,
        updated_at = NOW()`,
      [sid, mobility_type || 'standard', needs_frequent_rest || false, dietary_tags || '[]']);
    const profile = await pg.get('SELECT * FROM user_profiles WHERE session_id = $1', [sid]);
    res.json({ success: true, session_id: sid, profile });
  } catch (err) {
    console.error('Profile error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:session_id', async (req, res) => {
  const profile = await pg.get('SELECT * FROM user_profiles WHERE session_id = $1', [req.params.session_id]);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  res.json({ success: true, profile });
});

module.exports = router;
