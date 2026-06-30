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

const ALL_STOPS: LLMResponse['stops'] = [
  { label: 'Hong Kong Museum of History', category: 'museum', approx_duration_minutes: 90, notes: 'Tsim Sha Tsui East — full wheelchair access, free entry' },
  { label: 'Kowloon Park', category: 'park', approx_duration_minutes: 60, notes: 'Aviary, sculpture walk, accessible paths' },
  { label: 'TST Promenade', category: 'viewpoint', approx_duration_minutes: 40, notes: 'Harbour view, photo spots, benches' },
  { label: 'Hong Kong Space Museum', category: 'museum', approx_duration_minutes: 75, notes: 'Planetarium, wheelchair spaces' },
  { label: 'Harbour City', category: 'shopping_mall', approx_duration_minutes: 90, notes: 'Canton Road, step-free, accessible toilets' },
  { label: 'Wong Tai Sin Temple', category: 'temple', approx_duration_minutes: 60, notes: 'Famous Taoist temple, ramp access' },
  { label: 'Hong Kong Cultural Centre', category: 'art_gallery', approx_duration_minutes: 60, notes: 'Exhibitions, concerts, waterfront location' },
  { label: 'TST Cafe', category: 'cafe', approx_duration_minutes: 45, notes: 'Near waterfront, outdoor seating' },
  { label: 'Temple Street Night Market', category: 'market', approx_duration_minutes: 60, notes: 'Evening market, flat road surface' },
  { label: 'Chi Lin Nunnery', category: 'temple', approx_duration_minutes: 60, notes: 'Tang-style architecture, accessible grounds' },
  { label: 'Nan Lian Garden', category: 'park', approx_duration_minutes: 50, notes: 'Classical Chinese garden, flat paved paths' },
  { label: 'M+ Museum', category: 'museum', approx_duration_minutes: 120, notes: 'West Kowloon, modern art, fully accessible' },
  { label: 'Sky100 Observation Deck', category: 'viewpoint', approx_duration_minutes: 60, notes: '360 views from ICC, wheelchair accessible' },
  { label: 'Elements Mall', category: 'shopping_mall', approx_duration_minutes: 75, notes: 'Kowloon Station, luxury shopping, accessible' },
  { label: 'Jade Market', category: 'market', approx_duration_minutes: 45, notes: 'Yau Ma Tei, souvenir shopping' },
  { label: 'Kowloon Walled City Park', category: 'park', approx_duration_minutes: 60, notes: 'Historic site, gardens, pavilions' },
  { label: 'Hong Kong Museum of Art', category: 'art_gallery', approx_duration_minutes: 90, notes: 'TST, Chinese art, accessible' },
  { label: 'Avenue of Stars', category: 'viewpoint', approx_duration_minutes: 40, notes: 'TST waterfront, handprints, harbour view' },
];

export function getFallbackPlan(userText: string): LLMResponse {
  const t = userText.toLowerCase();

  const dayMatch = t.match(/(\d+)\s*day|\b(\w+)\s*day/);
  let days = 1;
  if (dayMatch) {
    const num = parseInt(dayMatch[1] || dayMatch[2]);
    if (!isNaN(num)) days = Math.min(Math.max(num, 1), 5);
    else if (dayMatch[0].includes('three') || dayMatch[0].includes('3')) days = 3;
  }
  if (t.includes('multi') || t.includes('week')) days = 5;
  if (t.includes('few days') || t.includes('couple')) days = 2;

  const stopsPerDay = 3;
  const totalStops = days * stopsPerDay;

  const picked: LLMResponse['stops'] = [];
  const used = new Set<number>();

  const priority: Array<{ kw: string; idx: number }> = [
    { kw: 'museum', idx: 0 }, { kw: 'history', idx: 0 }, { kw: 'culture', idx: 0 },
    { kw: 'park', idx: 1 }, { kw: 'nature', idx: 1 }, { kw: 'garden', idx: 1 },
    { kw: 'cafe', idx: 7 }, { kw: 'food', idx: 7 }, { kw: 'eat', idx: 7 },
    { kw: 'shopping', idx: 4 }, { kw: 'mall', idx: 4 }, { kw: 'market', idx: 8 },
    { kw: 'temple', idx: 5 },
    { kw: 'view', idx: 2 }, { kw: 'harbour', idx: 2 },
    { kw: 'art', idx: 16 }, { kw: 'gallery', idx: 16 },
  ];

  for (const p of priority) {
    if (t.includes(p.kw) && !used.has(p.idx)) {
      picked.push(ALL_STOPS[p.idx]);
      used.add(p.idx);
    }
  }

  if (picked.length < totalStops) {
    for (let i = 0; i < ALL_STOPS.length && picked.length < totalStops; i++) {
      if (!used.has(i)) {
        picked.push(ALL_STOPS[i]);
        used.add(i);
      }
    }
  }

  return {
    stops: picked,
    total_duration_minutes: picked.reduce((s, x) => s + x.approx_duration_minutes, 0),
    ordering_hint: days > 1 ? `Day 1: TST area · Day 2: West Kowloon · Day 3: Yau Ma Tei/Mong Kok` : 'Start from TST MTR',
  };
}
