const express = require('express');
const router = express.Router();
const pg = require('../db/pg');
const { callLlama } = require('../agent/planningAgent');
const { searchSimilar } = require('../services/vectorSearch');
const { routeBetweenStops } = require('../services/ors');

router.post('/', async (req, res) => {
  const { session_id, user_request, district, duration_hours } = req.body;
  if (!user_request) return res.status(400).json({ success: false, error: 'user_request is required' });

  try {
    let profile = null;
    if (session_id) {
      profile = await pg.get('SELECT * FROM user_profiles WHERE session_id = $1', [session_id]);
    }

    // v1: vector search for semantically relevant places
    let candidatePlaces = await searchSimilar(user_request, {
      limit: 8,
      minScore: 60,
      mobilityType: profile?.mobility_type,
      district
    });

    // Fallback: if vector search returns nothing, use text query
    if (!candidatePlaces.length) {
      let sql = 'SELECT * FROM places WHERE accessibility_score >= 60';
      const params = [];
      if (district) { sql += ' AND district = $' + (params.length + 1); params.push(district); }
      if (profile?.mobility_type === 'wheelchair') {
        sql += ' AND has_ramp = true AND has_accessible_toilet = true';
      }
      sql += ' ORDER BY accessibility_score DESC LIMIT 8';
      candidatePlaces = await pg.all(sql, params);
    }

    // v1: get routing between candidate places
    let routing = [];
    if (candidatePlaces.length >= 2) {
      routing = await routeBetweenStops(candidatePlaces.slice(0, 5));
    }

    const result = await callLlama({
      userRequest: user_request,
      profile,
      candidatePlaces,
      routing,
      durationHours: duration_hours || 4,
    });

    const aiText = (typeof result.raw === 'string' && result.raw.length > 0) ? result.raw : JSON.stringify(result.plan);
    const planText = JSON.stringify(result.plan);
    const resp = await pg.query(
      `INSERT INTO itineraries (session_id, user_request, ai_response, parsed_plan)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [session_id || 'anonymous', user_request, aiText, planText]
    );
    const id = resp.rows[0]?.id;

    res.json({
      success: true,
      itinerary_id: id,
      plan: result.plan,
      places_considered: candidatePlaces.length,
      routing,
    });
  } catch (err) {
    console.error('Itinerary error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  const item = await pg.get('SELECT * FROM itineraries WHERE id = $1', [req.params.id]);
  if (!item) return res.status(404).json({ success: false, error: 'Not found' });
  if (typeof item.parsed_plan === 'string') item.parsed_plan = JSON.parse(item.parsed_plan);
  res.json({ success: true, data: item });
});

module.exports = router;
