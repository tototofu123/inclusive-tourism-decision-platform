import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { execSync, spawn } from 'child_process';

export interface UserSettings {
  provider: 'gemini' | 'vertex' | 'local' | 'custom';
  model: string;
  customApiUrl: string;
  customApiKey: string;
}

let settings: UserSettings = {
  provider: (process.env.LLM_PROVIDER as UserSettings['provider']) || 'gemini',
  model: process.env.LLM_MODEL || 'gemini-2.0-flash-001',
  customApiUrl: process.env.CUSTOM_API_URL || '',
  customApiKey: process.env.CUSTOM_API_KEY || '',
};

const KNOWN_MODELS: Array<{ id: string; provider: string }> = [
  { id: 'gemini-2.0-flash-001', provider: 'gemini' },
  { id: 'gemini-2.0-flash-lite', provider: 'gemini' },
  { id: 'gemini-1.5-flash-002', provider: 'gemini' },
  { id: 'gemini-1.5-pro-002', provider: 'gemini' },
  { id: 'gemini-2.5-pro-exp-03-25', provider: 'gemini' },
  { id: 'claude-sonnet-4-20250514', provider: 'custom' },
  { id: 'claude-haiku-3-5-20241022', provider: 'custom' },
  { id: 'gpt-4o', provider: 'custom' },
  { id: 'gpt-4o-mini', provider: 'custom' },
];

const LLAMA_DIR = process.env.LLAMA_DIR || path.join(process.env.USERPROFILE || 'C:\\Users\\totot', 'llama-b9247-bin-win-cuda-12.4-x64');
const LLAMA_EXE = process.env.LLAMA_EXE || path.join(LLAMA_DIR, 'llama-server.exe');

const router = Router();

router.get('/settings', async (_req: Request, res: Response) => {
  const safe = { ...settings };
  if (safe.customApiKey) safe.customApiKey = '••••••••';
  res.json(safe);
});

router.put('/settings', async (req: Request, res: Response) => {
  const body = req.body as Partial<UserSettings>;
  if (body.provider) settings.provider = body.provider;
  if (body.model !== undefined) settings.model = body.model;
  if (body.customApiUrl !== undefined) settings.customApiUrl = body.customApiUrl;
  if (body.customApiKey !== undefined && body.customApiKey !== '••••••••') settings.customApiKey = body.customApiKey;
  const safe = { ...settings };
  if (safe.customApiKey) safe.customApiKey = '••••••••';
  res.json(safe);
});

async function scanLocalGgufs(): Promise<Array<{ id: string; provider: string }>> {
  try {
    const entries = await fs.readdir(LLAMA_DIR);
    return entries.filter(f => f.endsWith('.gguf')).map(m => ({ id: m, provider: 'local' as const }));
  } catch {
    return [];
  }
}

async function getRunningModelId(): Promise<string | null> {
  try {
    const out = execSync(
      `wmic process where "name='llama-server.exe'" get commandline 2>nul`,
      { encoding: 'utf8', timeout: 3000 }
    );
    const match = out.match(/-m\s+"?([^"\s]+\.gguf)"?/i);
    return match ? path.basename(match[1]) : null;
  } catch {
    return null;
  }
}

router.get('/models', async (_req: Request, res: Response) => {
  const localModels = await scanLocalGgufs();
  const runningModel = await getRunningModelId();

  const allModels = [...KNOWN_MODELS, ...localModels];

  res.json({
    models: allModels,
    current: settings.model,
    provider: settings.provider,
    runningLocalModel: runningModel,
  });
});

router.post('/models/switch', async (req: Request, res: Response) => {
  const { model, provider } = req.body as { model: string; provider?: string };
  if (!model) {
    res.status(400).json({ error: 'Model name required' });
    return;
  }

  settings.model = model;

  // Determine provider: prefer explicit, then infer from model ID
  if (provider) {
    settings.provider = provider;
  } else if (model.endsWith('.gguf')) {
    settings.provider = 'local';
  } else if (KNOWN_MODELS.find(m => m.id === model)?.provider === 'custom') {
    settings.provider = 'custom';
  } else {
    settings.provider = 'gemini';
  }

  // If switching to a local gguf that isn't the current running model, restart llama-server
  if (model.endsWith('.gguf')) {
    const runningModel = await getRunningModelId();
    if (runningModel !== model) {
      const modelPath = path.join(LLAMA_DIR, model);
      try {
        execSync('taskkill /f /im llama-server.exe 2>nul', { timeout: 3000 });
      } catch { /* no process */ }
      await new Promise(r => setTimeout(r, 2000));
      const proc = spawn(LLAMA_EXE, ['-m', modelPath, '--port', '8081', '-ngl', '999', '-c', '8192', '--host', '0.0.0.0'], {
        detached: true, stdio: 'ignore',
      });
      proc.unref();
    }
  }

  const safe = { ...settings };
  if (safe.customApiKey) safe.customApiKey = '••••••••';
  res.json({ status: 'switching', model, provider: settings.provider });
});

export function getSettings(): UserSettings {
  return settings;
}

export function updateSettings(partial: Partial<UserSettings>): UserSettings {
  settings = { ...settings, ...partial };
  return settings;
}

export default router;
