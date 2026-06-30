const express = require('express');
const router = express.Router();
const db = require('../db/database');

// GET /api/places — list all or filter by district/category/mobility
router.get('/', (req, res) => {
  const { district, category, mobility, min_score } = req.query;

  let query = 'SELECT * FROM places WHERE 1=1';
  const params = [];

  if (district) {
    query += ' AND district = ?';
    params.push(district);
  }
  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }
  if (min_score) {
    query += ' AND accessibility_score >= ?';
    params.push(parseInt(min_score));
  }
  // Filter for wheelchair users: must have ramp + accessible toilet
  if (mobility === 'wheelchair') {
    query += ' AND has_ramp = 1 AND has_accessible_toilet = 1';
  }

  query += ' ORDER BY accessibility_score DESC';

  try {
    const places = db.prepare(query).all(...params);
    res.json({ success: true, count: places.length, data: places });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/places/:id
router.get('/:id', (req, res) => {
  const place = db.prepare('SELECT * FROM places WHERE id = ?').get(req.params.id);
  if (!place) return res.status(404).json({ success: false, error: 'Place not found' });
  res.json({ success: true, data: place });
});

module.exports = router;
