import { LLMResponse } from '../types';

const LLAMA_HOST = process.env.LLAMA_HOST || 'http://127.0.0.1:8081';

const PROMPT = `You are a Kowloon (Hong Kong) trip planner for accessible tourism. Output only valid JSON, no thinking, no explanation.

Rules:
- Region is always Kowloon, Hong Kong
- Categories: museum, cafe, park, temple, shopping_mall, viewpoint, restaurant, market, art_gallery, historic_site
- Each stop: 20-120 min duration
- Detect days from user request. If unspecified, use 1 day.
- DAYS = total days in the trip
- Assign each stop to a day (1-indexed) — max 4 stops per day, spread stops across all days evenly
- If user mentions focus areas (e.g. "culture", "shopping", "nature"), prioritize matching categories

Output format:
{"stops":[{"label":"Place Name","category":"museum","approx_duration_minutes":60,"day":1,"notes":"accessibility note"}],"total_duration_minutes":300,"days":1,"focus_areas":["culture","history"]}`;

function fetchWithTimeout(url: string, opts: RequestInit, ms: number): Promise<Response> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return fetch(url, { ...opts, signal: c.signal }).finally(() => clearTimeout(t));
}

export async function planTrip(userText: string, context?: string): Promise<LLMResponse> {
  console.log('planTrip: calling LLM...');
  let prompt = `${PROMPT}\n\nPlan a trip for: ${userText}\n\nJSON:`;
  if (context) prompt = `${PROMPT}\n\nExisting trip context:\n${context}\n\nModify or replace based on the new request: ${userText}\n\nJSON:`;
  try {
    const res = await fetchWithTimeout(`${LLAMA_HOST}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'You respond only with valid JSON. No thinking. No markdown. No explanation.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 2048,
      }),
    }, 120000);
    if (!res.ok) throw new Error(`LLM returned ${res.status}`);
    const data = await res.json() as any;
    const content = data.choices?.[0]?.message?.content || '';
    console.log('planTrip: LLM response received, length:', content.length);
    return parseLLMResponse(content);
  } catch (err) {
    console.error('LLM failed:', (err as Error).message);
    throw new Error('LLM unavailable — start llama-server or try again later');
  }
}

function parseLLMResponse(content: string): LLMResponse {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in LLM response');
  const parsed = JSON.parse(jsonMatch[0]);
  if (!parsed.stops?.length) throw new Error('LLM returned no stops');
  return {
    stops: parsed.stops.map((s: any) => ({
      label: s.label || s.category || 'Stop', category: s.category || 'attraction',
      approx_duration_minutes: s.approx_duration_minutes || 60, notes: s.notes || '',
      day: s.day || 1,
    })),
    total_duration_minutes: parsed.total_duration_minutes || 180,
    days: parsed.days || 1,
    focus_areas: parsed.focus_areas || [],
    ordering_hint: parsed.ordering_hint || '',
  };
}
