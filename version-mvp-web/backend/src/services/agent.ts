import { ChatResponse, Intent, LLMStop } from '../types';
import { planTrip } from './llmGateway';
import { resolveStops } from './placeResolver';
import { getRoute } from './routingService';
import { saveItinerary, saveItineraryItem, savePlace, query } from '../db/client';

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3;
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestNeighborReorder(resolved: Array<{ placeId: number; label: string; lat: number; lng: number; duration: number }>): typeof resolved {
  if (resolved.length <= 2) return resolved;
  const ordered: typeof resolved = [resolved[0]];
  const used = new Set<number>([0]);
  while (ordered.length < resolved.length) {
    const last = ordered[ordered.length - 1];
    let best = -1, bestDist = Infinity;
    for (let i = 0; i < resolved.length; i++) {
      if (used.has(i)) continue;
      const d = haversine(last.lat, last.lng, resolved[i].lat, resolved[i].lng);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    used.add(best);
    ordered.push(resolved[best]);
  }
  return ordered;
}

function detectIntent(text: string, itineraryId?: number): Intent {
  const t = text.toLowerCase();
  if (t.includes('remove') || t.includes('delete') || t.includes("don't want") || t.includes("dont want") || t.includes("dont") || t.includes('exclude') || t.includes('skip') || t.includes('instead') || t.includes('replace') || t.includes('change') || t.includes('swap') || t.includes('not want') || t.includes("don't") || t.includes("doesn't") || t.includes('hate') || t.includes('dislike') || (t.includes('not') && itineraryId && (t.includes('go') || t.includes('visit'))))
    return 'modify_itinerary';
  if (t.includes('create') || t.includes('plan') || t.includes('itinerary') || t.includes('trip') || t.includes('build') || t.includes('make'))
    return 'create_itinerary';
  if (t.includes('add') || t.includes('include') || t.includes('also') || t.includes('plus') || t.includes('another'))
    return 'add_to_itinerary';
  if (t.includes('find') || t.includes('search') || t.includes('where') || t.includes('place') || t.includes('spot') || t.includes('near') || t.includes('around'))
    return 'find_places';
  return 'question';
}

async function findPlaces(query_text: string, emit: (s: string) => void): Promise<{ places: ChatResponse['places']; thinking: string[] }> {
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

  const th: string[] = [];
  emit('Searching Kowloon for matching places...'); th.push('Searching Kowloon for matching places...');
  const catMsg = `Looking for categories: ${categories.join(', ')}`;
  emit(catMsg); th.push(catMsg);

  const stops: LLMStop[] = categories.map(c => ({ label: c, category: c, approx_duration_minutes: 60, notes: '' }));
  const places = await resolveStops(stops);

  const foundMsg = `Found ${places.length} places in Kowloon`;
  emit(foundMsg); th.push(foundMsg);
  return {
    places: places.map(p => ({ id: p.placeId, name: p.label, lat: p.lat, lng: p.lng, category: categories[places.indexOf(p)] || 'attraction' })),
    thinking: th,
  };
}

async function createItinerary(text: string, existingId?: number, emit?: (s: string) => void): Promise<{ itinerary: NonNullable<ChatResponse['itinerary']>; places: ChatResponse['places']; thinking: string[] }> {
  const th: string[] = [];
  let context: string | undefined;
  if (existingId) {
    const old = await query('SELECT ii.label, p.name, p.category FROM itinerary_items ii JOIN places p ON ii.place_id = p.id WHERE ii.itinerary_id = $1 ORDER BY ii.stop_index', [existingId]);
    if (old.rows.length > 0) context = old.rows.map((r: any) => `- ${r.label || r.name} (${r.category})`).join('\n');
  }

  const planMsg = `Planning a Kowloon trip based on: "${text}"`;
  emit?.(planMsg); th.push(planMsg);

  const llmPlan = await planTrip(text, context);
  const categories = [...new Set(llmPlan.stops.map(s => s.category))];
  const searchMsg = `Searching for places: ${categories.join(', ')}`;
  emit?.(searchMsg); th.push(searchMsg);

  let resolved = await resolveStops(llmPlan.stops);
  const foundMsg = `Found ${resolved.length} accessible places for your trip`;
  emit?.(foundMsg); th.push(foundMsg);

  resolved = nearestNeighborReorder(resolved);
  const reorderMsg = 'Reordered stops to minimize walking distance';
  emit?.(reorderMsg); th.push(reorderMsg);

  let days = llmPlan.days || 1;
  const dayMatch = text.match(/(\d+)\s*day|\b(one|two|three|four|five)\s*day/i);
  if (dayMatch) {
    const numMap: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };
    const parsed = parseInt(dayMatch[1] || dayMatch[2]);
    const detected = !isNaN(parsed) ? parsed : (numMap[dayMatch[2]?.toLowerCase()] || 1);
    if (detected > days) days = Math.min(detected, 5);
  }
  if (llmPlan.focus_areas?.length) {
    const focusMsg = `Focus areas: ${llmPlan.focus_areas.join(', ')}`;
    emit?.(focusMsg); th.push(focusMsg);
  }

  const itineraryId = await saveItinerary(text, 'Kowloon');
  const stops: Array<{ label: string; placeId: number; startTime: string; endTime: string; lat: number; lng: number; day: number; distance: number }> = [];
  let currentDay = 1, hour = 9;

  for (let i = 0; i < resolved.length; i++) {
    const p = resolved[i];
    const llmDay = llmPlan.stops[i]?.day || currentDay;
    const day = Math.min(llmDay, days);
    if (day !== currentDay) { currentDay = day; hour = 9; }
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
      route_geometry: route?.geometry, day_number: day,
    });
    stops.push({ label: p.label, placeId: p.placeId, startTime: st, endTime: et, lat: p.lat, lng: p.lng, day, distance: dist });
  }

  if (days > 1) {
    const savedMsg = `Saved itinerary #${itineraryId} to database (${days} days)`;
    emit?.(savedMsg); th.push(savedMsg);
  }
  return {
    itinerary: { id: itineraryId, stops },
    places: resolved.map(p => ({ id: p.placeId, name: p.label, lat: p.lat, lng: p.lng })),
    thinking: th,
  };
}

async function addToItinerary(text: string, itineraryId: number, emit?: (s: string) => void): Promise<{ itinerary: ChatResponse['itinerary']; places: ChatResponse['places']; thinking: string[] }> {
  const th: string[] = [];
  const addMsg = `Adding to itinerary #${itineraryId}...`;
  emit?.(addMsg); th.push(addMsg);
  const detMsg = 'Determining what to add...';
  emit?.(detMsg); th.push(detMsg);

  const stops: LLMStop[] = [{ label: text.replace(/add|include|also|plus|another/gi, '').trim(), category: 'attraction', approx_duration_minutes: 60, notes: '' }];
  const resolved = await resolveStops(stops);
  const foundMsg = `Found ${resolved.length} new place(s)`;
  emit?.(foundMsg); th.push(foundMsg);

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

  const updatedMsg = `Itinerary #${itineraryId} now has ${updatedStops.length} stops`;
  emit?.(updatedMsg); th.push(updatedMsg);

  return {
    itinerary: {
      id: itineraryId,
      stops: updatedStops.map((r: any) => ({ label: r.place_name, placeId: r.place_id, startTime: r.start_time || '', endTime: r.end_time || '', lat: r.lat, lng: r.lng, day: r.day_number || 1, distance: r.road_distance_meters || 0 })),
    },
    places: updatedStops.map((r: any) => ({ id: r.place_id, name: r.place_name, lat: r.lat, lng: r.lng })),
    thinking: th,
  };
}

async function modifyItinerary(text: string, itineraryId: number, emit?: (s: string) => void): Promise<{ itinerary: ChatResponse['itinerary']; places: ChatResponse['places']; thinking: string[] }> {
  const th: string[] = [];
  const modMsg = `Modifying itinerary #${itineraryId}...`;
  emit?.(modMsg); th.push(modMsg);

  const existing = await query(
    'SELECT ii.id, ii.stop_index, ii.label, p.name, p.id as place_id, p.lat, p.lng, p.category FROM itinerary_items ii JOIN places p ON ii.place_id = p.id WHERE ii.itinerary_id = $1 ORDER BY ii.stop_index',
    [itineraryId]
  );
  const existingStops = existing.rows;
  if (existingStops.length === 0) {
    const errMsg = 'Itinerary has no stops to modify';
    emit?.(errMsg); th.push(errMsg);
    return { itinerary: { id: itineraryId, stops: [] }, places: [], thinking: th };
  }

  const ctx = existingStops.map((r: any) => `- ${r.label || r.name} (${r.category || 'unknown'})`).join('\n');
  const llmPlan = await planTrip(`[MODIFY] ${text}\n\nCurrent stops:\n${ctx}\n\nReturn ONLY the stops that should REMAIN after the modification. Remove stops the user doesn't want.`, undefined);

  if (llmPlan.stops.length === 0) {
    const errMsg = 'Could not understand the modification. Please be more specific.';
    emit?.(errMsg); th.push(errMsg);
    return { itinerary: { id: itineraryId, stops: existingStops.map((r: any) => ({ label: r.label || r.name, placeId: r.place_id, startTime: '', endTime: '', lat: r.lat, lng: r.lng, day: 1, distance: 0 })) }, places: [], thinking: th };
  }

  await query('DELETE FROM itinerary_items WHERE itinerary_id = $1', [itineraryId]);

  const keptLabels = new Set(llmPlan.stops.map(s => s.label.toLowerCase()));
  const kept = existingStops.filter((r: any) => {
    const name = (r.label || r.name || '').toLowerCase();
    const match = llmPlan.stops.find(s => name.includes(s.label.toLowerCase()) || s.label.toLowerCase().includes(name));
    return match;
  });

  if (kept.length === 0) {
    for (const p of existingStops) {
      await saveItineraryItem({
        itinerary_id: itineraryId, place_id: p.place_id, stop_index: p.stop_index,
        label: p.label || p.name, road_distance_meters: 0, duration_minutes: 60,
      });
    }
    const errMsg = 'Could not determine which stops to remove. No changes made.';
    emit?.(errMsg); th.push(errMsg);
    return { itinerary: { id: itineraryId, stops: existingStops.map((r: any) => ({ label: r.label || r.name, placeId: r.place_id, startTime: '', endTime: '', lat: r.lat, lng: r.lng, day: 1, distance: 0 })) }, places: [], thinking: th };
  }

  for (let i = 0; i < kept.length; i++) {
    const p = kept[i];
    await saveItineraryItem({
      itinerary_id: itineraryId, place_id: p.place_id, stop_index: i,
      label: p.label || p.name, road_distance_meters: 0, duration_minutes: 60, day_number: 1,
    });
  }

  const removed = existingStops.length - kept.length;
  const doneMsg = removed > 0 ? `Removed ${removed} stop(s) from itinerary #${itineraryId}` : 'No changes made to itinerary';
  emit?.(doneMsg); th.push(doneMsg);

  return {
    itinerary: { id: itineraryId, stops: kept.map((r: any) => ({ label: r.label || r.name, placeId: r.place_id, startTime: '', endTime: '', lat: r.lat, lng: r.lng, day: 1, distance: 0 })) },
    places: kept.map((r: any) => ({ id: r.place_id, name: r.label || r.name, lat: r.lat, lng: r.lng })),
    thinking: th,
  };
}

async function answerQuestion(text: string, emit?: (s: string) => void): Promise<{ response: string; thinking: string[] }> {
  const t = text.toLowerCase();
  const th: string[] = [];
  emit?.('Analyzing your question about Kowloon...'); th.push('Analyzing your question about Kowloon...');
  emit?.('Searching knowledge base...'); th.push('Searching knowledge base...');
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

export async function processChat(text: string, itineraryId?: number, onThink?: (step: string) => void): Promise<ChatResponse> {
  const emit = (msg: string) => { if (onThink) onThink(msg); };
  let intent = detectIntent(text, itineraryId);

  // Extract explicit itinerary reference: "itinerary #16", "itinerary 16", "#16"
  const itinRef = text.match(/#(\d+)\b|itinerary\s*(?:#\s*)?(\d+)/i);
  if (itinRef) {
    const parsed = parseInt(itinRef[1] || itinRef[2]);
    if (!isNaN(parsed)) {
      itineraryId = parsed;
      if (intent === 'question') intent = 'modify_itinerary';
      emit(`Targeting itinerary #${parsed}`);
    }
  }

  emit(`Analyzing your request...`);
  emit(`Detected intent: ${intent}`);
  emit(`Intent: "${text.slice(0, 60)}${text.length > 60 ? '...' : ''}"`);

  if (intent === 'create_itinerary') {
    const { itinerary, places, thinking } = await createItinerary(text, itineraryId, emit);
    const all = await query('SELECT id, user_text, created_at FROM itineraries ORDER BY created_at DESC LIMIT 20');
    const stopCount = places?.length || 0;
   const days = itinerary?.stops?.length ? Math.max(...itinerary.stops.map((s: any) => s.day || 1)) : 1;
    return {
      thinking: ['Analyzing your request...', ...thinking, 'Done!'],
      intent, response: `Planned a ${days}-day Kowloon itinerary with ${stopCount} stops. Open the Itinerary tab to see the full day-by-day plan with walking times.`,
      places, itinerary,
      allItineraries: all.rows.map((r: any) => ({ id: r.id, user_text: r.user_text, created_at: r.created_at, stop_count: 0 })),
    };
  }

  if (intent === 'add_to_itinerary') {
    if (!itineraryId) {
      const { itinerary, places, thinking } = await createItinerary(text + ' ' + text.replace(/add|include|also|plus|another/gi, '').trim(), itineraryId, emit);
      const all = await query('SELECT id, user_text, created_at FROM itineraries ORDER BY created_at DESC LIMIT 20');
      return {
        thinking: ['Analyzing your request...', ...thinking, 'Done!'],
        intent: 'create_itinerary', response: `I created a new itinerary since you didn't have one active. Found ${places?.length || 0} places.`,
        places, itinerary,
        allItineraries: all.rows.map((r: any) => ({ id: r.id, user_text: r.user_text, created_at: r.created_at, stop_count: 0 })),
      };
    }
    const { itinerary, places, thinking } = await addToItinerary(text, itineraryId, emit);
    const all = await query('SELECT id, user_text, created_at FROM itineraries ORDER BY created_at DESC LIMIT 20');
    return {
      thinking: ['Analyzing your request...', ...thinking, 'Done!'],
      intent, response: `Added to itinerary #${itineraryId}! It now has ${places?.length || 0} stops.`,
      places, itinerary,
      allItineraries: all.rows.map((r: any) => ({ id: r.id, user_text: r.user_text, created_at: r.created_at, stop_count: 0 })),
    };
  }

  if (intent === 'modify_itinerary') {
    if (!itineraryId) {
      emit('No active itinerary to modify. Creating a new one...');
      const { itinerary, places, thinking } = await createItinerary(text, itineraryId, emit);
      const all = await query('SELECT id, user_text, created_at FROM itineraries ORDER BY created_at DESC LIMIT 20');
      return {
        thinking: ['Analyzing your request...', ...thinking, 'Done!'],
        intent: 'create_itinerary', response: `I created a new itinerary since there was no active one. Found ${places?.length || 0} places.`,
        places, itinerary,
        allItineraries: all.rows.map((r: any) => ({ id: r.id, user_text: r.user_text, created_at: r.created_at, stop_count: 0 })),
      };
    }
    const { itinerary, places, thinking } = await modifyItinerary(text, itineraryId, emit);
    const all = await query('SELECT id, user_text, created_at FROM itineraries ORDER BY created_at DESC LIMIT 20');
    const removed = thinking.some(s => s.includes('Removed'));
    return {
      thinking: ['Analyzing your request...', ...thinking, 'Done!'],
      intent, response: removed ? `Updated itinerary #${itineraryId}! Removed stops as requested.` : `No changes to itinerary #${itineraryId}.`,
      places, itinerary,
      allItineraries: all.rows.map((r: any) => ({ id: r.id, user_text: r.user_text, created_at: r.created_at, stop_count: 0 })),
    };
  }

  if (intent === 'find_places') {
    const { places, thinking } = await findPlaces(text, emit);
    return {
      thinking: ['Analyzing your request...', ...thinking, 'Done!'],
      intent, response: `I found ${places?.length || 0} places in Kowloon matching your interest.`,
      places,
    };
  }

  const { response, thinking } = await answerQuestion(text, emit);
  return {
    thinking: ['Analyzing your request...', ...thinking, 'Done!'],
    intent, response,
  };
}
