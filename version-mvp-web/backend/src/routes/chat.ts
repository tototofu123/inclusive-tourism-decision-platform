import { Router, Request, Response } from 'express';
import { processChat } from '../services/agent';
import { query, saveMessage } from '../db/client';

const router = Router();

router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { text, itineraryId, sessionId } = req.body;
    if (!text || typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'Please provide a message' });
      return;
    }
    const sid = sessionId ? parseInt(sessionId) : undefined;
    const result = await processChat(text.trim(), itineraryId ? parseInt(itineraryId) : undefined);

    if (sid) {
      await saveMessage({
        session_id: sid, role: 'user', content: text.trim(),
      });
      await saveMessage({
        session_id: sid, role: 'assistant', content: result.response,
        intent: result.intent, thinking: JSON.stringify(result.thinking),
        places_json: result.places, itinerary_id: result.itinerary?.id || null,
      });
    }

    res.json(result);
  } catch (err) {
    const msg = (err as Error).message;
    console.error('Chat error:', msg);
    res.status(500).json({
      thinking: ['Error processing request', msg],
      intent: 'question',
      response: msg,
    });
  }
});

router.get('/itineraries', async (_req: Request, res: Response) => {
  try {
    const r = await query('SELECT i.id, i.user_text, i.created_at, COUNT(ii.id) as stop_count FROM itineraries i LEFT JOIN itinerary_items ii ON i.id = ii.itinerary_id GROUP BY i.id ORDER BY i.created_at DESC LIMIT 20');
    res.json(r.rows);
  } catch (err) {
    console.error('Fetch itineraries error:', err);
    res.status(500).json({ error: 'Failed to fetch itineraries' });
  }
});

export default router;
