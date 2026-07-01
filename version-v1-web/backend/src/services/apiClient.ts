import { fetchWithTimeout, LLAMA_HOST } from '../utils/http';

export interface ApiClientConfig {
  provider: 'local' | 'openai' | 'anthropic' | 'google';
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

export function setApiConfig(config: Partial<ApiClientConfig>): void {
  activeConfig = { ...activeConfig, ...config };
}

export function getApiConfig(): ApiClientConfig {
  return { ...activeConfig };
}

export async function chatCompletion(
  messages: any[],
  tools?: ApiToolDef[],
  overrides?: Partial<ApiClientConfig>,
): Promise<ApiChatResponse> {
  const cfg = { ...activeConfig, ...overrides };
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
  return ['local', 'openai', 'anthropic', 'google'];
}
