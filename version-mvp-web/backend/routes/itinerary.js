const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { callLlama } = require('../agent/planningAgent');

router.post('/', async (req, res) => {
  const { session_id, user_request, district, duration_hours } = req.body;
  if (!user_request) return res.status(400).json({ success: false, error: 'user_request is required' });

  let profile = null;
  if (session_id) {
    profile = await db.get('SELECT * FROM user_profiles WHERE session_id = ?', [session_id]);
  }

  let sql = 'SELECT * FROM places WHERE accessibility_score >= 60';
  const params = [];
  if (district) { sql += ' AND district = ?'; params.push(district); }
  if (profile?.mobility_type === 'wheelchair') {
    sql += ' AND has_ramp = 1 AND has_accessible_toilet = 1';
  }
  sql += ' ORDER BY accessibility_score DESC LIMIT 8';

  const candidatePlaces = await db.all(sql, params);

  try {
    const result = await callLlama({
      userRequest: user_request, profile, candidatePlaces,
      durationHours: duration_hours || 4,
    });
    const id = await db.insert(
      'INSERT INTO itineraries (session_id, user_request, ai_response, parsed_plan) VALUES (?, ?, ?, ?)',
      [session_id || 'anonymous', user_request, JSON.stringify(result.raw), JSON.stringify(result.plan)]
    );
    res.json({ success: true, itinerary_id: id, plan: result.plan, places_considered: candidatePlaces.length });
  } catch (err) {
    console.error('Itinerary error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  const item = await db.get('SELECT * FROM itineraries WHERE id = ?', [req.params.id]);
  if (!item) return res.status(404).json({ success: false, error: 'Not found' });
  item.parsed_plan = JSON.parse(item.parsed_plan || 'null');
  res.json({ success: true, data: item });
});

module.exports = router;
