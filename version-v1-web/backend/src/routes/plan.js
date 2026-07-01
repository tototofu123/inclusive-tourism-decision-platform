const express = require('express');
const router = express.Router();
const plannerService = require('../services/planner');

/**
 * POST /api/plan
 * Body: {
 *   message: string,          // user's natural language request
 *   userProfile: {            // optional accessibility constraints
 *     mobility: 'wheelchair' | 'slow_walk' | 'normal',
 *     needsRestFrequently: boolean,
 *     dietaryTags: string[],
 *   },
 *   location: { lat: number, lng: number },
 *   lang: 'en' | 'zh-HK' | 'zh-CN'
 * }
 */
router.post('/', async (req, res, next) => {
  try {
    const { message, userProfile = {}, location, lang = 'en' } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: '"message" string is required' });
    }
    if (message.length > 1000) {
      return res.status(400).json({ error: 'Message too long (max 1000 chars)' });
    }

    const result = await plannerService.generatePlan({ message, userProfile, location, lang });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
