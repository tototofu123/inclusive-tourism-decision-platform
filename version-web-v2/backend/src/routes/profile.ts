import { Router } from 'express';

export const profileRouter = Router();

// In-memory store for dev — replace with AlloyDB in production
const profiles = new Map<string, object>();

profileRouter.get('/:userId', (req, res) => {
  const profile = profiles.get(req.params.userId);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  res.json(profile);
});

profileRouter.post('/:userId', (req, res) => {
  profiles.set(req.params.userId, req.body);
  res.json({ ok: true });
});
