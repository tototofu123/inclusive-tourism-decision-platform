import { Router } from 'express';
import { generateItinerary } from '../services/cloudAiGateway';

export const itineraryRouter = Router();

itineraryRouter.post('/', async (req, res) => {
  try {
    const result = await generateItinerary(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
