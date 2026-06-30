import { ChatResponse, Intent, LLMStop } from '../types';
import { getFallbackPlan } from './llmGateway';
import { resolveStops } from './placeResolver';
import { getRoute } from './routingService';
import { saveItinerary, saveItineraryItem, savePlace, query } from '../db/client';

function detectIntent(text: string): Intent {
  const t = text.toLowerCase();
  if (t.includes('create') || t.includes('plan') || t.includes('itinerary') || t.includes('trip') || t.includes('build') || t.includes('make'))
    return 'create_itinerary';
  if (t.includes('add') || t.includes('include') || t.includes('also') || t.includes('plus') || t.includes('another'))
    return 'add_to_itinerary';
  if (t.includes('find') || t.includes('search') || t.includes('where') || t.includes('place') || t.includes('spot') || t.includes('near') || t.includes('around'))
    return 'find_places';
  return 'question';
}

function generateThinking(steps: string[]): string[] {
  return ['🤔 Analyzing your request...', ...steps.map((s, i) => `Step ${i + 1}: ${s}`), '✅ Done!'];
}

async function findPlaces(query_text: string): Promise<{ places: ChatResponse['places']; thinking: string[] }> {
  const t = query_text.toLowerCase();
  const categories: string[] = [];
  if (t.includes('museum')) categories.push('museum');
  if (t.includes('cafe') || t.includes('coffee')) categories.push('cafe');
  if (t.includes('restaurant') || t.includes('food') || t.includes('eat')) categories.push('restaurant');
  if (t.includes('park') || t.includes('garden') || t.includes('nature')) categories.push('park');
  if (t.includes('temple') || t.includes('church')) categories.push('temple');
  if (t.includes('mall') || t.includes('shop')) categories.push('shopping_mall');
  if (t.includes('view') || t.includes('harbour') || t.includes('waterfront')) categories.push('viewpoint');
  if (t.includes('market')) categories.push('market');
  if (t.includes('art') || t.includes('gallery')) categories.push('art_gallery');

  if (categories.length === 0) categories.push('museum', 'cafe', 'park');

  const th = ['Searching Kowloon for matching places...', `Looking for categories: ${categories.join(', ')}`];
  const stops: LLMStop[] = categories.map(c => ({ label: c, category: c, approx_duration_minutes: 60, notes: '' }));
  const places = await resolveStops(stops);

  th.push(`Found ${places.length} places in Kowloon`);
  return {
    places: places.map(p => ({ id: p.placeId, name: p.label, lat: p.lat, lng: p.lng, category: categories[places.indexOf(p)] || 'attraction' })),
    thinking: th,
  };
}

async function createItinerary(text: string): Promise<{ itinerary: NonNullable<ChatResponse['itinerary']>; places: ChatResponse['places']; thinking: string[] }> {
  const th: string[] = ['Detected intent: create a new itinerary for Kowloon', 'Generating suggested stops based on your interests...', 'Looking up real places in Kowloon...'];

  const llmPlan = getFallbackPlan(text);
  th.push(`Planned ${llmPlan.stops.length} stops for your trip`);

  const resolved = await resolveStops(llmPlan.stops);
  th.push(`Found ${resolved.length} real places in Kowloon`);

  const itineraryId = await saveItinerary(text, 'Kowloon');
  const stops: Array<{ label: string; placeId: number; startTime: string; endTime: string; lat: number; lng: number }> = [];
  let hour = 9;

  for (let i = 0; i < resolved.length; i++) {
    const p = resolved[i];
    const st = `${String(hour).padStart(2, '0')}:00`;
    hour += Math.ceil(p.duration / 60);
    const et = `${String(hour).padStart(2, '0')}:00`;

    let route = null;
    let dist = 0;
    if (i > 0) {
      const prev = resolved[i - 1];
      route = await getRoute(prev.lat, prev.lng, p.lat, p.lng);
      dist = route.distance_meters;
    }

    await saveItineraryItem({
      itinerary_id: itineraryId, place_id: p.placeId, stop_index: i, label: p.label,
      start_time: st, end_time: et, road_distance_meters: dist, duration_minutes: p.duration,
      route_geometry: route?.geometry,
    });
    stops.push({ label: p.label, placeId: p.placeId, startTime: st, endTime: et, lat: p.lat, lng: p.lng });
  }

  th.push(`Saved itinerary #${itineraryId} to database`);
  return {
    itinerary: { id: itineraryId, stops },
    places: resolved.map(p => ({ id: p.placeId, name: p.label, lat: p.lat, lng: p.lng })),
    thinking: th,
  };
}

async function addToItinerary(text: string, itineraryId: number): Promise<{ itinerary: ChatResponse['itinerary']; places: ChatResponse['places']; thinking: string[] }> {
  const th: string[] = [`Adding to itinerary #${itineraryId}...`, 'Determining what to add...'];

  const stops: LLMStop[] = [{ label: text.replace(/add|include|also|plus|another/gi, '').trim(), category: 'attraction', approx_duration_minutes: 60, notes: '' }];
  const resolved = await resolveStops(stops);
  th.push(`Found ${resolved.length} new place(s)`);

  const existing = await query('SELECT COUNT(*) as c FROM itinerary_items WHERE itinerary_id = $1', [itineraryId]);
  const nextIndex = parseInt(existing.rows[0]?.c || '0');

  for (let i = 0; i < resolved.length; i++) {
    const p = resolved[i];
    await saveItineraryItem({
      itinerary_id: itineraryId, place_id: p.placeId, stop_index: nextIndex + i,
      label: p.label, road_distance_meters: 0, duration_minutes: p.duration,
    });
  }

  const updatedStops = (await query(
    `SELECT ii.*, p.name as place_name, p.lat, p.lng FROM itinerary_items ii JOIN places p ON ii.place_id = p.id WHERE ii.itinerary_id = $1 ORDER BY ii.stop_index`,
    [itineraryId]
  )).rows;

  th.push(`Itinerary #${itineraryId} now has ${updatedStops.length} stops`);

  return {
    itinerary: {
      id: itineraryId,
      stops: updatedStops.map((r: any) => ({ label: r.place_name, placeId: r.place_id, startTime: r.start_time || '', endTime: r.end_time || '', lat: r.lat, lng: r.lng })),
    },
    places: updatedStops.map((r: any) => ({ id: r.place_id, name: r.place_name, lat: r.lat, lng: r.lng })),
    thinking: th,
  };
}

async function answerQuestion(text: string): Promise<{ response: string; thinking: string[] }> {
  const t = text.toLowerCase();
  const th = ['Analyzing your question about Kowloon...', 'Searching knowledge base...'];
  let answer = '';

  if (t.includes('best time') || t.includes('when to go') || t.includes('weather'))
    answer = 'Kowloon is best visited October-December when the weather is mild (20-25°C). Summer (June-August) is hot and humid with frequent rain.';
  else if (t.includes('transport') || t.includes('mtr') || t.includes('bus') || t.includes('get around'))
    answer = 'Kowloon has excellent public transport: MTR (subway), buses, minibuses, and taxis. The MTR is the fastest way to get around. Consider getting an Octopus card for easy payments.';
  else if (t.includes('accessibility') || t.includes('wheelchair') || t.includes('disabled') || t.includes('step-free'))
    answer = 'Kowloon has mixed accessibility. Most MTR stations have barrier-free access. Many newer buildings have ramps. Older attractions may have steps - always check ahead. The HK government provides a list of barrier-free facilities.';
  else if (t.includes('safety') || t.includes('safe') || t.includes('dangerous'))
    answer = 'Kowloon is generally very safe for tourists, even at night. Standard precautions apply: watch your belongings in crowded areas, especially in Mong Kok and Tsim Sha Tsui markets.';
  else if (t.includes('food') || t.includes('eat') || t.includes('cuisine'))
    answer = 'Kowloon offers incredible food! Try dim sum in TST, street food in Mong Kok (fish balls, egg waffles), and dai pai dong (open-air cooked food stalls).';
  else if (t.includes('language'))
    answer = 'Cantonese is the main language in Kowloon. English is widely understood in tourist areas, MTR stations, and restaurants. Mandarin is also commonly spoken.';
  else
    answer = 'Kowloon is a vibrant district of Hong Kong known for shopping (TST, Mong Kok), culture (Hong Kong Museum of History, Cultural Centre), parks (Kowloon Park), and amazing food. It\'s well-connected by MTR and offers a mix of modern malls and traditional markets.';

  return { response: answer, thinking: th };
}

export async function processChat(text: string, itineraryId?: number): Promise<ChatResponse> {
  const intent = detectIntent(text);
  const thinkingBase = [`Detected intent: ${intent}`, `Processing: "${text.slice(0, 60)}${text.length > 60 ? '...' : ''}"`];

  if (intent === 'create_itinerary') {
    const { itinerary, places, thinking } = await createItinerary(text);
    const all = await query('SELECT id, user_text, created_at FROM itineraries ORDER BY created_at DESC LIMIT 20');
    const stopNames = places?.map((p: any) => p.name).join(', ') || '';
    return {
      thinking: generateThinking([...thinkingBase, ...thinking]),
      intent, response: `Here's your Kowloon itinerary! I found ${places?.length || 0} places: ${stopNames}`,
      places, itinerary,
      allItineraries: all.rows.map((r: any) => ({ id: r.id, user_text: r.user_text, created_at: r.created_at, stop_count: 0 })),
    };
  }

  if (intent === 'add_to_itinerary') {
    if (!itineraryId) {
      const { itinerary, places, thinking } = await createItinerary(text + ' ' + text.replace(/add|include|also|plus|another/gi, '').trim());
      const all = await query('SELECT id, user_text, created_at FROM itineraries ORDER BY created_at DESC LIMIT 20');
      return {
        thinking: generateThinking([...thinkingBase, 'No active itinerary - created a new one', ...thinking]),
        intent: 'create_itinerary', response: `I created a new itinerary since you didn't have one active. Found ${places?.length || 0} places.`,
        places, itinerary,
        allItineraries: all.rows.map((r: any) => ({ id: r.id, user_text: r.user_text, created_at: r.created_at, stop_count: 0 })),
      };
    }
    const { itinerary, places, thinking } = await addToItinerary(text, itineraryId);
    const all = await query('SELECT id, user_text, created_at FROM itineraries ORDER BY created_at DESC LIMIT 20');
    return {
      thinking: generateThinking([...thinkingBase, ...thinking]),
      intent, response: `Added to itinerary #${itineraryId}! It now has ${places?.length || 0} stops.`,
      places, itinerary,
      allItineraries: all.rows.map((r: any) => ({ id: r.id, user_text: r.user_text, created_at: r.created_at, stop_count: 0 })),
    };
  }

  if (intent === 'find_places') {
    const { places, thinking } = await findPlaces(text);
    return {
      thinking: generateThinking([...thinkingBase, ...thinking]),
      intent, response: `I found ${places?.length || 0} places in Kowloon matching your interest.`,
      places,
    };
  }

  const { response, thinking } = await answerQuestion(text);
  return {
    thinking: generateThinking([...thinkingBase, ...thinking]),
    intent, response,
  };
}
