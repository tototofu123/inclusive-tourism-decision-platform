import { Router, Request, Response } from 'express';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

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

const router = Router();

router.get('/settings', (_req: Request, res: Response) => {
  const safe = { ...settings };
  if (safe.customApiKey) safe.customApiKey = '••••••••';
  res.json(safe);
});

router.put('/settings', (req: Request, res: Response) => {
  const body = req.body as Partial<UserSettings>;
  if (body.provider) settings.provider = body.provider;
  if (body.model !== undefined) settings.model = body.model;
  if (body.customApiUrl !== undefined) settings.customApiUrl = body.customApiUrl;
  if (body.customApiKey !== undefined && body.customApiKey !== '••••••••') settings.customApiKey = body.customApiKey;
  const safe = { ...settings };
  if (safe.customApiKey) safe.customApiKey = '••••••••';
  res.json(safe);
});

router.get('/models', (_req: Request, res: Response) => {
  const LLAMA_HOST = process.env.LLAMA_HOST || 'http://127.0.0.1:8081';
  fetch(`${LLAMA_HOST}/v1/models`)
    .then(r => r.json())
    .then((data: any) => {
      const models = (data.data || []).map((m: any) => m.id);
      res.json({ models, current: settings.model });
    })
    .catch(() => {
      const modelsDir = process.env.LLAMA_MODELS_DIR || '';
      if (modelsDir && fs.existsSync(modelsDir)) {
        const models = fs.readdirSync(modelsDir).filter(f => f.endsWith('.gguf'));
        res.json({ models, current: settings.model });
      } else {
        res.json({ models: [settings.model], current: settings.model });
      }
    });
});

router.post('/models/switch', (req: Request, res: Response) => {
  const { model } = req.body as { model: string };
  if (!model) {
    res.status(400).json({ error: 'Model name required' });
    return;
  }
  settings.model = model;
  settings.provider = model.endsWith('.gguf') ? 'local' : 'gemini';
  const LLAMA_HOST = process.env.LLAMA_HOST || 'http://127.0.0.1:8081';
  fetch(`${LLAMA_HOST}/v1/models/switch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model }),
  }).catch(() => {});
  res.json({ status: 'switching', model });
});

export function getSettings(): UserSettings {
  return settings;
}

export function updateSettings(partial: Partial<UserSettings>): UserSettings {
  settings = { ...settings, ...partial };
  return settings;
}

export default router;
