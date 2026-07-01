const express = require('express');
const router = express.Router();
const { getPool } = require('../database/pool');

router.get('/', async (req, res) => {
  const status = { server: 'ok', db: 'unknown', llm: 'unknown', ts: new Date().toISOString() };

  // Check DB
  try {
    await getPool().query('SELECT 1');
    status.db = 'ok';
  } catch (e) {
    status.db = 'error: ' + e.message;
  }

  // Check llama.cpp
  try {
    const { default: fetch } = require('node-fetch');
    const r = await fetch(`${process.env.LLAMA_BASE_URL}/health`, { signal: AbortSignal.timeout(3000) });
    status.llm = r.ok ? 'ok' : 'error:' + r.status;
  } catch (e) {
    status.llm = 'offline (start llama-server)';
  }

  const httpStatus = status.db === 'ok' ? 200 : 503;
  res.status(httpStatus).json(status);
});

module.exports = router;
