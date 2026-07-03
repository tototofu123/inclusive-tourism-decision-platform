import { Router, Request, Response } from 'express';
import { getPreferences, setPreferences } from '../services/preferencesService';
import { getGlobalPreferences, setGlobalPreferences } from '../services/globalPreferencesService';

const router = Router();

// Session-level preferences (legacy)
router.get('/preferences/:sessionId', async (req: Request, res: Response) => {
  try {
    const sid = parseInt(req.params.sessionId as string);
    if (isNaN(sid)) { res.status(400).json({ error: 'Invalid session ID' }); return; }
    const prefs = await getPreferences(sid);
    res.json(prefs);
  } catch (err) {
    console.error('Get preferences error:', err);
    res.status(500).json({ error: 'Failed to get preferences' });
  }
});

router.post('/preferences/:sessionId', async (req: Request, res: Response) => {
  try {
    const sid = parseInt(req.params.sessionId as string);
    if (isNaN(sid)) { res.status(400).json({ error: 'Invalid session ID' }); return; }
    const prefs = await setPreferences(sid, req.body);
    res.json(prefs);
  } catch (err) {
    console.error('Set preferences error:', err);
    res.status(500).json({ error: 'Failed to set preferences' });
  }
});

router.delete('/preferences/:sessionId', async (req: Request, res: Response) => {
  try {
    const sid = parseInt(req.params.sessionId as string);
    if (isNaN(sid)) { res.status(400).json({ error: 'Invalid session ID' }); return; }
    const prefs = await setPreferences(sid, {});
    res.json(prefs);
  } catch (err) {
    console.error('Reset preferences error:', err);
    res.status(500).json({ error: 'Failed to reset preferences' });
  }
});

// Global preferences
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
