import { LLMResponse } from '../types';

const LLAMA_HOST = process.env.LLAMA_HOST || 'http://127.0.0.1:8081';

const PROMPT = `You are a Kowloon (Hong Kong) trip planner. Output only valid JSON, no thinking, no explanation.

Rules:
- Region is always Kowloon
- Categories: museum, cafe, park, temple, shopping_mall, viewpoint, restaurant, market, art_gallery, historic_site
- 3-6 stops, each 20-120 min

Example: {"stops":[{"label":"Name","category":"museum","approx_duration_minutes":60}],"total_duration_minutes":240,"ordering_hint":"hint"}`;

function fetchWithTimeout(url: string, opts: RequestInit, ms: number): Promise<Response> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return fetch(url, { ...opts, signal: c.signal }).finally(() => clearTimeout(t));
}

export async function planTrip(userText: string): Promise<LLMResponse> {
  console.log('planTrip: calling LLM...');
  try {
    const res = await fetchWithTimeout(`${LLAMA_HOST}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'You respond only with valid JSON. No thinking. No markdown. No explanation.' },
          { role: 'user', content: `${PROMPT}\n\nPlan a trip for: ${userText}\n\nJSON:` }
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
    console.error('LLM failed, using fallback:', (err as Error).message);
    return getFallbackPlan(userText);
  }
}

function parseLLMResponse(content: string): LLMResponse {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found');
  const parsed = JSON.parse(jsonMatch[0]);
  if (!parsed.stops?.length) throw new Error('Invalid itinerary structure');
  return {
    stops: parsed.stops.map((s: any) => ({
      label: s.label || s.category || 'Stop', category: s.category || 'attraction',
      approx_duration_minutes: s.approx_duration_minutes || 60, notes: s.notes || '',
    })),
    total_duration_minutes: parsed.total_duration_minutes || 180,
    ordering_hint: parsed.ordering_hint || '',
  };
}

export function getFallbackPlan(userText: string): LLMResponse {
  const t = userText.toLowerCase();
  const stops: LLMResponse['stops'] = [];
  if (t.includes('museum') || t.includes('history') || t.includes('culture'))
    stops.push({ label: 'Hong Kong Museum of History', category: 'museum', approx_duration_minutes: 90, notes: 'Tsim Sha Tsui East' });
  if (t.includes('cafe') || t.includes('food') || t.includes('eat') || t.includes('restaurant'))
    stops.push({ label: 'TST Cafe', category: 'cafe', approx_duration_minutes: 45, notes: 'Near the waterfront' });
  if (t.includes('park') || t.includes('nature') || t.includes('garden'))
    stops.push({ label: 'Kowloon Park', category: 'park', approx_duration_minutes: 60, notes: 'Aviary and sculpture walk' });
  if (t.includes('shopping') || t.includes('mall') || t.includes('market'))
    stops.push({ label: 'Harbour City', category: 'shopping_mall', approx_duration_minutes: 90, notes: 'Canton Road' });
  if (t.includes('temple'))
    stops.push({ label: 'Wong Tai Sin Temple', category: 'temple', approx_duration_minutes: 60, notes: 'Famous Taoist temple' });
  if (t.includes('view') || t.includes('harbour'))
    stops.push({ label: 'TST Promenade', category: 'viewpoint', approx_duration_minutes: 30, notes: 'Harbour view' });
  if (t.includes('art') || t.includes('gallery'))
    stops.push({ label: 'HK Cultural Centre', category: 'art_gallery', approx_duration_minutes: 60, notes: 'Exhibitions' });
  if (stops.length === 0)
    stops.push(
      { label: 'Kowloon Park', category: 'park', approx_duration_minutes: 60, notes: 'Green space' },
      { label: 'HK Museum of History', category: 'museum', approx_duration_minutes: 90, notes: 'TST East' },
      { label: 'TST Promenade', category: 'viewpoint', approx_duration_minutes: 30, notes: 'Evening view' }
    );
  return { stops, total_duration_minutes: stops.reduce((s, x) => s + x.approx_duration_minutes, 0), ordering_hint: 'Start from TST MTR' };
}
