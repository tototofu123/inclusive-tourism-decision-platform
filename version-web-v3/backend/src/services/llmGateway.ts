import { LLMResponse } from '../types';
import { chatCompletion } from './apiClient';

const PROMPT = `You are a Hong Kong trip planner for accessible tourism. Output only valid JSON, no extra text.
Keep your thinking/reasoning extremely brief and concise. Do not draft the JSON in your thinking.

Rules:
- Regions: Kowloon, Hong Kong Island, New Territories. You do NOT need to include all three regions on every single day (e.g., Day 1 can be Kowloon, Day 2 Hong Kong Island, etc.).
- Categories: museum, cafe, park, temple, shopping_mall, viewpoint, restaurant, market, art_gallery, historic_site, hotel, amusement_park, attraction
- Each stop: 20-120 min duration
- Detect days from user request. If unspecified, use 1 day.
- DAYS = total days in the trip
- Assign each stop to a day (1-indexed) — max 4 stops per day, spread stops across all days evenly
- If user mentions focus areas (e.g. "culture", "shopping", "nature"), prioritize matching categories
- Include hotel/lodging recommendations if user asks where to stay
- If user has mobility needs or accessibility preferences, factor them into the plan

Output format:
{"stops":[{"label":"Place Name","category":"museum","approx_duration_minutes":60,"day":1,"notes":"accessibility note"}],"total_duration_minutes":300,"days":1,"focus_areas":["culture","history"]}`;

export async function planTrip(userText: string, context?: string, mobilityContext?: string): Promise<LLMResponse> {
  console.log('planTrip: calling LLM...');
  let userContent = `Plan a trip for: ${userText}`;
  if (context) userContent = `Existing trip context:\n${context}\n\nModify or replace based on the new request: ${userText}`;
  if (mobilityContext) {
    userContent = `User accessibility/mobility context:\n${mobilityContext}\n\nPlan a trip for: ${userText}`;
    if (context) userContent = `User accessibility/mobility context:\n${mobilityContext}\n\nExisting trip context:\n${context}\n\nModify or replace based on the new request: ${userText}`;
  }
  try {
    const r = await chatCompletion(
      [
        { role: 'system', content: PROMPT },
        { role: 'user', content: userContent },
      ],
      [],
      { temperature: 0.4, maxTokens: 4096 },
    );
    const content = r.content;
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
