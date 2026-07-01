const express = require('express');
const router = express.Router();
const placesService = require('../services/places');

// GET /api/places?lat=22.3&lng=114.1&radius=1500&tags=wheelchair,bench
router.get('/', async (req, res, next) => {
  try {
    const { lat, lng, radius = 1500, tags } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng are required' });

    const tagList = tags ? tags.split(',').map(t => t.trim().toLowerCase()) : [];
    const places = await placesService.findNearby({
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      radiusMeters: parseInt(radius),
      tags: tagList,
    });
    res.json({ places });
  } catch (err) {
    next(err);
  }
});

// GET /api/places/:id
router.get('/:id', async (req, res, next) => {
  try {
    const place = await placesService.getById(req.params.id);
    if (!place) return res.status(404).json({ error: 'Place not found' });
    res.json(place);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
