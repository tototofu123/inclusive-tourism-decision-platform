const express = require('express');
const router = express.Router();
const pg = require('../db/pg');
const { searchSimilar } = require('../services/vectorSearch');

router.get('/', async (req, res) => {
  try {
    const { district, mobility, min_score, q } = req.query;
    
    if (q) {
      const results = await searchSimilar(q, {
        minScore: parseInt(min_score || '60'),
        mobilityType: mobility,
        district
      });
      return res.json({ total: results.length, places: results, semantic: true });
    }

    let sql = 'SELECT * FROM places WHERE 1=1';
    const params = [];
    if (district) { sql += ' AND district = $' + (params.length + 1); params.push(district); }
    if (min_score) { sql += ' AND accessibility_score >= $' + (params.length + 1); params.push(parseInt(min_score)); }
    if (mobility === 'wheelchair') { sql += ' AND has_ramp = true AND has_accessible_toilet = true'; }
    sql += ' ORDER BY accessibility_score DESC LIMIT 50';

    const rows = await pg.all(sql, params);
    res.json({ total: rows.length, places: rows });
  } catch (err) {
    console.error('Places error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  const row = await pg.get('SELECT * FROM places WHERE id = $1', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

module.exports = router;
