const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.get('/', async (req, res) => {
  let sql = 'SELECT * FROM places WHERE 1=1';
  const params = [];
  if (req.query.district) { sql += ' AND district = ?'; params.push(req.query.district); }
  if (req.query.mobility === 'wheelchair') { sql += ' AND has_ramp = 1'; }
  if (req.query.min_score) { sql += ' AND accessibility_score >= ?'; params.push(parseInt(req.query.min_score)); }
  sql += ' ORDER BY accessibility_score DESC';

  const places = await db.all(sql, params);
  const total = (await db.get('SELECT COUNT(*) as count FROM places'))?.count || 0;
  res.json({ success: true, places, total });
});

router.get('/:id', async (req, res) => {
  const place = await db.get('SELECT * FROM places WHERE id = ?', [req.params.id]);
  if (!place) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, data: place });
});

module.exports = router;
