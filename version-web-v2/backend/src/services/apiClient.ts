import { GoogleGenAI } from '@google/genai';
import { fetchWithTimeout, LLAMA_HOST } from '../utils/http';
import { TOOLS } from './tools';

export interface ApiClientConfig {
  provider: 'local' | 'openai' | 'anthropic' | 'google' | 'vertex';
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ApiToolDef {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

export interface ApiChatResponse {
  content: string;
  toolCalls?: Array<{ id: string; name: string; args: any }>;
  reasoningContent?: string;
  finishReason: 'stop' | 'tool_calls' | 'length';
}

const DEFAULT_CONFIG: ApiClientConfig = {
  provider: 'local',
  baseUrl: LLAMA_HOST,
  temperature: 0.1,
  maxTokens: 4096,
};

let activeConfig: ApiClientConfig = { ...DEFAULT_CONFIG };
let genAiClient: GoogleGenAI | null = null;

function getGenAi(): GoogleGenAI {
  if (!genAiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set — get one free at https://aistudio.google.com/apikey');
    genAiClient = new GoogleGenAI({ apiKey });
  }
  return genAiClient;
}

export function setApiConfig(config: Partial<ApiClientConfig>): void {
  activeConfig = { ...activeConfig, ...config };
}

export function getApiConfig(): ApiClientConfig {
  return { ...activeConfig };
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
            name: msg.tool_call_id?.replace(/^call_/, '') || 'unknown',
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

export async function chatCompletion(
  messages: any[],
  tools?: ApiToolDef[],
  overrides?: Partial<ApiClientConfig>,
): Promise<ApiChatResponse> {
  const cfg = { ...activeConfig, ...overrides };

  // Vertex AI / Gemini path
  if (cfg.provider === 'vertex' || process.env.VERTEX_AI_ENABLED === 'true') {
    return chatCompletionGenAi(messages, cfg);
  }

  const baseUrl = cfg.baseUrl || LLAMA_HOST;

  const body: any = {
    messages,
    temperature: cfg.temperature ?? 0.1,
    max_tokens: cfg.maxTokens ?? 4096,
  };

  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  let url: string;
  let headers: Record<string, string> = { 'Content-Type': 'application/json' };

  switch (cfg.provider) {
    case 'local': {
      url = `${baseUrl}/v1/chat/completions`;
      break;
    }
    case 'openai': {
      url = 'https://api.openai.com/v1/chat/completions';
      headers['Authorization'] = `Bearer ${cfg.apiKey || ''}`;
      body.model = cfg.model || 'gpt-4o';
      break;
    }
    case 'anthropic': {
      url = 'https://api.anthropic.com/v1/messages';
      headers['x-api-key'] = cfg.apiKey || '';
      headers['anthropic-version'] = '2023-06-01';
      body.model = cfg.model || 'claude-sonnet-4-20250514';
      body.max_tokens = cfg.maxTokens ?? 4096;
      break;
    }
    case 'google': {
      const model = cfg.model || 'gemini-2.5-flash';
      url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cfg.apiKey || ''}`;
      break;
    }
    default:
      throw new Error(`Unknown provider: ${cfg.provider}`);
  }

  const timeout = overrides?.maxTokens && overrides.maxTokens > 2048 ? 120000 : 60000;
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  }, timeout);

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${cfg.provider} returned ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json() as any;
  return parseResponse(data, cfg.provider);
}

async function chatCompletionGenAi(
  messages: any[],
  cfg: ApiClientConfig,
): Promise<ApiChatResponse> {
  const client = getGenAi();
  const modelName = cfg.model || process.env.VERTEX_MODEL || 'gemini-2.0-flash-001';
  const { contents, systemInstruction } = toGenAiContents(messages);

  try {
    const result = await client.models.generateContent({
      model: modelName,
      contents,
      config: {
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
        temperature: cfg.temperature ?? 0.1,
        maxOutputTokens: cfg.maxTokens ?? 4096,
        tools: toGenAiTools(),
      },
    });

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
  } catch (err: any) {
    console.error('Gemini API error:', err.message);
    throw err;
  }
}

function parseResponse(data: any, provider: string): ApiChatResponse {
  if (provider === 'local' || provider === 'openai') {
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

  if (provider === 'anthropic') {
    const content = data.content?.map((c: any) => c.text).filter(Boolean).join('') || '';
    return { content, finishReason: 'stop' };
  }

  if (provider === 'google') {
    const content = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join('') || '';
    return { content, finishReason: 'stop' };
  }

  return { content: '', finishReason: 'stop' };
}

export function listProviders(): string[] {
  return ['local', 'openai', 'anthropic', 'google', 'vertex'];
}
