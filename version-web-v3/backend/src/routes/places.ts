import { Router, Request, Response } from 'express';
import { listPlaces } from '../db/client';

const router = Router();
const PIPELINE_TOKEN = process.env.PIPELINE_TOKEN || '';

router.get('/places', async (req: Request, res: Response) => {
  try {
    const limit = Math.max(1, Math.min(parseInt(req.query.limit as string) || 50, 200));
    const offset = parseInt(req.query.offset as string) || 0;
    const data = await listPlaces(limit, offset);
    res.json(data);
  } catch (err) {
    console.error('List places error:', err);
    res.status(500).json({ error: 'Failed to list places' });
  }
});

// POST /places/pipeline — trigger Google Places data fetch (guarded)
router.post('/places/pipeline', async (req: Request, res: Response) => {
  try {
    if (PIPELINE_TOKEN && req.headers.authorization !== `Bearer ${PIPELINE_TOKEN}`) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }
    const { runPlacesPipeline } = await import('../services/placesPipeline');
    const result = await runPlacesPipeline();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
