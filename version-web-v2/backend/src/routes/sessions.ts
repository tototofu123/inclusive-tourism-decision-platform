import { Router, Request, Response } from 'express';
import { createSession, listSessions, getSession } from '../db/client';

const router = Router();

router.get('/sessions', async (_req: Request, res: Response) => {
  try {
    const rows = await listSessions();
    res.json(rows);
  } catch (err) {
    console.error('List sessions error:', err);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

router.post('/sessions', async (req: Request, res: Response) => {
  try {
    const id = await createSession(req.body.title);
    res.json({ id });
  } catch (err) {
    console.error('Create session error:', err);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

router.get('/sessions/:id', async (req: Request, res: Response) => {
  try {
    const data = await getSession(parseInt(req.params.id as string));
    if (!data) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(data);
  } catch (err) {
    console.error('Get session error:', err);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

export default router;
