import express from 'express';
import cors from 'cors';
import { itineraryRouter } from './routes/itinerary';
import { placesRouter } from './routes/places';
import { profileRouter } from './routes/profile';

const app = express();
const PORT = process.env.PORT || 4000;
const START_TIME = Date.now();

app.use(cors());
app.use(express.json());

// ─── Pretty console banner ────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

function banner() {
  const cloud = process.env.VERTEX_AI_ENABLED === 'true';
  console.log(`\n${c.bold}${c.cyan}┌─────────────────────────────────────────────┐${c.reset}`);
  console.log(`${c.bold}${c.cyan}│  ♿  Inclusive Tourism — Backend v2          │${c.reset}`);
  console.log(`${c.bold}${c.cyan}└─────────────────────────────────────────────┘${c.reset}`);
  console.log(`  ${c.dim}Port     ${c.reset}${c.bold}${PORT}${c.reset}`);
  console.log(`  ${c.dim}Mode     ${c.reset}${cloud ? `${c.green}☁  Cloud (Vertex AI + ADK)${c.reset}` : `${c.yellow}⚡ Local (llama.cpp + SQLite)${c.reset}`}`);
  console.log(`  ${c.dim}Started  ${c.reset}${new Date().toLocaleTimeString()}`);
  console.log();
  console.log(`  ${c.dim}Routes:${c.reset}`);
  console.log(`  ${c.green}POST${c.reset}  /api/itinerary`);
  console.log(`  ${c.green}GET ${c.reset}  /api/places`);
  console.log(`  ${c.green}GET ${c.reset}  /api/profile`);
  console.log(`  ${c.green}POST${c.reset}  /api/profile`);
  console.log();
}

// ─── Request logger ──────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const status = res.statusCode;
    const color = status >= 500 ? c.red : status >= 400 ? c.yellow : c.green;
    const icon = status >= 400 ? '✗' : '✓';
    console.log(
      `  ${color}${icon}${c.reset} ${color}${status}${c.reset}` +
      ` ${c.dim}${req.method.padEnd(5)}${c.reset}` +
      ` ${req.path}` +
      ` ${c.dim}${ms}ms${c.reset}`
    );
  });
  next();
});

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/itinerary', itineraryRouter);
app.use('/api/places', placesRouter);
app.use('/api/profile', profileRouter);

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  const uptimeSec = Math.floor((Date.now() - START_TIME) / 1000);
  res.json({
    status: 'ok',
    uptime: `${uptimeSec}s`,
    mode: process.env.VERTEX_AI_ENABLED === 'true' ? 'cloud' : 'local',
    ts: new Date().toISOString(),
  });
});

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  banner();
});

// Uptime heartbeat every 30s
setInterval(() => {
  const uptimeSec = Math.floor((Date.now() - START_TIME) / 1000);
  const mem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
  console.log(`  ${c.dim}↻ uptime ${uptimeSec}s  mem ${mem}MB${c.reset}`);
}, 30_000);

export default app;
