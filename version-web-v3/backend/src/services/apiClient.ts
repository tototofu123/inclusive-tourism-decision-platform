import { GoogleGenAI } from '@google/genai';
import { fetchWithTimeout, LLAMA_HOST } from '../utils/http';
import { TOOLS } from './tools';
import { getSettings } from '../routes/settings';

export interface ApiClientConfig {
  provider: 'gemini' | 'vertex' | 'local';
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ApiChatResponse {
  content: string;
  toolCalls?: Array<{ id: string; name: string; args: any }>;
  reasoningContent?: string;
  finishReason: 'stop' | 'tool_calls' | 'length';
}

const LOCAL_BASE = LLAMA_HOST || 'http://127.0.0.1:8081';

let genAiClient: GoogleGenAI | null = null;

function getGenAi(useVertexAi = false): GoogleGenAI {
  if (genAiClient && !useVertexAi) return genAiClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && !useVertexAi) {
    genAiClient = new GoogleGenAI({ apiKey });
    return genAiClient;
  }
  return new GoogleGenAI({
    vertexai: true,
    project: process.env.GOOGLE_CLOUD_PROJECT || 'tourism-accessibility',
    location: process.env.LOCATION || 'us-central1',
  });
}

function toGenAiTools() {
  return TOOLS.map(t => ({
    functionDeclarations: [{
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters,
    }],
  }));
}

function toGenAiContents(messages: any[]): { contents: any[]; systemInstruction?: any } {
  const contents: any[] = [];
  let systemInstruction: any = undefined;

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemInstruction = msg.content;
      continue;
    }

    if (msg.role === 'tool') {
      let parsed: any = {};
      try { parsed = JSON.parse(msg.content); } catch { parsed = { response: msg.content }; }
      contents.push({
        role: 'user',
        parts: [{
          functionResponse: {
            name: msg.name || 'unknown',
            response: { response: parsed },
          },
        }],
      });
      continue;
    }

    const role = msg.role === 'assistant' ? 'model' : 'user';
    const parts: any[] = [];

    if (msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        let args: any = {};
        try { args = JSON.parse(tc.function.arguments); } catch { args = {}; }
        parts.push({ functionCall: { name: tc.function.name, args } });
      }
    }

    if (msg.content && typeof msg.content === 'string') {
      parts.push({ text: msg.content });
    }

    if (parts.length > 0) {
      contents.push({ role, parts });
    }
  }

  return { contents, systemInstruction };
}

function parseGenAiResult(result: any): ApiChatResponse {
  const candidate = result.candidates?.[0];
  if (!candidate) return { content: '', finishReason: 'stop' };

  const parts = candidate.content?.parts || [];
  let content = '';
  const toolCalls: Array<{ id: string; name: string; args: any }> = [];

  for (const part of parts) {
    if (part.text) content += part.text;
    if (part.functionCall) {
      const fc = part.functionCall as any;
      toolCalls.push({
        id: `fc_${fc.name}_${Date.now()}`,
        name: fc.name,
        args: typeof fc.args === 'object' ? fc.args : {},
      });
    }
  }

  return {
    content: content.trim(),
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    finishReason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
  };
}

function parseLocalResponse(data: any): ApiChatResponse {
  const choice = data.choices?.[0];
  const msg = choice?.message || {};
  const content = (msg.content || '').trim();
  const finishReason = (choice?.finish_reason || 'stop') as 'stop' | 'tool_calls' | 'length';
  const reasoningContent = msg.reasoning_content || '';

  const toolCalls = msg.tool_calls?.map((tc: any) => ({
    id: tc.id,
    name: tc.function.name,
    args: (() => { try { return JSON.parse(tc.function.arguments); } catch { return {}; } })(),
  })) || [];

  return { content, toolCalls, reasoningContent, finishReason };
}

export async function chatCompletion(
  messages: any[],
  tools?: any[],
  overrides?: Partial<ApiClientConfig>,
): Promise<ApiChatResponse> {
  const cfg = { provider: 'gemini' as const, temperature: 0.1, maxTokens: 4096, ...overrides };
  const settings = getSettings();
  const effectiveProvider = settings.provider;

  // Custom OpenAI-compatible endpoint
  if (effectiveProvider === 'custom') {
    if (!settings.customApiUrl) {
      throw new Error('Custom API URL not configured in settings');
    }
    const body: any = {
      messages,
      model: settings.model,
      temperature: cfg.temperature ?? 0.1,
      max_tokens: cfg.maxTokens ?? 4096,
    };
    const customTools = tools?.length
      ? tools
      : TOOLS.map(t => ({ type: 'function', function: { name: t.function.name, description: t.function.description, parameters: t.function.parameters } }));
    if (customTools?.length) body.tools = customTools;
    body.tool_choice = 'auto';

    const baseUrl = settings.customApiUrl.replace(/\/+$/, '');
    const res = await fetchWithTimeout(
      `${baseUrl}/v1/chat/completions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.customApiKey}` },
        body: JSON.stringify(body),
      },
      (cfg.maxTokens ?? 0) > 2048 ? 120000 : 60000,
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Custom API returned ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = await res.json() as any;
    return parseLocalResponse(data);
  }

  // Primary: Gemini API (AI Studio key)
  if (effectiveProvider === 'gemini' && process.env.GEMINI_API_KEY) {
    try {
      return await chatGemini(messages, { ...cfg, model: settings.model }, false);
    } catch (err: any) {
      console.warn('Gemini API failed, trying Vertex AI:', err.message?.slice(0, 80));
    }
  }

  // Vertex AI (ADC service account)
  if (effectiveProvider === 'gemini' || effectiveProvider === 'vertex') {
    try {
      return await chatGemini(messages, { ...cfg, model: settings.model }, true);
    } catch (err: any) {
      console.warn('Vertex AI failed, falling back to local:', err.message?.slice(0, 80));
    }
  }

  // Fallback / local llama.cpp (cap tokens: smaller models can't produce 4K useful output)
  const baseUrl = cfg.baseUrl || LOCAL_BASE;
  const body: any = {
    messages,
    temperature: cfg.temperature ?? 0.1,
    max_tokens: cfg.maxTokens ?? 4096,
  };

  const localTools = tools !== undefined
    ? (tools.length ? tools : undefined)
    : TOOLS.map(t => ({ type: 'function', function: { name: t.function.name, description: t.function.description, parameters: t.function.parameters } }));
  
  if (localTools?.length) {
    body.tools = localTools;
    body.tool_choice = 'auto';
  } else {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetchWithTimeout(
    `${baseUrl}/v1/chat/completions`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    (cfg.maxTokens ?? 0) > 2048 ? 120000 : 60000,
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Local LLM returned ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json() as any;
  return parseLocalResponse(data);
}

async function chatGemini(
  messages: any[],
  cfg: ApiClientConfig,
  useVertexAi = false,
): Promise<ApiChatResponse> {
  const { contents, systemInstruction } = toGenAiContents(messages);
  const config = {
    systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
    temperature: cfg.temperature ?? 0.1,
    maxOutputTokens: cfg.maxTokens ?? 4096,
    tools: toGenAiTools(),
  };

  const client = getGenAi(useVertexAi);

  // Use configured model from settings, then env var, then defaults
  const settings = getSettings();
  let modelsToTry: string[];
  if (cfg.model) {
    modelsToTry = [cfg.model];
  } else if (settings.model) {
    modelsToTry = [settings.model];
  } else if (process.env.LLM_MODEL) {
    modelsToTry = [process.env.LLM_MODEL];
  } else {
    modelsToTry = ['gemini-2.0-flash-001', 'gemini-2.0-flash-lite', 'gemini-1.5-flash-002'];
  }
  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    try {
      const result = await client.models.generateContent({ model, contents, config });
      return parseGenAiResult(result);
    } catch (err: any) {
      lastError = err;
      const msg = err.message || '';
      if (msg.includes('429') || msg.includes('quota')) continue;
      if (msg.includes('404')) continue;
      throw err;
    }
  }

  throw lastError || new Error('All Gemini models exhausted');
}