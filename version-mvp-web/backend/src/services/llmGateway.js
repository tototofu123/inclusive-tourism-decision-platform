/**
 * LLM Gateway
 * Wraps the local llama.cpp server (OpenAI-compatible /v1/chat/completions).
 * Swap LLAMA_BASE_URL → Vertex AI / Gemini endpoint in web-v2 without
 * changing any other file.
 */
const { default: fetch } = require('node-fetch');

const BASE_URL = () => process.env.LLAMA_BASE_URL || 'http://localhost:8080';
const MODEL    = () => process.env.LLAMA_MODEL    || 'local-model';

/**
 * Send a chat request to llama.cpp.
 * @param {{ system: string, user: string, maxTokens: number, temperature: number }}
 * @returns {Promise<string>} - raw assistant text
 */
async function chat({ system, user, maxTokens = 512, temperature = 0.5 }) {
  const url = `${BASE_URL()}/v1/chat/completions`;

  const body = {
    model: MODEL(),
    messages: [
      { role: 'system', content: system },
      { role: 'user',   content: user   },
    ],
    max_tokens: maxTokens,
    temperature,
    stream: false,
  };

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000), // 30s timeout
    });
  } catch (err) {
    throw new Error(`LLM gateway unreachable: ${err.message}. Is llama-server running on ${BASE_URL()}?`);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM gateway error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('LLM returned empty content');
  return content.trim();
}

module.exports = { chat };
