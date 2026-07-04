import { Router, Request, Response } from 'express';
import { getGlobalPreferences, setGlobalPreferences } from '../services/globalPreferencesService';

const router = Router();

router.get('/preferences', async (_req: Request, res: Response) => {
  try {
    const prefs = await getGlobalPreferences();
    res.json(prefs);
  } catch (err) {
    console.error('Get global preferences error:', err);
    res.status(500).json({ error: 'Failed to get preferences' });
  }
});

router.put('/preferences', async (req: Request, res: Response) => {
  try {
    const prefs = await setGlobalPreferences(req.body);
    res.json(prefs);
  } catch (err) {
    console.error('Set global preferences error:', err);
    res.status(500).json({ error: 'Failed to set preferences' });
  }
});

export default router;
