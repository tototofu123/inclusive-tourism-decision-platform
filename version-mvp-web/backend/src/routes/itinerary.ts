import { Router, Request, Response } from 'express';
import { getFullItinerary } from '../db/client';

const router = Router();

router.get('/itinerary/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    const data = await getFullItinerary(id);
    if (!data) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(data);
  } catch (err) {
    console.error('Fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch itinerary' });
  }
});

export default router;
