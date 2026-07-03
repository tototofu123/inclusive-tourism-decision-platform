process.on('uncaughtException', e => console.error('UNCAUGHT', e));
process.on('unhandledRejection', (e: any) => console.error('UNHANDLED', e));

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import planRouter from './routes/plan';
import itineraryRouter from './routes/itinerary';
import chatRouter from './routes/chat';
import sessionsRouter from './routes/sessions';
import placesRouter from './routes/places';
import modelsRouter from './routes/models';
import preferencesRouter from './routes/preferences';
import gatewayRouter from './routes/gateway';
import { query } from './db/client';
import { setApiConfig } from './services/apiClient';
import { rateLimit } from './utils/rateLimiter';

const LLAMA_HOST = process.env.LLAMA_HOST || 'http://127.0.0.1:8081';
const app = express();
const PORT = parseInt(process.env.PORT || '4000');

app.use(cors({ origin: true }));
app.use(express.json());

// Rate limiting — applied per-IP with global cap
app.use('/chat', rateLimit(60_000, 20, 200));          // 20/ip/min, 200 global/min
app.use('/api/chat', rateLimit(60_000, 20, 200));
app.use('/places', rateLimit(10_000, 10, 100));         // 10/ip/10s, 100 global/10s
app.use('/api/places', rateLimit(10_000, 10, 100));
app.use('/itineraries', rateLimit(30_000, 15, 100));   // 15/ip/30s, 100 global/30s
app.use('/api/itineraries', rateLimit(30_000, 15, 100));
app.use('/preferences', rateLimit(10_000, 10, 100));
app.use('/api/preferences', rateLimit(10_000, 10, 100));
app.use('/sessions', rateLimit(10_000, 10, 100));
app.use('/api/sessions', rateLimit(10_000, 10, 100));
app.use('/plan', rateLimit(60_000, 10, 50));
app.use('/api/plan', rateLimit(60_000, 10, 50));
app.use('/gateway', rateLimit(60_000, 10, 50));
app.use('/api/gateway', rateLimit(60_000, 10, 50));
app.use('/models', rateLimit(10_000, 20, 200));

app.use(planRouter);
app.use(itineraryRouter);
app.use(chatRouter);
app.use(sessionsRouter);
app.use(placesRouter);
app.use(modelsRouter);
app.use(preferencesRouter);
app.use(gatewayRouter);
app.get('/health', async (_req, res) => {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 3000);
    const llmRes = await fetch(`${LLAMA_HOST}/health`, { signal: controller.signal });
    clearTimeout(t);
    const llmOk = llmRes.ok;
    let llmData: any = null;
    if (llmOk) try { llmData = await llmRes.json(); } catch {}
    res.json({ status: 'ok', llm: llmOk, llm_status: llmData });
  } catch {
    res.json({ status: 'ok', llm: false, llm_error: 'LLM not reachable' });
  }
});

if (process.env.VERTEX_AI_ENABLED === 'true') {
  setApiConfig({ provider: 'vertex', model: process.env.VERTEX_MODEL || 'gemini-2.0-flash-001' });
  console.log('  Using Vertex AI (Gemini)');
}

app.listen(PORT, () => {
  console.log(`MVP Backend on http://localhost:${PORT}`);
  query(`CREATE TABLE IF NOT EXISTS usage_events (
    id SERIAL PRIMARY KEY, event TEXT NOT NULL, source TEXT, latency_ms INTEGER,
    mobility_tags JSONB, location TEXT, place_id TEXT, reason TEXT, ts TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  )`).catch(() => {});
});
