import { Router, Request, Response } from 'express';
import { processChat } from '../services/agent';
import { query, saveMessage } from '../db/client';
import { sanitizeInput, detectPromptInjection, detectOffTopic } from '../services/guard';
import crypto from 'crypto';

function genSessionTitle(text: string): string {
  const t = text.trim();
  return t.length > 45 ? t.slice(0, 45) + '…' : t;
}

const router = Router();

// In-memory store for async chat processing progress
interface ProcessState {
  thinking: string[];
  done: boolean;
  result?: any;
  error?: string;
}
const processes = new Map<string, ProcessState>();

const MAX_PROCESSES = 100;

// Clean up old processes after 5 minutes
export const cleanupInterval = setInterval(() => {
  const cutoff = Date.now() - 300000;
  let doneCount = 0;
  for (const [id, state] of processes) {
    if (state.done) {
      const ts = parseInt(id.split('-')[0]);
      if (!isNaN(ts) && ts < cutoff) { processes.delete(id); doneCount++; }
    }
  }
  // Evict oldest if still over limit
  if (processes.size > MAX_PROCESSES) {
    const sorted = [...processes.entries()].sort((a, b) => {
      const ta = parseInt(a[0].split('-')[0]) || 0;
      const tb = parseInt(b[0].split('-')[0]) || 0;
      return ta - tb;
    });
    for (let i = 0; i < sorted.length - MAX_PROCESSES; i++) {
      processes.delete(sorted[i][0]);
    }
  }
}, 60000);

// POST /chat — starts async processing, returns processId immediately
router.post('/chat', async (req: Request, res: Response) => {
  const { text, itineraryId, sessionId } = req.body;
  if (!text || typeof text !== 'string' || !text.trim()) {
    res.status(400).json({ error: 'Please provide a message' });
    return;
  }

  const processId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  processes.set(processId, { thinking: [], done: false });

  // Sanitize before any processing
  const cleanText = sanitizeInput(text.trim());
  const injectionBlock = detectPromptInjection(cleanText);
  if (injectionBlock) {
    processes.set(processId, { thinking: ['Analyzing your request...', 'Done!'], done: true, result: { response: injectionBlock } });
    res.json({ processId });
    return;
  }
  const offTopicBlock = detectOffTopic(cleanText);
  if (offTopicBlock) {
    processes.set(processId, { thinking: ['Analyzing your request...', 'Done!'], done: true, result: { response: offTopicBlock } });
    res.json({ processId });
    return;
  }

  console.log('POST /chat: returning processId immediately');
  res.json({ processId });
  console.log('POST /chat: response sent, starting background...');

  // Background processing
  (async () => {
    try {
      const sid = sessionId ? parseInt(sessionId) : undefined;

      const result = await processChat(
        cleanText,
        itineraryId ? parseInt(itineraryId) : undefined,
        (step: string) => {
          const state = processes.get(processId);
          if (state) state.thinking.push(step);
        },
        sid
      );

    if (sid) {
      // Update session title if still default
      const sess = await query('SELECT title FROM sessions WHERE id=$1', [sid]);
      if (sess.rows.length > 0 && (sess.rows[0].title === 'New Chat' || !sess.rows[0].title)) {
        const newTitle = genSessionTitle(cleanText);
        await query('UPDATE sessions SET title=$1 WHERE id=$2', [newTitle, sid]);
        result.sessionTitle = newTitle;
      }
      await saveMessage({ session_id: sid, role: 'user', content: cleanText });
      await saveMessage({
        session_id: sid, role: 'assistant', content: result.response,
        thinking: JSON.stringify(result.thinking || []),
        places_json: result.places, itinerary_id: result.itinerary?.id || null,
      });
    }

    const pState = processes.get(processId);
    if (pState) {
      // Append final result thinking without replacing accumulated steps
      if (result.thinking?.length) {
        for (const t of result.thinking) {
          if (!pState.thinking.includes(t)) pState.thinking.push(t);
        }
      }
      pState.result = result;
      pState.done = true;
    }
    } catch (err) {
      const msg = (err as Error).message;
      console.error('Chat error:', msg);
      const state = processes.get(processId);
      if (state) {
        state.error = msg;
        state.done = true;
      }
    }
  })();
});

// GET /chat/status/:processId — poll for current state
router.get('/chat/status/:processId', (req: Request, res: Response) => {
  const pid = req.params.processId as string;
  const state = processes.get(pid);
  if (!state) {
    res.status(404).json({ error: 'Process not found', done: true });
    return;
  }
  // Return minimal state — strip result until done to save bandwidth
  if (state.done) {
    res.json({
      thinking: state.thinking,
      done: true,
      result: state.result || undefined,
      error: state.error,
    });
  } else {
    res.json({
      thinking: state.thinking,
      done: false,
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
