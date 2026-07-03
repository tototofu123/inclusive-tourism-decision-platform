import { Router, Request, Response } from 'express';
import { generateItinerary } from '../services/cloudAiGateway';

const router = Router();

router.post('/gateway/itinerary', async (req: Request, res: Response) => {
  try {
    const { userQuery, userProfile, location, durationHours } = req.body;

    if (!userQuery || typeof userQuery !== 'string' || !userQuery.trim()) {
      res.status(400).json({ error: 'userQuery is required' });
      return;
    }

    const result = await generateItinerary({
      userQuery: userQuery.trim(),
      userProfile: {
        mobilityTags: userProfile?.mobilityTags ?? [],
        dietaryTags: userProfile?.dietaryTags ?? [],
        language: userProfile?.language ?? 'en',
      },
      location: location || 'Hong Kong',
      durationHours: durationHours || 4,
    });

    res.json(result);
  } catch (err) {
    console.error('Gateway error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
