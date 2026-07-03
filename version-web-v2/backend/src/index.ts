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

const LLAMA_HOST = process.env.LLAMA_HOST || 'http://127.0.0.1:8081';
const app = express();
const PORT = parseInt(process.env.PORT || '4000');

app.use(cors({ origin: true }));
app.use(express.json());
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

app.listen(PORT, () => {
  console.log(`MVP Backend on http://localhost:${PORT}`);
  query(`CREATE TABLE IF NOT EXISTS usage_events (
    id SERIAL PRIMARY KEY, event TEXT NOT NULL, source TEXT, latency_ms INTEGER,
    mobility_tags JSONB, location TEXT, place_id TEXT, reason TEXT, ts TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  )`).catch(() => {});
});
