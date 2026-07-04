import { Router, Request, Response } from 'express';
import { getFullItinerary, query } from '../db/client';
import { setGlobalPreferences } from '../services/globalPreferencesService';

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

router.post('/itinerary/:id/confirm', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    await setGlobalPreferences({ urgent_mode: true, confirmed_itinerary_id: id });
    await query('UPDATE itinerary_items SET confirmed=true, confirmed_at=NOW() WHERE itinerary_id=$1', [id]);
    res.json({ confirmed: true, itinerary_id: id });
  } catch (err) {
    console.error('Confirm error:', err);
    res.status(500).json({ error: 'Failed to confirm itinerary' });
  }
});

router.post('/itinerary/:id/unlock', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
    await setGlobalPreferences({ urgent_mode: false, confirmed_itinerary_id: null });
    await query('UPDATE itinerary_items SET confirmed=false WHERE itinerary_id=$1', [id]);
    res.json({ confirmed: false, itinerary_id: id });
  } catch (err) {
    console.error('Unlock error:', err);
    res.status(500).json({ error: 'Failed to unlock itinerary' });
  }
});

export default router;
