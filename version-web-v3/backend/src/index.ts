process.on('uncaughtException', e => console.error('UNCAUGHT', e));
process.on('unhandledRejection', (e: any) => console.error('UNHANDLED', e));

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import itineraryRouter from './routes/itinerary';
import chatRouter from './routes/chat';
import sessionsRouter from './routes/sessions';
import placesRouter from './routes/places';
import preferencesRouter from './routes/preferences';
import settingsRouter from './routes/settings';
import { query } from './db/client';
import { rateLimit } from './utils/rateLimiter';

const LLAMA_HOST = process.env.LLAMA_HOST || 'http://127.0.0.1:8081';
const app = express();
const PORT = parseInt(process.env.PORT || '4000');

app.use(cors({ origin: true }));
app.use(express.json());

app.use('/chat', rateLimit(60_000, 20, 200));
app.use('/places', rateLimit(10_000, 10, 100));
app.use('/itineraries', rateLimit(30_000, 15, 100));
app.use('/preferences', rateLimit(10_000, 10, 100));
app.use('/sessions', rateLimit(10_000, 10, 100));

app.use(itineraryRouter);
app.use(chatRouter);
app.use(sessionsRouter);
app.use(placesRouter);
app.use(preferencesRouter);
app.use(settingsRouter);

app.get('/health', async (_req, res) => {
  let localOk = false;
  let llamaData: any = null;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 3000);
    const llmRes = await fetch(`${LLAMA_HOST}/health`, { signal: controller.signal });
    clearTimeout(t);
    localOk = llmRes.ok;
    if (localOk) try { llamaData = await llmRes.json(); } catch {}
  } catch {}
  res.json({
    status: 'ok',
    local_llm: localOk,
    local_status: llamaData,
    gemini: !!process.env.GEMINI_API_KEY,
  });
});

app.listen(PORT, () => {
  console.log(`Inclusive Tourism Platform V3 — http://localhost:${PORT}`);
  console.log(`  LLM: Gemini (AI Studio) → local llama.cpp fallback`);
  query(`CREATE TABLE IF NOT EXISTS usage_events (
    id SERIAL PRIMARY KEY, event TEXT NOT NULL, source TEXT, latency_ms INTEGER,
    mobility_tags JSONB, location TEXT, place_id TEXT, reason TEXT, ts TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  )`).catch(() => {});
});
