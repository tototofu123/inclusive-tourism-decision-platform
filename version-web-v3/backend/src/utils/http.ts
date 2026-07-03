export const LLAMA_HOST = process.env.LLAMA_HOST || 'http://127.0.0.1:8081';

export function fetchWithTimeout(url: string, opts: RequestInit, ms: number): Promise<Response> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return fetch(url, { ...opts, signal: c.signal }).finally(() => clearTimeout(t));
}
