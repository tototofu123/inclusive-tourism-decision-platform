import { Router, Request, Response } from 'express';
import { listPlaces } from '../db/client';

const router = Router();

router.get('/places', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 9999;
    const offset = parseInt(req.query.offset as string) || 0;
    const data = await listPlaces(limit, offset);
    res.json(data);
  } catch (err) {
    console.error('List places error:', err);
    res.status(500).json({ error: 'Failed to list places' });
  }
});

export default router;
