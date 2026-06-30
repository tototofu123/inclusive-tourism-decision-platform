const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { callLlama } = require('../agent/planningAgent');

// POST /api/itinerary — generate an accessible itinerary
router.post('/', async (req, res) => {
  const { session_id, user_request, district, duration_hours } = req.body;

  if (!user_request) {
    return res.status(400).json({ success: false, error: 'user_request is required' });
  }

  // Load user profile if session_id provided
  let profile = null;
  if (session_id) {
    profile = db.prepare('SELECT * FROM user_profiles WHERE session_id = ?').get(session_id);
  }

  // Get candidate places from DB
  let placesQuery = 'SELECT * FROM places WHERE accessibility_score >= 60';
  const placesParams = [];
  if (district) {
    placesQuery += ' AND district = ?';
    placesParams.push(district);
  }
  if (profile?.mobility_type === 'wheelchair') {
    placesQuery += ' AND has_ramp = 1 AND has_accessible_toilet = 1';
  }
  placesQuery += ' ORDER BY accessibility_score DESC LIMIT 8';

  const candidatePlaces = db.prepare(placesQuery).all(...placesParams);

  try {
    const result = await callLlama({
      userRequest: user_request,
      profile,
      candidatePlaces,
      durationHours: duration_hours || 4
    });

    // Save to DB
    const saved = db.prepare(`
      INSERT INTO itineraries (session_id, user_request, ai_response, parsed_plan)
      VALUES (?, ?, ?, ?)
    `).run(
      session_id || 'anonymous',
      user_request,
      JSON.stringify(result.raw),
      JSON.stringify(result.plan)
    );

    res.json({
      success: true,
      itinerary_id: saved.lastInsertRowid,
      plan: result.plan,
      places_considered: candidatePlaces.length
    });
  } catch (err) {
    console.error('Itinerary generation error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/itinerary/:id — fetch saved itinerary
router.get('/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM itineraries WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ success: false, error: 'Itinerary not found' });
  item.parsed_plan = JSON.parse(item.parsed_plan || 'null');
  res.json({ success: true, data: item });
});

module.exports = router;
