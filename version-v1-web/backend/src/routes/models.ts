import { Router, Request, Response } from 'express';
import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { setApiConfig, listProviders } from '../services/apiClient';

const router = Router();

const MODELS_DIR = process.env.LLAMA_MODELS_DIR || path.join(process.env.USERPROFILE || 'C:\\Users\\totot', '.llama', 'models');
const LLAMA_EXE = process.env.LLAMA_EXE
  || path.join(process.env.USERPROFILE || 'C:\\Users\\totot', 'llama-b9247-bin-win-cuda-12.4-x64', 'llama-server.exe');

let currentModel = '';

// Scan for .gguf files in the models directory
function scanModels(): string[] {
  try {
    if (!fs.existsSync(MODELS_DIR)) return [];
    return fs.readdirSync(MODELS_DIR)
      .filter(f => f.endsWith('.gguf'))
      .sort();
  } catch {
    return [];
  }
}

function getRunningModel(): string {
  try {
    const out = execSync(
      `wmic process where "name='llama-server.exe'" get commandline 2>nul`,
      { encoding: 'utf8', timeout: 5000 }
    );
    const match = out.match(/-m\s+"?([^"\s]+\.gguf)"?/i);
    if (match) return path.basename(match[1]);
  } catch { /* ignore */ }
  return currentModel || 'unknown';
}

// GET /models — list available .gguf files and providers
router.get('/models', (_req: Request, res: Response) => {
  const models = scanModels();
  const current = getRunningModel();
  res.json({ models, current, providers: listProviders() });
});

// POST /models/switch — switch model or API provider
router.post('/models/switch', async (req: Request, res: Response) => {
  const { model, provider, apiKey } = req.body;

  // If switching to a non-local provider, just update apiClient config — no server restart needed
  if (provider && provider !== 'local') {
    setApiConfig({ provider, apiKey, model });
    currentModel = model || provider;
    res.json({ status: 'switched', provider, model: model || provider });
    return;
  }

  // Local provider — restart llama-server with new model
  if (!model) {
    res.status(400).json({ error: 'Model filename required for local provider' });
    return;
  }

  setApiConfig({ provider: 'local', model });

  const modelPath = path.join(MODELS_DIR, model);
  if (!fs.existsSync(modelPath)) {
    res.status(400).json({ error: `Model not found: ${model}` });
    return;
  }

  try {
    try {
      execSync('taskkill /f /im llama-server.exe 2>nul', { timeout: 3000 });
    } catch { /* no process to kill */ }

    await new Promise(r => setTimeout(r, 2000));

    const proc = spawn(LLAMA_EXE, ['-m', modelPath, '--port', '8081', '-ngl', '99', '-c', '8192'], {
      detached: true,
      stdio: 'ignore',
    });
    proc.unref();

    currentModel = model;
    res.json({ status: 'switching', model });
  } catch (err) {
    console.error('Switch model error:', err);
    res.status(500).json({ error: 'Failed to switch model' });
  }
});

export default router;
