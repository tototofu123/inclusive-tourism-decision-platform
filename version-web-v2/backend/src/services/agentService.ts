import { resolveStops } from './placeResolver';
import { getRoute } from './routingService';
import { saveItinerary, saveItineraryItem, getFullItinerary } from '../db/client';
import { chatCompletion } from './apiClient';

export interface AgentResponse {
  intent: 'question' | 'suggest_places' | 'create_itinerary' | 'add_to_itinerary' | 'update_itinerary';
  thought: string;
  text: string;
  itineraryStops?: Array<{
    label: string; category: string; approx_duration_minutes: number; notes?: string;
  }>;
  places?: Array<{
    placeId: number; name: string; lat: number; lng: number; category?: string;
  }>;
  itineraryId?: number;
}

const SYSTEM_PROMPT = `You are an inclusive tourism AI assistant for Kowloon, Hong Kong. Your job is to help users plan accessible trips.

Rules:
- Region is always Kowloon, Hong Kong
- Categories: museum, cafe, park, temple, shopping_mall, viewpoint, restaurant, market, art_gallery, historic_site
- Be helpful and concise
- Always think step by step in the "thought" field

Output format — respond with raw JSON, no markdown:

Intent types:
- "question" — user is asking a general question, no trip planning needed
- "suggest_places" — user wants place recommendations without a full itinerary
- "create_itinerary" — user wants a full step-by-step itinerary with routing
- "add_to_itinerary" — user wants to add a stop to an existing plan
- "update_itinerary" — user wants to modify an existing itinerary

{
  "intent": "create_itinerary",
  "thought": "The user wants to visit Kowloon... I should recommend places and create a timed plan.",
  "text": "Here's a plan for your Kowloon trip!",
  "stops": [
    {"label":"Place name","category":"museum","approx_duration_minutes":60,"notes":"description"}
  ]
}

For "question" intent, only "intent", "thought", and "text" are needed.
For "suggest_places", include "places" array with names.
For "create_itinerary"/"add_to_itinerary"/"update_itinerary", include "stops".`;

export async function processMessage(userText: string): Promise<AgentResponse> {
  console.log('agentService: processing message');
  const MAX_RETRIES = 2;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const r = await chatCompletion(
        [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `User message: ${userText}\n\nRespond with JSON:` }
        ],
        undefined,
        { temperature: 0.3, maxTokens: 2048 },
      );
      const content = r.content;
      const reasoning = r.reasoningContent || '';
      return parseAgentResponse(content, reasoning, userText);
    } catch (err) {
      console.error(`agentService attempt ${attempt + 1} failed:`, (err as Error).message);
      if (attempt === MAX_RETRIES - 1) {
        return getFallbackAgentResponse(userText);
      }
    }
  }
  return getFallbackAgentResponse(userText);
}

function parseAgentResponse(content: string, reasoning: string, userText: string): AgentResponse {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return getFallbackAgentResponse(userText);
  }
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const intent = parsed.intent || 'question';
    const baseResponse: AgentResponse = {
      intent,
      thought: reasoning || parsed.thought || 'Thinking...',
      text: parsed.text || parsed.response_text || '',
    };
    if (intent === 'question') return baseResponse;
    if (parsed.places && Array.isArray(parsed.places)) {
      baseResponse.places = parsed.places.slice(0, 5).map((p: any) => ({
        placeId: 0, name: p.name || p.label || 'Place',
        lat: p.lat || 22.31, lng: p.lng || 114.17, category: p.category || 'attraction',
      }));
    }
    if (parsed.stops && Array.isArray(parsed.stops)) {
      baseResponse.itineraryStops = parsed.stops.slice(0, 6).map((s: any) => ({
        label: s.label || s.name || 'Stop', category: s.category || 'attraction',
        approx_duration_minutes: s.approx_duration_minutes || s.duration || 60,
        notes: s.notes || '',
      }));
    }
    return baseResponse;
  } catch {
    return getFallbackAgentResponse(userText);
  }
}

function getFallbackAgentResponse(userText: string): AgentResponse {
  const text = userText.toLowerCase();
  const response: AgentResponse = {
    intent: 'question',
    thought: `Analyzing user request: "${userText}". Checking for trip planning keywords...`,
    text: `I'll help you with that! Let me look up places in Kowloon.`,
  };
  const needsItinerary = text.includes('itinerary') || text.includes('plan') || text.includes('trip') || text.includes('visit') || text.includes('go to') || text.includes('route') || text.includes('schedule');
  const wantsPlaces = text.includes('find') || text.includes('suggest') || text.includes('recommend') || text.includes('where') || text.includes('near') || text.includes('place');
  const wantsAdd = text.includes('add') || text.includes('include') || text.includes('also');
  const isQuestion = text.includes('what') || text.includes('how') || text.includes('when') || text.includes('why') || text.includes('tell me') || text.includes('explain') || text.includes('info') || text.includes('about') || text.includes('good for');

  if (wantsAdd) {
    response.intent = 'add_to_itinerary';
    response.thought = `User wants to add something to an existing itinerary. Extracting the specific place or category they mentioned.`;
    response.text = `Sure, I can add that to your itinerary!`;
  } else if (needsItinerary) {
    response.intent = 'create_itinerary';
    const stops: any[] = [];
    if (text.includes('museum') || text.includes('history')) stops.push({ label: 'Hong Kong Museum of History', category: 'museum', approx_duration_minutes: 90, notes: 'Tsim Sha Tsui East' });
    if (text.includes('cafe') || text.includes('food') || text.includes('eat')) stops.push({ label: 'TST Cafe', category: 'cafe', approx_duration_minutes: 45, notes: 'Near waterfront' });
    if (text.includes('park') || text.includes('nature') || text.includes('garden')) stops.push({ label: 'Kowloon Park', category: 'park', approx_duration_minutes: 60, notes: 'Aviary and sculpture walk' });
    if (text.includes('shopping') || text.includes('mall') || text.includes('market')) stops.push({ label: 'Harbour City', category: 'shopping_mall', approx_duration_minutes: 90, notes: 'Canton Road' });
    if (text.includes('temple')) stops.push({ label: 'Wong Tai Sin Temple', category: 'temple', approx_duration_minutes: 60, notes: 'Famous Taoist temple' });
    if (text.includes('view') || text.includes('harbour')) stops.push({ label: 'TST Promenade', category: 'viewpoint', approx_duration_minutes: 30, notes: 'Harbour view' });
    if (stops.length === 0) {
      stops.push({ label: 'Kowloon Park', category: 'park', approx_duration_minutes: 60, notes: 'Green space' },
        { label: 'HK Museum of History', category: 'museum', approx_duration_minutes: 90, notes: 'TST East' },
        { label: 'TST Promenade', category: 'viewpoint', approx_duration_minutes: 30, notes: 'Evening view' });
    }
    response.itineraryStops = stops;
    response.thought = `User wants to plan a Kowloon trip. "${userText}" — extracting categories and suggesting real Kowloon places with realistic timings.`;
    response.text = `I've created a Kowloon itinerary based on your interests! Here are the stops with timings and walking routes.`;
  } else if (wantsPlaces) {
    response.intent = 'suggest_places';
    response.thought = `User is looking for places in Kowloon. Searching for relevant spots based on their description.`;
    response.text = `Here are some places in Kowloon that match what you're looking for!`;
  } else {
    response.intent = 'question';
    response.thought = `This seems like a general question. Answering helpfully based on my Kowloon travel knowledge.`;
    response.text = `I'm your Kowloon travel assistant! You can ask me to plan an itinerary, suggest places, or tell you about accessible spots in the area. What would you like to know?`;
  }
  return response;
}

export async function executeAgentResponse(response: AgentResponse): Promise<AgentResponse> {
  if (response.intent === 'create_itinerary' && response.itineraryStops && response.itineraryStops.length > 0) {
    try {
      const resolvedPlaces = await resolveStops(response.itineraryStops, 'kowloon');
      const places = resolvedPlaces.map(p => ({
        placeId: p.placeId, name: p.label, lat: p.lat, lng: p.lng,
      }));
      response.places = places;
    } catch (err) {
      console.error('executeAgent: resolveStops failed:', err);
    }
  }
  return response;
}

export async function saveAgentItinerary(response: AgentResponse, userText: string): Promise<number | undefined> {
  if ((response.intent === 'create_itinerary' || response.intent === 'add_to_itinerary') && response.itineraryStops && response.itineraryStops.length > 0) {
    try {
      const resolvedPlaces = await resolveStops(response.itineraryStops, 'kowloon');
      const itineraryId = await saveItinerary(userText, 'Kowloon');
      let hour = 9;
      for (let i = 0; i < resolvedPlaces.length; i++) {
        const p = resolvedPlaces[i];
        const st = `${String(hour).padStart(2, '0')}:00`;
        hour += Math.ceil(p.duration / 60);
        const et = `${String(hour).padStart(2, '0')}:00`;
        let route = null;
        if (i > 0) {
          const prev = resolvedPlaces[i - 1];
          route = await getRoute(prev.lat, prev.lng, p.lat, p.lng);
        }
        await saveItineraryItem({
          itinerary_id: itineraryId, place_id: p.placeId, stop_index: i, label: p.label,
          start_time: st, end_time: et, road_distance_meters: route?.distance_meters || 0,
          duration_minutes: p.duration, route_geometry: route?.geometry,
        });
      }
      response.itineraryId = itineraryId;
      response.places = resolvedPlaces.map(p => ({ placeId: p.placeId, name: p.label, lat: p.lat, lng: p.lng }));
      return itineraryId;
    } catch (err) {
      console.error('saveAgentItinerary failed:', err);
    }
  }
  return undefined;
}
