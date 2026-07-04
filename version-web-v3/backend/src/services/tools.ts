import { query, saveItinerary, saveItineraryItem, getFullItinerary } from '../db/client';
import { resolveStops } from './placeResolver';
import { getRoute, getAccessibleTransitRoute } from './routingService';
import { planTrip } from './llmGateway';
import { getAccessibility, isMTRStationAccessible } from './accessibilityService';
import { setGlobalPreferences, getGlobalPreferences } from './globalPreferencesService';
import { searchBySemantic } from './ragService';
import { LLMStop } from '../types';

const searchCache = new Map<string, { results: any[]; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute

export interface ToolResult {
  response: string;
  thinking?: string[];
  places?: any[];
  itinerary?: { id: number; stops: any[] };
}

export const TOOLS: any[] = [
  {
    type: 'function',
    function: {
      name: 'search_places',
      description: 'Search for places by category, name, region, or keywords. Regions: kowloon, hong_kong_island, new_territories. Budgets: free, cheap, moderate, expensive. Categories: museum, cafe, restaurant, park, temple, shopping_mall, viewpoint, market, art_gallery, historic_site, hotel.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'What the user is looking for, e.g. "museums in Tsim Sha Tsui" or "parks near me"' },
          region: { type: 'string', description: 'Region filter: kowloon, hong_kong_island, new_territories' },
          budget: { type: 'string', description: 'Budget filter: free, cheap, moderate, expensive' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_place_alternatives',
      description: 'Find alternative places similar to a given place. Use when a place is closed, inaccessible, too far, or user wants options.',
      parameters: {
        type: 'object',
        properties: {
          place_name: { type: 'string', description: 'Name of the place to find alternatives for' },
          reason: { type: 'string', description: 'Why alternatives are needed (closed, inaccessible, too far, fully booked, etc.)' },
          category: { type: 'string', description: 'Category to search in (museum, park, restaurant, etc.)' },
        },
        required: ['place_name', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_accessibility',
      description: 'Check accessibility information for a place. Returns wheelchair access, step-free entry, accessible bathrooms, etc.',
      parameters: {
        type: 'object',
        properties: {
          place_name: { type: 'string', description: 'Name of the place to check' },
        },
        required: ['place_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_preferences',
      description: 'Save or update user preferences globally. Call ONLY when the user explicitly tells you about their mobility, interests, budget, or home base. DO NOT infer or guess — only use info the user directly states. After calling, tell the user what you saved.',
      parameters: {
        type: 'object',
        properties: {
          mobility: { type: 'string', enum: ['none', 'wheelchair', 'cane', 'slow', 'fast', 'hearing_impaired', 'visually_impaired'], description: 'Mobility status — only set if user explicitly mentions it' },
          interests: { type: 'array', items: { type: 'string', enum: ['museum', 'cafe', 'restaurant', 'park', 'temple', 'shopping_mall', 'viewpoint', 'market', 'art_gallery', 'historic_site', 'hotel'] }, description: 'Interests — only set if user explicitly mentions categories they like' },
          budget_level: { type: 'string', enum: ['cheap', 'medium', 'expensive'], description: 'Budget level — only set if user explicitly mentions budget' },
          home_base: { type: 'string', description: 'Area/neighborhood user is staying in — only set if user explicitly states it' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_itinerary',
      description: 'Create a new multi-day Kowloon itinerary. Plans stops, searches for real places, optimizes walking route, and saves to database.',
      parameters: {
        type: 'object',
        properties: {
          preferences: { type: 'string', description: 'User\'s trip preferences, interests, and requirements' },
          days: { type: 'number', description: 'Number of days for the trip (default 1)' },
          existing_itinerary_id: { type: 'number', description: 'If modifying an existing trip, pass its ID here so previous stops are used as context' },
        },
        required: ['preferences'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_itinerary',
      description: 'Modify an existing itinerary. Can add stops, remove stops, or reorder. Requires an active itinerary ID.',
      parameters: {
        type: 'object',
        properties: {
          itinerary_id: { type: 'number', description: 'The itinerary ID to modify' },
          changes: { type: 'string', description: 'Description of what to change, e.g. "remove Museum of Art" or "add a park"' },
        },
        required: ['itinerary_id', 'changes'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_itinerary',
      description: 'Get full details of an itinerary including all stops, their order, times, and walking distances between them.',
      parameters: {
        type: 'object',
        properties: {
          itinerary_id: { type: 'number', description: 'The itinerary ID to fetch' },
        },
        required: ['itinerary_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_itineraries',
      description: 'List all saved itineraries with their IDs, user descriptions, and stop counts.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_itinerary',
      description: 'Delete an itinerary and all its stops. This cannot be undone.',
      parameters: {
        type: 'object',
        properties: {
          itinerary_id: { type: 'number', description: 'The itinerary ID to delete' },
        },
        required: ['itinerary_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'route_distance',
      description: 'Get the real walking distance and time between two locations using OSRM. Use this instead of guessing linear distance.',
      parameters: {
        type: 'object',
        properties: {
          from_lat: { type: 'number', description: 'Starting latitude' },
          from_lng: { type: 'number', description: 'Starting longitude' },
          to_lat: { type: 'number', description: 'Destination latitude' },
          to_lng: { type: 'number', description: 'Destination longitude' },
        },
        required: ['from_lat', 'from_lng', 'to_lat', 'to_lng'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_transport',
      description: 'Find transport options between two locations when walking is not practical (more than ~10 minutes). Returns MTR and bus estimates with travel times.',
      parameters: {
        type: 'object',
        properties: {
          from_name: { type: 'string', description: 'Name of the origin location' },
          from_lat: { type: 'number', description: 'Origin latitude' },
          from_lng: { type: 'number', description: 'Origin longitude' },
          to_name: { type: 'string', description: 'Name of the destination location' },
          to_lat: { type: 'number', description: 'Destination latitude' },
          to_lng: { type: 'number', description: 'Destination longitude' },
        },
        required: ['from_name', 'from_lat', 'from_lng', 'to_name', 'to_lat', 'to_lng'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'optimize_route',
      description: 'Re-order a set of stops to minimize total walking distance. Uses nearest-neighbor algorithm to avoid back-and-forth travel.',
      parameters: {
        type: 'object',
        properties: {
          stops: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                lat: { type: 'number' },
                lng: { type: 'number' },
              },
            },
            description: 'Array of stops with name, lat, lng to optimize',
          },
        },
        required: ['stops'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_travel_time',
      description: 'Get the total travel time between two places by a specific mode (walking, transit). Combines walking to station, transit, and walking from station.',
      parameters: {
        type: 'object',
        properties: {
          from_lat: { type: 'number' },
          from_lng: { type: 'number' },
          to_lat: { type: 'number' },
          to_lng: { type: 'number' },
          mode: { type: 'string', enum: ['walking', 'transit'], description: 'Mode of travel' },
        },
        required: ['from_lat', 'from_lng', 'to_lat', 'to_lng', 'mode'],
      },
    },
  },
];

function nearestNeighborReorder<T extends { lat: number; lng: number }>(stops: T[]): T[] {
  if (stops.length <= 2) return stops;
  const ordered: T[] = [stops[0]];
  const used = new Set<number>([0]);
  while (ordered.length < stops.length) {
    const last = ordered[ordered.length - 1];
    let best = -1, bestDist = Infinity;
    for (let i = 0; i < stops.length; i++) {
      if (used.has(i)) continue;
      const d = haversineKm(last.lat, last.lng, stops[i].lat, stops[i].lng);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    used.add(best);
    ordered.push(stops[best]);
  }
  return ordered;
}

type EmitFn = (msg: string) => void;

// ── Tool implementations ──

async function searchPlaces(query_text: string, region: string, budget: string, emit: EmitFn): Promise<ToolResult> {
  const th: string[] = [];
  const regionLabel = region ? region.replace(/_/g, ' ') : 'Kowloon';
  emit(`Searching ${regionLabel} for matching places...`); th.push(`Searching ${regionLabel} for matching places...`);

  const cacheKey = `${query_text}|${region}|${budget}`.toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { response: `Found ${cached.results.length} place(s): ${cached.results.map((r: any) => r.label).join(', ')}`, places: cached.results };
  }

  const t = query_text.toLowerCase();
  const categories: string[] = [];
  if (t.includes('museum')) categories.push('museum');
  if (t.includes('gallery') || (t.includes('art') && !t.includes('museum'))) categories.push('art_gallery');
  if (t.includes('cafe') || t.includes('coffee') || t.includes('tea') || t.includes('bakery') || t.includes('bistro') || t.includes('brunch')) categories.push('cafe');
  if (t.includes('restaurant') || t.includes('food') || t.includes('eat') || t.includes('dining') || t.includes('diner') || t.includes('cuisine') || t.includes('lunch') || t.includes('dinner') || t.includes('breakfast')) categories.push('restaurant');
  if (t.includes('park') || t.includes('garden') || t.includes('nature') || t.includes('playground') || t.includes('outdoor')) categories.push('park');
  if (t.includes('temple') || t.includes('church') || t.includes('mosque') || t.includes('monastery') || t.includes('shrine')) categories.push('temple');
  if (t.includes('mall') || t.includes('shop') || t.includes('store') || t.includes('plaza')) categories.push('shopping_mall');
  if (t.includes('view') || t.includes('harbour') || t.includes('harbor') || t.includes('waterfront') || t.includes('skyline') || t.includes('observation')) categories.push('viewpoint');
  if (t.includes('market') || t.includes('bazaar')) categories.push('market');
  if (t.includes('hotel') || t.includes('hostel') || t.includes('lodging')) categories.push('hotel');
  if (t.includes('toilet') || t.includes('restroom') || t.includes('bathroom') || t.includes('wc')) categories.push('restroom');
  if (t.includes('art') || t.includes('gallery')) categories.push('art_gallery');
  if (t.includes('historic') || t.includes('heritage')) categories.push('historic_site');
  if (t.includes('hotel') || t.includes('accommodation') || t.includes('lodging') || t.includes('live') || t.includes('stay') || t.includes('hostel')) categories.push('hotel');
  if (t.includes('toilet') || t.includes('bathroom') || t.includes('restroom') || t.includes('washroom')) categories.push('restroom');

  const hasSpecificCategory = categories.length > 0;
  if (categories.length === 0) categories.push('museum', 'cafe', 'restaurant', 'park', 'temple', 'shopping_mall', 'viewpoint', 'market', 'art_gallery', 'historic_site', 'hotel');

  const catMsg = `Looking for categories: ${categories.join(', ')}`;
  emit(catMsg); th.push(catMsg);

  // Normalize region: "Hong Kong" or "hong_kong" → search all regions
  const dbRegion = (region || '').toLowerCase().replace(/\s+/g, '_');
  const resolvedRegion = (dbRegion === 'hong_kong' || dbRegion === 'all' || dbRegion === '') ? undefined : dbRegion;

  const stops: LLMStop[] = categories.map(c => ({ label: c, category: c, approx_duration_minutes: 60, notes: '' }));
  const places = await resolveStops(stops, resolvedRegion, budget);

  // If keyword matching was generic, supplement with semantic search for natural-language queries
  let semanticPlaces: any[] = [];
  if (!hasSpecificCategory && query_text.length > 5) {
    const semMsg = `Trying semantic search for: "${query_text}"`;
    emit(semMsg); th.push(semMsg);
    try {
      const results = await searchBySemantic(query_text, 8);
      semanticPlaces = results
        .filter((r: any) => {
          const n = r.name || '';
          return !n.match(/^[a-z_]+ \(Kowloon\)$/);
        })
        .map((r: any) => ({
          placeId: r.id,
          label: r.name,
          lat: r.lat,
          lng: r.lng,
          category: r.category || 'attraction',
          similarity: r.similarity,
        }));
      const semFoundMsg = `Semantic search added ${semanticPlaces.length} relevant places`;
      emit(semFoundMsg); th.push(semFoundMsg);
    } catch (err: any) {
      console.error('Semantic search failed:', err.message);
    }
  }

  const foundMsg = `Found ${places.length} places in ${regionLabel}`;
  emit(foundMsg); th.push(foundMsg);

  const filtered = places.filter(p => !p.label.match(/^[a-z_]+ \(Kowloon\)$/));
  const allPlaces = semanticPlaces.length > 0
    ? [...new Map([...semanticPlaces, ...filtered].map(p => [p.placeId, p])).values()]
    : filtered;
  const names = allPlaces.length > 0 ? allPlaces.map(p => `- ${p.label}`).join('\n') : '(no curated places found for this search)';
  const placesOut = allPlaces.length > 0
    ? allPlaces.map((p, i) => ({ id: p.placeId, name: p.label, lat: p.lat, lng: p.lng, category: p.category || 'attraction' }))
    : places.map((p, i) => ({ id: p.placeId, name: p.label, lat: p.lat, lng: p.lng, category: categories[i] || 'attraction' }));
  searchCache.set(cacheKey, { results: placesOut, timestamp: Date.now() });
  if (searchCache.size > 100) {
    const oldest = [...searchCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
    if (oldest) searchCache.delete(oldest[0]);
  }
  return {
    response: `I found ${allPlaces.length} place${allPlaces.length !== 1 ? 's' : ''} in ${regionLabel}:\n${names}`,
    thinking: th,
    places: placesOut,
  };
}

async function createItineraryTool(days: number, preferences: string, emit: EmitFn, existingId?: number, region?: string): Promise<ToolResult> {
  const th: string[] = [];
  const regionLabel = (region || 'kowloon').replace(/_/g, ' ');
  const planMsg = `Planning a ${regionLabel} trip based on: "${preferences}"`;
  emit(planMsg); th.push(planMsg);

  let context: string | undefined;
  if (existingId) {
    const old = await query('SELECT ii.label, p.name, p.category FROM itinerary_items ii JOIN places p ON ii.place_id = p.id WHERE ii.itinerary_id = $1 ORDER BY ii.stop_index', [existingId]);
    if (old.rows.length > 0) context = old.rows.map((r: any) => `- ${r.label || r.name} (${r.category})`).join('\n');
  }

  const globalPrefs = await getGlobalPreferences();
  const mobCtx = globalPrefs.mobility && globalPrefs.mobility !== 'none' ? `User has ${globalPrefs.mobility} mobility. Prioritize step-free venues.` : undefined;
  const llmPlan = await planTrip(preferences, context, mobCtx);
  const categories = [...new Set(llmPlan.stops.map((s: any) => s.category))];
  const searchMsg = `Searching for places: ${categories.join(', ')}`;
  emit(searchMsg); th.push(searchMsg);

  let resolved = await resolveStops(llmPlan.stops, region, globalPrefs.budget_level !== 'medium' ? globalPrefs.budget_level : undefined);
  const foundMsg = `Found ${resolved.length} accessible places for your trip`;
  emit(foundMsg); th.push(foundMsg);

  resolved = nearestNeighborReorder(resolved);
  const reorderMsg = 'Reordered stops to minimize walking distance';
  emit(reorderMsg); th.push(reorderMsg);

  const actualDays = Math.max(days || 1, llmPlan.days || 1);
  const itineraryId = await saveItinerary(preferences, regionLabel);
  const stops: Array<{ label: string; placeId: number; startTime: string; endTime: string; lat: number; lng: number; day: number; distance: number }> = [];
  let currentDay = 1, hour = 9;

  // Build day map from original plan before reorder
  const dayMap = new Map<string, number>();
  llmPlan.stops.forEach((s: any, idx: number) => {
    dayMap.set(s.label || s.category || `stop_${idx}`, s.day || currentDay);
  });

  const routeQueries = resolved.length > 1
    ? await Promise.all(resolved.slice(1).map((_, i) =>
        getRoute(resolved[i].lat, resolved[i].lng, resolved[i + 1].lat, resolved[i + 1].lng)
      ))
    : [];

  for (let i = 0; i < resolved.length; i++) {
    const p = resolved[i];
    const llmDay = dayMap.get(p.label || `stop_${i}`) || currentDay;
    const day = Math.min(llmDay, actualDays);
    if (day !== currentDay) { currentDay = day; hour = 9; }
    const st = `${String(hour).padStart(2, '0')}:00`;
    hour += Math.ceil(p.duration / 60);
    const et = `${String(hour).padStart(2, '0')}:00`;

    const route = i > 0 ? routeQueries[i - 1] : null;
    const dist = route?.distance_meters || 0;

    await saveItineraryItem({
      itinerary_id: itineraryId, place_id: p.placeId, stop_index: i, label: p.label,
      start_time: st, end_time: et, road_distance_meters: dist, duration_minutes: p.duration,
      route_geometry: route?.geometry, day_number: day,
    });
    stops.push({ label: p.label, placeId: p.placeId, startTime: st, endTime: et, lat: p.lat, lng: p.lng, day, distance: dist });
  }

  if (actualDays > 1) {
    const savedMsg = `Saved itinerary #${itineraryId} to database (${actualDays} days)`;
    emit(savedMsg); th.push(savedMsg);
  }

  const all = await query('SELECT id, user_text, created_at FROM itineraries ORDER BY created_at DESC LIMIT 20');
  return {
    response: `Planned a ${actualDays}-day ${regionLabel} itinerary with ${stops.length} stops. Open the Itinerary tab to see the full day-by-day plan with walking times.`,
    thinking: th,
    places: resolved.map(p => ({ id: p.placeId, name: p.label, lat: p.lat, lng: p.lng })),
    itinerary: { id: itineraryId, stops },
  };
}

async function editItineraryTool(itineraryId: number, changes: string, emit: EmitFn): Promise<ToolResult> {
  const th: string[] = [];
  const modMsg = `Modifying itinerary #${itineraryId}...`;
  emit(modMsg); th.push(modMsg);

  const existing = await query(
    'SELECT ii.id, ii.stop_index, ii.label, p.name, p.id as place_id, p.lat, p.lng, p.category FROM itinerary_items ii JOIN places p ON ii.place_id = p.id WHERE ii.itinerary_id = $1 ORDER BY ii.stop_index',
    [itineraryId]
  );
  const existingStops = existing.rows;

  const t = changes.toLowerCase();
  const isAdd = t.includes('add') || t.includes('include') || t.includes('also') || t.includes('another');

  if (isAdd) {
    const stops: LLMStop[] = [{ label: changes.replace(/add|include|also|plus|another/gi, '').trim(), category: 'attraction', approx_duration_minutes: 60, notes: '' }];
    const resolved = await resolveStops(stops, 'kowloon');
    const foundMsg = `Found ${resolved.length} new place(s)`;
    emit(foundMsg); th.push(foundMsg);
    const nextIndex = existingStops.length;
    for (let i = 0; i < resolved.length; i++) {
      const p = resolved[i];
      await saveItineraryItem({ itinerary_id: itineraryId, place_id: p.placeId, stop_index: nextIndex + i, label: p.label, road_distance_meters: 0, duration_minutes: p.duration });
    }
    const allStops = await query('SELECT ii.*, p.name as place_name, p.lat, p.lng FROM itinerary_items ii JOIN places p ON ii.place_id = p.id WHERE ii.itinerary_id = $1 ORDER BY ii.stop_index', [itineraryId]);
    return {
      response: `Added to itinerary #${itineraryId}! It now has ${allStops.rows.length} stops.`,
      thinking: th,
      itinerary: { id: itineraryId, stops: allStops.rows.map((r: any) => ({ label: r.place_name, placeId: r.place_id, lat: r.lat, lng: r.lng, day: 1, distance: 0 })) },
      places: allStops.rows.map((r: any) => ({ id: r.place_id, name: r.place_name, lat: r.lat, lng: r.lng })),
    };
  }

  // Remove / modify case
  if (existingStops.length === 0) {
    return { response: `Itinerary #${itineraryId} has no stops to modify.`, thinking: th };
  }

  const ctx = existingStops.map((r: any) => `- ${r.label || r.name} (${r.category || 'unknown'})`).join('\n');
  const llmPlan = await planTrip(`[MODIFY] ${changes}\n\nCurrent stops:\n${ctx}\n\nReturn ONLY the stops that should REMAIN after the modification.`, undefined);

  if (llmPlan.stops.length === 0) {
    return { response: 'Could not understand the modification. Please be more specific.', thinking: th };
  }

  await query('DELETE FROM itinerary_items WHERE itinerary_id = $1', [itineraryId]);
  const kept = existingStops.filter((r: any) => {
    const name = (r.label || r.name || '').toLowerCase();
    return llmPlan.stops.some((s: any) => name.includes(s.label.toLowerCase()) || s.label.toLowerCase().includes(name));
  });

  if (kept.length === 0) {
    for (const p of existingStops) {
      await saveItineraryItem({ itinerary_id: itineraryId, place_id: p.place_id, stop_index: p.stop_index, label: p.label || p.name, road_distance_meters: 0, duration_minutes: 60 });
    }
    return { response: `Could not determine which stops to change. No changes made.`, thinking: th };
  }

  for (let i = 0; i < kept.length; i++) {
    const p = kept[i];
    await saveItineraryItem({ itinerary_id: itineraryId, place_id: p.place_id, stop_index: i, label: p.label || p.name, road_distance_meters: 0, duration_minutes: 60, day_number: 1 });
  }

  const removed = existingStops.length - kept.length;
  const doneMsg = removed > 0 ? `Removed ${removed} stop(s) from itinerary #${itineraryId}` : 'No changes made';
  emit(doneMsg); th.push(doneMsg);

  return {
    response: removed > 0 ? `Updated itinerary #${itineraryId}! Removed ${removed} stop(s) as requested.` : `No changes to itinerary #${itineraryId}.`,
    thinking: th,
    itinerary: { id: itineraryId, stops: kept.map((r: any) => ({ label: r.label || r.name, placeId: r.place_id, lat: r.lat, lng: r.lng, day: 1, distance: 0 })) },
  };
}

async function getItineraryTool(itineraryId: number): Promise<ToolResult> {
  const data = await getFullItinerary(itineraryId);
  if (!data) return { response: `Itinerary #${itineraryId} not found.` };

  const count = data.items.length;
  const days = count > 0 ? Math.max(...data.items.map((r: any) => r.day_number || 1)) : 1;
  const names = data.items.map((r: any) => r.label || r.place_name).join(', ');

  return {
    response: `Itinerary #${itineraryId}: ${count} stop${count === 1 ? '' : 's'} across ${days} day${days === 1 ? '' : 's'}. Stops: ${names}`,
    itinerary: { id: itineraryId, stops: data.items.map((r: any) => ({ label: r.label || r.place_name, placeId: r.place_id, lat: r.lat, lng: r.lng, day: r.day_number || 1, distance: r.road_distance_meters || 0 })) },
    places: data.items.map((r: any) => ({ id: r.place_id, name: r.label || r.place_name, lat: r.lat, lng: r.lng })),
  };
}

async function listItinerariesTool(): Promise<ToolResult> {
  const all = await query('SELECT id, user_text, created_at FROM itineraries ORDER BY created_at DESC LIMIT 20');
  const count = all.rows.length;
  if (count === 0) return { response: 'No itineraries saved yet.' };
  const list = all.rows.map((r: any) => `#${r.id}: ${(r.user_text || '').slice(0, 50)}`).join('\n');
  return { response: `You have ${count} saved itineraries:\n${list}` };
}

async function deleteItineraryTool(itineraryId: number): Promise<ToolResult> {
  const existing = await query('SELECT id FROM itineraries WHERE id=$1', [itineraryId]);
  if (existing.rows.length === 0) return { response: `Itinerary #${itineraryId} not found.` };
  await query('DELETE FROM itinerary_items WHERE itinerary_id = $1', [itineraryId]);
  await query('DELETE FROM itineraries WHERE id = $1', [itineraryId]);
  return { response: `Itinerary #${itineraryId} deleted.` };
}

async function resolveToolCoords(lat: number, lng: number, name?: string): Promise<{ lat: number; lng: number; resolvedName?: string }> {
  if (lat && lng && lat !== 0 && lng !== 0) return { lat, lng, resolvedName: '' };
  if (name) {
    const q = name.toLowerCase().replace(/^(the |a )/, '').trim();
    const rows = await query('SELECT name, lat, lng FROM places WHERE LOWER(name) LIKE $1 LIMIT 1', [`%${q}%`]);
    if (rows.rows.length > 0) return { lat: rows.rows[0].lat, lng: rows.rows[0].lng, resolvedName: rows.rows[0].name };
    const parts = q.split(/[\s,]+/);
    for (const part of parts) {
      if (part.length < 2) continue;
      const mtr = MTR_STATIONS.find(s => s.name.toLowerCase().includes(part));
      if (mtr) return { lat: mtr.lat, lng: mtr.lng, resolvedName: mtr.name };
    }
  }
  // Try to infer region from name
  const nameLower = (name || '').toLowerCase();
  if (nameLower.includes('harbour') || nameLower.includes('harbor') || nameLower.includes('central') || nameLower.includes('causeway') || nameLower.includes('wan chai') || nameLower.includes('admiralty') || nameLower.includes('happy valley') || nameLower.includes('shek o') || nameLower.includes('stanley') || nameLower.includes('repulse')) {
    return { lat: 22.28, lng: 114.16, resolvedName: name };
  }
  if (nameLower.includes('sha tin') || nameLower.includes('tai po') || nameLower.includes('tuen mun') || nameLower.includes('yuen long') || nameLower.includes('tsuen wan') || nameLower.includes('fanling') || nameLower.includes('sheung shui') || nameLower.includes('sai kung') || nameLower.includes('kwai')) {
    return { lat: 22.38, lng: 114.18, resolvedName: name };
  }
  if (nameLower.includes('disney') || nameLower.includes('airport') || nameLower.includes('tung chung') || nameLower.includes('lantau')) {
    return { lat: 22.30, lng: 113.95, resolvedName: name };
  }
  return { lat: 22.319, lng: 114.170, resolvedName: 'Kowloon center' };
}

const SPEED_MULTIPLIERS: Record<string, number> = {
  wheelchair: 0.5, cane: 0.6, slow: 0.4, hearing_impaired: 0.9, visually_impaired: 0.7,
};

async function getSpeedMultiplier(): Promise<number> {
  try {
    const prefs = await getGlobalPreferences();
    return SPEED_MULTIPLIERS[prefs.mobility] || 1.0;
  } catch {
    return 1.0;
  }
}

async function routeDistanceTool(fromLat: number, fromLng: number, toLat: number, toLng: number, fromName?: string, toName?: string): Promise<ToolResult> {
  const from = await resolveToolCoords(fromLat, fromLng, fromName);
  const to = await resolveToolCoords(toLat, toLng, toName);
  const route = await getRoute(from.lat, from.lng, to.lat, to.lng);
  const multiplier = await getSpeedMultiplier();
  const min = Math.round(route.duration_seconds / 60 / multiplier);
  const km = (route.distance_meters / 1000).toFixed(1);
  return { response: `Walking distance: ${km} km (approx ${min} min).` };
}

async function resolvePlaceName(name: string): Promise<{ name: string; lat: number; lng: number }> {
  if (!name) return { name: 'location', lat: 22.319, lng: 114.170 };
  const rows = await query('SELECT name, lat, lng FROM places WHERE LOWER(name) LIKE $1 LIMIT 1', [`%${name.toLowerCase()}%`]);
  if (rows.rows.length > 0) return rows.rows[0];
  const mtr = MTR_STATIONS.find(s => name.toLowerCase().includes(s.name.toLowerCase()));
  if (mtr) return { name: mtr.name, lat: mtr.lat, lng: mtr.lng };
  return { name, lat: 22.319, lng: 114.170 };
}

async function findTransportTool(fromName: string, fromLat: number, fromLng: number, toName: string, toLat: number, toLng: number): Promise<ToolResult> {
  const from = await resolvePlaceName(fromName || '');
  const to = await resolvePlaceName(toName || '');
  const walking = await getRoute(from.lat, from.lng, to.lat, to.lng);
  const walkMin = Math.round(walking.duration_seconds / 60);

  if (walkMin <= 10) {
    return {
      response: `Walking from ${from.name} to ${to.name} takes only ${walkMin} min (${(walking.distance_meters / 1000).toFixed(1)} km). Walking is the best option.`,
    };
  }

  const nearestFrom = findNearestMtr(from.lat, from.lng);
  const nearestTo = findNearestMtr(to.lat, to.lng);
  const walkToStation = nearestFrom ? Math.round(haversineMeters(from.lat, from.lng, nearestFrom.lat, nearestFrom.lng) / 80) : 0;
  const walkFromStation = nearestTo ? Math.round(haversineMeters(to.lat, to.lng, nearestTo.lat, nearestTo.lng) / 80) : 0;
  const mtrTime = nearestFrom && nearestTo ? estimateMtrTime(nearestFrom.name, nearestTo.name) : 0;
  const totalMtr = walkToStation + mtrTime + walkFromStation;

  let response = `Walking from ${from.name} to ${to.name} takes ${walkMin} min. `;
  if (nearestFrom && nearestTo && totalMtr > 0) {
    const fromAccessible = isMTRStationAccessible(nearestFrom.name);
    const toAccessible = isMTRStationAccessible(nearestTo.name);
    const accNote = (fromAccessible && toAccessible)
      ? 'Both MTR stations have elevator access ✅'
      : (!fromAccessible ? `${nearestFrom.name} station may not have elevator access ⚠️. ` : '')
        + (!toAccessible ? `${nearestTo.name} station may not have elevator access ⚠️. ` : '');
    response += `MTR: walk ${walkToStation} min to ${nearestFrom.name}, ~${mtrTime} min to ${nearestTo.name}, walk ${walkFromStation} min to destination. Total: ~${totalMtr} min. ${accNote}`;
  } else {
    response += `Walking is the only option available.`;
  }
  return { response };
}

async function getTravelTimeTool(fromLat: number, fromLng: number, toLat: number, toLng: number, mode: string, fromName?: string, toName?: string): Promise<ToolResult> {
  const from = await resolveToolCoords(fromLat, fromLng, fromName);
  const to = await resolveToolCoords(toLat, toLng, toName);
  if (mode === 'walking') {
    const route = await getRoute(from.lat, from.lng, to.lat, to.lng);
    const min = Math.round(route.duration_seconds / 60);
    return { response: `Walking: ${min} min (${(route.distance_meters / 1000).toFixed(1)} km).` };
  }
  const nearestFrom = findNearestMtr(from.lat, from.lng);
  const nearestTo = findNearestMtr(to.lat, to.lng);
  if (!nearestFrom || !nearestTo) {
    const route = await getRoute(from.lat, from.lng, to.lat, to.lng);
    return { response: `No MTR nearby. Walking: ${Math.round(route.duration_seconds / 60)} min.` };
  }
  const w1 = Math.round(haversineMeters(from.lat, from.lng, nearestFrom.lat, nearestFrom.lng) / 80);
  const mtr = estimateMtrTime(nearestFrom.name, nearestTo.name);
  const w2 = Math.round(haversineMeters(to.lat, to.lng, nearestTo.lat, nearestTo.lng) / 80);
  return { response: `Transit via MTR: walk ${w1} min → ${nearestFrom.name} → ${mtr} min MTR → ${nearestTo.name} → walk ${w2} min. Total: ~${w1 + mtr + w2} min.` };
}

async function optimizeRouteTool(stops: Array<{ name: string; lat: number; lng: number }>): Promise<ToolResult> {
  if (stops.length <= 1) return { response: 'Need at least 2 stops to optimize.' };
  const ordered = nearestNeighborReorder(stops);
  const order = ordered.map((s, i) => `${i + 1}. ${s.name}`).join(' → ');
  return { response: `Optimized route: ${order}` };
}

async function searchDatabaseTool(query_text: string): Promise<ToolResult> {
  const t = query_text.toLowerCase();
  const rows = await query(
    `SELECT DISTINCT p.id, p.name, p.category, p.lat, p.lng 
     FROM places p 
     WHERE LOWER(p.name) LIKE $1 OR LOWER(p.category) LIKE $1 
     LIMIT 20`,
    [`%${t}%`]
  );
  if (rows.rows.length === 0) return { response: `No places found matching "${query_text}" in the database.` };
  const names = rows.rows.map((r: any) => `${r.name} (${r.category || 'unknown'})`).join(', ');
  return { response: `Found ${rows.rows.length} place(s): ${names}`, places: rows.rows };
}

async function getPlaceAlternativesTool(placeName: string, _reason: string, category?: string): Promise<ToolResult> {
  const t = placeName.toLowerCase();
  const rows = await query(
    `SELECT id, name, category, lat, lng 
     FROM places 
     WHERE LOWER(name) != $1 AND (LOWER(category) = $2 OR $2 IS NULL)
     ORDER BY RANDOM() LIMIT 5`,
    [t, category || null]
  );
  if (rows.rows.length === 0) {
    return searchDatabaseTool(category || 'attraction');
  }
  const names = rows.rows.map((r: any) => `${r.name} (${r.category || 'unknown'})`).join(', ');
  return {
    response: `Here are some alternatives instead of "${placeName}": ${names}`,
    places: rows.rows,
  };
}

async function checkAccessibilityTool(placeName: string): Promise<ToolResult> {
  const info = await getAccessibility(placeName);
  let response = `Accessibility for ${info.placeName}:\n`;
  response += `- Wheelchair access: ${info.wheelchair}\n`;
  if (info.stepFreeEntrance) response += '- Step-free entrance: ✅\n';
  if (info.accessibleToilet) response += '- Accessible toilet: ✅\n';
  if (info.elevator) response += '- Elevator/lift: ✅\n';
  if (info.tactilePaving) response += '- Tactile paving: ✅\n';
  if (info.tags.length > 0) response += `- Tags: ${info.tags.join(', ')}\n`;
  if (info.notes) response += info.notes;
  return { response };
}

function normalizeMobility(v: string): string {
  const m = v.toLowerCase();
  if (['wheelchair', 'cane', 'slow', 'fast', 'hearing_impaired', 'visually_impaired'].includes(m)) return m;
  if (m.includes('wheelchair') || m.includes('chair')) return 'wheelchair';
  if (m.includes('cane') || m.includes('stick') || m.includes('limited') || m.includes('difficult')) return 'cane';
  if (m.includes('slow') || m.includes('elderly') || m.includes('old')) return 'slow';
  if (m.includes('fast') || m.includes('athlete') || m.includes('good')) return 'fast';
  if (m.includes('hear') || m.includes('deaf')) return 'hearing_impaired';
  if (m.includes('vis') || m.includes('blind') || m.includes('sight')) return 'visually_impaired';
  return '';
}

async function setPreferencesTool(args: any, emit: EmitFn): Promise<ToolResult> {
  const mobility = firstOf(args, 'mobility', 'speed') || '';
  const normalized = mobility ? normalizeMobility(mobility) : '';
  const changes: Record<string, string | string[]> = {};
  if (normalized) changes.mobility = normalized;
  if (Array.isArray(args.interests) && args.interests.length > 0) changes.interests = args.interests;
  if (args.budget_level || args.budget) {
    const budgetMap: Record<string, string> = { cheap: 'cheap', moderate: 'medium', medium: 'medium', expensive: 'expensive' };
    changes.budget_level = budgetMap[(args.budget_level || args.budget || '').toLowerCase()] || 'medium';
  }
  if (args.home_base) changes.home_base = args.home_base;

  if (Object.keys(changes).length === 0) {
    return { response: 'I didn\'t catch any preferences to save. You can tell me about your mobility, interests, budget, or where you\'re staying.' };
  }

  await setGlobalPreferences(changes);
  const prefs = await getGlobalPreferences();
  const parts: string[] = [];
  if (prefs.mobility !== 'none') parts.push(`mobility: ${prefs.mobility}`);
  if (prefs.interests.length > 0) parts.push(`interests: ${prefs.interests.join(', ')}`);
  if (prefs.budget_level && prefs.budget_level !== 'medium') parts.push(`budget: ${prefs.budget_level}`);
  if (prefs.home_base) parts.push(`staying in: ${prefs.home_base}`);

  emit('Saved your preferences!');
  return { response: `I've saved your preferences: ${parts.join('; ')}. I'll use these to tailor recommendations going forward.` };
}

// ── MTR station data for HK ──

interface MtrStation { name: string; lat: number; lng: number; line: string; zone: string }
const MTR_STATIONS: MtrStation[] = [
  // ── Tsuen Wan Line (9 existing + 5 new = 14) ──
  { name: 'Tsim Sha Tsui', lat: 22.2978, lng: 114.1721, line: 'Tsuen Wan', zone: 'kowloon' },
  { name: 'Jordan', lat: 22.3051, lng: 114.1693, line: 'Tsuen Wan', zone: 'kowloon' },
  { name: 'Yau Ma Tei', lat: 22.3129, lng: 114.1713, line: 'Tsuen Wan', zone: 'kowloon' },
  { name: 'Mong Kok', lat: 22.3186, lng: 114.1700, line: 'Tsuen Wan', zone: 'kowloon' },
  { name: 'Prince Edward', lat: 22.3250, lng: 114.1700, line: 'Tsuen Wan', zone: 'kowloon' },
  { name: 'Sham Shui Po', lat: 22.3300, lng: 114.1620, line: 'Tsuen Wan', zone: 'kowloon' },
  { name: 'Cheung Sha Wan', lat: 22.3360, lng: 114.1550, line: 'Tsuen Wan', zone: 'kowloon' },
  { name: 'Lai Chi Kok', lat: 22.3400, lng: 114.1480, line: 'Tsuen Wan', zone: 'kowloon' },
  { name: 'Mei Foo', lat: 22.3370, lng: 114.1400, line: 'Tsuen Wan', zone: 'kowloon' },
  { name: 'Lai King', lat: 22.3470, lng: 114.1300, line: 'Tsuen Wan', zone: 'kowloon' },
  { name: 'Kwai Fong', lat: 22.3570, lng: 114.1270, line: 'Tsuen Wan', zone: 'new_territories' },
  { name: 'Kwai Hing', lat: 22.3620, lng: 114.1300, line: 'Tsuen Wan', zone: 'new_territories' },
  { name: 'Tai Wo Hau', lat: 22.3720, lng: 114.1280, line: 'Tsuen Wan', zone: 'new_territories' },
  { name: 'Tsuen Wan', lat: 22.3740, lng: 114.1150, line: 'Tsuen Wan', zone: 'new_territories' },

  // ── Island Line (12 new) ──
  { name: 'Admiralty', lat: 22.2790, lng: 114.1630, line: 'Island', zone: 'hong_kong_island' },
  { name: 'Wan Chai', lat: 22.2760, lng: 114.1720, line: 'Island', zone: 'hong_kong_island' },
  { name: 'Causeway Bay', lat: 22.2800, lng: 114.1830, line: 'Island', zone: 'hong_kong_island' },
  { name: 'Tin Hau', lat: 22.2830, lng: 114.1910, line: 'Island', zone: 'hong_kong_island' },
  { name: 'Fortress Hill', lat: 22.2870, lng: 114.1940, line: 'Island', zone: 'hong_kong_island' },
  { name: 'North Point', lat: 22.2900, lng: 114.2000, line: 'Island', zone: 'hong_kong_island' },
  { name: 'Quarry Bay', lat: 22.2880, lng: 114.2100, line: 'Island', zone: 'hong_kong_island' },
  { name: 'Tai Koo', lat: 22.2850, lng: 114.2180, line: 'Island', zone: 'hong_kong_island' },
  { name: 'Sai Wan Ho', lat: 22.2820, lng: 114.2230, line: 'Island', zone: 'hong_kong_island' },
  { name: 'Shau Kei Wan', lat: 22.2790, lng: 114.2290, line: 'Island', zone: 'hong_kong_island' },
  { name: 'Heng Fa Chuen', lat: 22.2760, lng: 114.2400, line: 'Island', zone: 'hong_kong_island' },
  { name: 'Chai Wan', lat: 22.2720, lng: 114.2480, line: 'Island', zone: 'hong_kong_island' },

  // ── East Rail Line (1 existing + 9 new = 10) ──
  { name: 'Kowloon Tong', lat: 22.3370, lng: 114.1750, line: 'East Rail', zone: 'kowloon' },
  { name: 'Exhibition Centre', lat: 22.2830, lng: 114.1750, line: 'East Rail', zone: 'hong_kong_island' },
  { name: 'Mong Kok East', lat: 22.3220, lng: 114.1770, line: 'East Rail', zone: 'kowloon' },
  { name: 'Tai Wai', lat: 22.3740, lng: 114.1800, line: 'East Rail', zone: 'new_territories' },
  { name: 'Sha Tin', lat: 22.3830, lng: 114.1880, line: 'East Rail', zone: 'new_territories' },
  { name: 'Fo Tan', lat: 22.3950, lng: 114.1950, line: 'East Rail', zone: 'new_territories' },
  { name: 'University', lat: 22.4130, lng: 114.2100, line: 'East Rail', zone: 'new_territories' },
  { name: 'Tai Po Market', lat: 22.4450, lng: 114.1700, line: 'East Rail', zone: 'new_territories' },
  { name: 'Sheung Shui', lat: 22.5020, lng: 114.1280, line: 'East Rail', zone: 'new_territories' },
  { name: 'Fanling', lat: 22.4930, lng: 114.1400, line: 'East Rail', zone: 'new_territories' },

  // ── Tuen Ma Line (7 existing + 7 new = 14) ──
  { name: 'East Tsim Sha Tsui', lat: 22.2940, lng: 114.1760, line: 'Tuen Ma', zone: 'kowloon' },
  { name: 'Hung Hom', lat: 22.3010, lng: 114.1860, line: 'Tuen Ma', zone: 'kowloon' },
  { name: 'Ho Man Tin', lat: 22.3100, lng: 114.1880, line: 'Tuen Ma', zone: 'kowloon' },
  { name: 'To Kwa Wan', lat: 22.3180, lng: 114.1900, line: 'Tuen Ma', zone: 'kowloon' },
  { name: 'Kai Tak', lat: 22.3260, lng: 114.1950, line: 'Tuen Ma', zone: 'kowloon' },
  { name: 'Diamond Hill', lat: 22.3410, lng: 114.2050, line: 'Tuen Ma', zone: 'kowloon' },
  { name: 'Austin', lat: 22.3020, lng: 114.1660, line: 'Tuen Ma', zone: 'kowloon' },
  { name: 'Tuen Mun', lat: 22.3940, lng: 113.9750, line: 'Tuen Ma', zone: 'new_territories' },
  { name: 'Siu Hong', lat: 22.4000, lng: 113.9700, line: 'Tuen Ma', zone: 'new_territories' },
  { name: 'Tin Shui Wai', lat: 22.4550, lng: 114.0020, line: 'Tuen Ma', zone: 'new_territories' },
  { name: 'Long Ping', lat: 22.4500, lng: 114.0250, line: 'Tuen Ma', zone: 'new_territories' },
  { name: 'Yuen Long', lat: 22.4450, lng: 114.0350, line: 'Tuen Ma', zone: 'new_territories' },
  { name: 'Tsuen Wan West', lat: 22.3680, lng: 114.1070, line: 'Tuen Ma', zone: 'new_territories' },
  { name: 'Nam Cheong', lat: 22.3260, lng: 114.1550, line: 'Tuen Ma', zone: 'kowloon' },

  // ── Kwun Tong Line (7 existing + 5 new = 12) ──
  { name: 'Lok Fu', lat: 22.3370, lng: 114.1880, line: 'Kwun Tong', zone: 'kowloon' },
  { name: 'Wong Tai Sin', lat: 22.3420, lng: 114.1940, line: 'Kwun Tong', zone: 'kowloon' },
  { name: 'Ngau Chi Wan', lat: 22.3390, lng: 114.2020, line: 'Kwun Tong', zone: 'kowloon' },
  { name: 'Kwun Tong', lat: 22.3120, lng: 114.2250, line: 'Kwun Tong', zone: 'kowloon' },
  { name: 'Ngau Tau Kok', lat: 22.3170, lng: 114.2180, line: 'Kwun Tong', zone: 'kowloon' },
  { name: 'Kowloon Bay', lat: 22.3240, lng: 114.2110, line: 'Kwun Tong', zone: 'kowloon' },
  { name: 'Choi Hung', lat: 22.3340, lng: 114.2100, line: 'Kwun Tong', zone: 'kowloon' },
  { name: 'Lam Tin', lat: 22.3140, lng: 114.2360, line: 'Kwun Tong', zone: 'kowloon' },
  { name: 'Yau Tong', lat: 22.2970, lng: 114.2410, line: 'Kwun Tong', zone: 'kowloon' },

  // ── Tseung Kwan O Line (5 new) ──
  { name: 'Tseung Kwan O', lat: 22.3090, lng: 114.2600, line: 'Tseung Kwan O', zone: 'new_territories' },
  { name: 'Ti Keng Leng', lat: 22.3040, lng: 114.2530, line: 'Tseung Kwan O', zone: 'new_territories' },
  { name: 'Hang Hau', lat: 22.3170, lng: 114.2700, line: 'Tseung Kwan O', zone: 'new_territories' },
  { name: 'Po Lam', lat: 22.3250, lng: 114.2780, line: 'Tseung Kwan O', zone: 'new_territories' },
  { name: 'LOHAS Park', lat: 22.2930, lng: 114.2720, line: 'Tseung Kwan O', zone: 'new_territories' },

  // ── Tung Chung Line (5 new) ──
  { name: 'Hong Kong', lat: 22.2850, lng: 114.1580, line: 'Tung Chung', zone: 'hong_kong_island' },
  { name: 'Kowloon', lat: 22.3040, lng: 114.1620, line: 'Tung Chung', zone: 'kowloon' },
  { name: 'Olympic', lat: 22.3170, lng: 114.1600, line: 'Tung Chung', zone: 'kowloon' },
  { name: 'Tsing Yi', lat: 22.3540, lng: 114.1080, line: 'Tung Chung', zone: 'new_territories' },
  { name: 'Tung Chung', lat: 22.2880, lng: 113.9400, line: 'Tung Chung', zone: 'new_territories' },

  // ── South Island Line (4 new) ──
  { name: 'Ocean Park', lat: 22.2470, lng: 114.1760, line: 'South Island', zone: 'hong_kong_island' },
  { name: 'Wong Chuk Hang', lat: 22.2480, lng: 114.1750, line: 'South Island', zone: 'hong_kong_island' },
  { name: 'Lei Tung', lat: 22.2440, lng: 114.1530, line: 'South Island', zone: 'hong_kong_island' },
  { name: 'South Horizons', lat: 22.2420, lng: 114.1490, line: 'South Island', zone: 'hong_kong_island' },

  // ── Disneyland Resort Line (1 new) ──
  { name: 'Disneyland Resort', lat: 22.3120, lng: 114.0430, line: 'Disney', zone: 'new_territories' },

  // ── Airport Express (2 new) ──
  { name: 'Airport', lat: 22.3150, lng: 113.9350, line: 'Airport Express', zone: 'new_territories' },
  { name: 'AsiaWorld Expo', lat: 22.3210, lng: 113.9400, line: 'Airport Express', zone: 'new_territories' },
];

function findNearestMtr(lat: number, lng: number): MtrStation | null {
  let best: MtrStation | null = null;
  let bestDist = Infinity;
  for (const s of MTR_STATIONS) {
    const d = Math.sqrt((lat - s.lat) ** 2 + (lng - s.lng) ** 2);
    if (d < bestDist) { bestDist = d; best = s; }
  }
  return bestDist < 0.02 ? best : null;
}

const MTR_TRAVEL_TIMES: Record<string, Record<string, number>> = {
  // Tsuen Wan Line
  'Tsim Sha Tsui': { 'Jordan': 2, 'Yau Ma Tei': 3, 'Mong Kok': 5, 'Prince Edward': 6, 'Sham Shui Po': 8, 'Cheung Sha Wan': 9, 'Lai Chi Kok': 11, 'Mei Foo': 12, 'Lai King': 14, 'Kwai Fong': 16, 'Kwai Hing': 17, 'Tai Wo Hau': 18, 'Tsuen Wan': 20, 'East Tsim Sha Tsui': 3, 'Hung Hom': 5, 'Kowloon Tong': 10, 'Austin': 2, 'Admiralty': 6, 'Wan Chai': 8, 'Causeway Bay': 10, 'Hong Kong': 4, 'Kowloon': 3 },
  'Jordan': { 'Tsim Sha Tsui': 2, 'Yau Ma Tei': 2, 'Mong Kok': 3, 'Prince Edward': 5, 'East Tsim Sha Tsui': 4, 'Austin': 3, 'Kowloon': 2, 'Hong Kong': 5, 'Admiralty': 7 },
  'Yau Ma Tei': { 'Tsim Sha Tsui': 3, 'Jordan': 2, 'Mong Kok': 2, 'Prince Edward': 3, 'East Tsim Sha Tsui': 5, 'Austin': 4, 'Mong Kok East': 4, 'Kowloon': 2 },
  'Mong Kok': { 'Tsim Sha Tsui': 5, 'Jordan': 3, 'Yau Ma Tei': 2, 'Prince Edward': 2, 'Sham Shui Po': 3, 'Kowloon Tong': 6, 'Mong Kok East': 2, 'Lok Fu': 5, 'Kowloon Bay': 8 },
  'Prince Edward': { 'Tsim Sha Tsui': 6, 'Mong Kok': 2, 'Sham Shui Po': 2, 'Kowloon Tong': 5, 'Lok Fu': 6, 'Diamond Hill': 8, 'Mong Kok East': 4 },
  'Sham Shui Po': { 'Cheung Sha Wan': 2, 'Lai Chi Kok': 3, 'Mei Foo': 5, 'Prince Edward': 2, 'Mong Kok': 3, 'Nam Cheong': 2 },
  'Lai King': { 'Mei Foo': 2, 'Kwai Fong': 2, 'Kwai Hing': 3, 'Tai Wo Hau': 4, 'Tsuen Wan': 5, 'Nam Cheong': 3, 'Tsing Yi': 4 },
  'Tsuen Wan': { 'Tai Wo Hau': 2, 'Kwai Hing': 3, 'Kwai Fong': 4, 'Lai King': 5, 'Mei Foo': 7, 'Tsuen Wan West': 3 },

  // Tuen Ma Line
  'East Tsim Sha Tsui': { 'Tsim Sha Tsui': 3, 'Hung Hom': 2, 'Austin': 3, 'Ho Man Tin': 4, 'Kai Tak': 8 },
  'Hung Hom': { 'East Tsim Sha Tsui': 2, 'Ho Man Tin': 3, 'Kowloon Tong': 5, 'Tsim Sha Tsui': 5, 'Austin': 3, 'Exhibition Centre': 4, 'Admiralty': 6 },
  'Ho Man Tin': { 'Hung Hom': 3, 'To Kwa Wan': 2, 'Kai Tak': 3, 'Kowloon Tong': 4, 'Diamond Hill': 5 },
  'Kai Tak': { 'Ho Man Tin': 3, 'To Kwa Wan': 2, 'Diamond Hill': 3, 'Kowloon Bay': 5 },
  'Diamond Hill': { 'Kai Tak': 3, 'Kowloon Tong': 4, 'Choi Hung': 2, 'Wong Tai Sin': 2, 'Ngau Chi Wan': 3, 'Ho Man Tin': 5, 'Sha Tin': 8, 'Tai Wai': 6 },
  'Tuen Mun': { 'Siu Hong': 2, 'Tin Shui Wai': 6, 'Long Ping': 8, 'Yuen Long': 10, 'Kam Sheung Road': 13, 'Tsuen Wan West': 18, 'Nam Cheong': 25, 'Austin': 28, 'Hung Hom': 32 },
  'Yuen Long': { 'Long Ping': 2, 'Tin Shui Wai': 4, 'Siu Hong': 8, 'Tuen Mun': 10, 'Kam Sheung Road': 3, 'Tsuen Wan West': 10 },
  'Tsuen Wan West': { 'Kam Sheung Road': 5, 'Yuen Long': 10, 'Nam Cheong': 7, 'Austin': 10, 'Hung Hom': 12, 'Tsuen Wan': 3 },
  'Nam Cheong': { 'Mei Foo': 2, 'Lai King': 3, 'Olympic': 3, 'Kowloon': 5, 'Tsuen Wan West': 7, 'Austin': 4, 'Sham Shui Po': 2 },

  // East Rail Line
  'Kowloon Tong': { 'Mong Kok': 6, 'Prince Edward': 5, 'Lok Fu': 3, 'Diamond Hill': 5, 'Ho Man Tin': 4, 'Tai Wai': 4, 'Sha Tin': 7, 'Mong Kok East': 3, 'Hung Hom': 5, 'Exhibition Centre': 8, 'Admiralty': 10 },
  'Tai Wai': { 'Kowloon Tong': 4, 'Sha Tin': 3, 'Diamond Hill': 6, 'Fo Tan': 5, 'University': 8 },
  'Sha Tin': { 'Tai Wai': 3, 'Fo Tan': 3, 'Kowloon Tong': 7, 'University': 5, 'Tai Po Market': 10, 'Fanling': 15, 'Sheung Shui': 16 },
  'University': { 'Sha Tin': 5, 'Fo Tan': 3, 'Tai Po Market': 5, 'Tai Wai': 8 },
  'Tai Po Market': { 'University': 5, 'Fanling': 7, 'Sheung Shui': 8, 'Sha Tin': 10 },
  'Fanling': { 'Sheung Shui': 2, 'Tai Po Market': 7, 'Sha Tin': 15, 'Kowloon Tong': 22 },
  'Exhibition Centre': { 'Admiralty': 2, 'Hung Hom': 4, 'Kowloon Tong': 8, 'Mong Kok East': 6 },

  // Island Line
  'Admiralty': { 'Wan Chai': 2, 'Causeway Bay': 4, 'Tin Hau': 6, 'Fortress Hill': 7, 'North Point': 9, 'Hong Kong': 3, 'Tsim Sha Tsui': 6, 'Exhibition Centre': 2, 'Ocean Park': 5 },
  'Wan Chai': { 'Admiralty': 2, 'Causeway Bay': 2, 'Tin Hau': 4, 'Fortress Hill': 5, 'North Point': 7, 'Tsim Sha Tsui': 8 },
  'Causeway Bay': { 'Wan Chai': 2, 'Tin Hau': 2, 'Admiralty': 4, 'Fortress Hill': 3, 'North Point': 5, 'Tsim Sha Tsui': 10 },
  'North Point': { 'Fortress Hill': 2, 'Tin Hau': 3, 'Causeway Bay': 5, 'Quarry Bay': 2, 'Tai Koo': 4, 'Sai Wan Ho': 6, 'Shau Kei Wan': 7, 'Heng Fa Chuen': 10, 'Chai Wan': 12, 'Tseung Kwan O': 10, 'Ti Keng Leng': 12 },
  'Quarry Bay': { 'North Point': 2, 'Tai Koo': 2, 'Sai Wan Ho': 4, 'Tseung Kwan O': 8, 'Yau Tong': 6 },
  'Tai Koo': { 'Quarry Bay': 2, 'Sai Wan Ho': 2, 'Shau Kei Wan': 3 },
  'Chai Wan': { 'Heng Fa Chuen': 2, 'Shau Kei Wan': 4, 'Sai Wan Ho': 5 },

  // Kwun Tong Line
  'Lok Fu': { 'Wong Tai Sin': 2, 'Kowloon Tong': 3, 'Diamond Hill': 3, 'Prince Edward': 6, 'Ngau Chi Wan': 2 },
  'Wong Tai Sin': { 'Lok Fu': 2, 'Diamond Hill': 2, 'Ngau Chi Wan': 2, 'Choi Hung': 3 },
  'Ngau Tau Kok': { 'Kwun Tong': 2, 'Kowloon Bay': 2, 'Ngau Chi Wan': 3, 'Lam Tin': 3 },
  'Kwun Tong': { 'Ngau Tau Kok': 2, 'Lam Tin': 3, 'Kowloon Bay': 3, 'Yau Tong': 5 },
  'Lam Tin': { 'Kwun Tong': 3, 'Yau Tong': 2, 'Ngau Tau Kok': 3, 'Tseung Kwan O': 6 },
  'Yau Tong': { 'Lam Tin': 2, 'Kwun Tong': 5, 'Tseung Kwan O': 4, 'Ti Keng Leng': 3, 'Quarry Bay': 6 },

  // Tseung Kwan O Line
  'Tseung Kwan O': { 'Ti Keng Leng': 2, 'Hang Hau': 3, 'Po Lam': 5, 'LOHAS Park': 4, 'Lam Tin': 6, 'Yau Tong': 4, 'North Point': 10, 'Quarry Bay': 8 },
  'Hang Hau': { 'Po Lam': 3, 'Tseung Kwan O': 3, 'Ti Keng Leng': 4, 'LOHAS Park': 5 },

  // Tung Chung Line
  'Hong Kong': { 'Kowloon': 3, 'Olympic': 5, 'Nam Cheong': 7, 'Lai King': 10, 'Tsing Yi': 12, 'Sunny Bay': 18, 'Tung Chung': 22, 'Airport': 20, 'Tsim Sha Tsui': 4, 'Admiralty': 3 },
  'Kowloon': { 'Hong Kong': 3, 'Olympic': 2, 'Nam Cheong': 4, 'Austin': 2, 'Jordan': 2, 'Tsim Sha Tsui': 3 },
  'Olympic': { 'Kowloon': 2, 'Nam Cheong': 3, 'Hong Kong': 5, 'Tai Kok Tsui': 2 },
  'Tsing Yi': { 'Lai King': 4, 'Sunny Bay': 6, 'Tung Chung': 10, 'Nam Cheong': 5, 'Airport': 8, 'Tsuen Wan': 5 },

  // South Island Line
  'Ocean Park': { 'Admiralty': 5, 'Wong Chuk Hang': 2, 'Lei Tung': 4, 'South Horizons': 6 },

  // Airport Express
  'Airport': { 'Tsing Yi': 8, 'Kowloon': 15, 'Hong Kong': 18, 'AsiaWorld Expo': 2, 'Tung Chung': 5 },
  'AsiaWorld Expo': { 'Airport': 2, 'Tsing Yi': 10, 'Tung Chung': 5 },

  // Interchange hubs
  'Austin': { 'Tsim Sha Tsui': 2, 'East Tsim Sha Tsui': 3, 'Hung Hom': 3, 'Kowloon': 2, 'Nam Cheong': 4, 'Jordan': 3 },
};

function estimateMtrTime(from: string, to: string): number {
  if (from === to) return 0;
  const direct = MTR_TRAVEL_TIMES[from]?.[to];
  if (direct) return direct;
  const reverse = MTR_TRAVEL_TIMES[to]?.[from];
  if (reverse) return reverse;
  const commonStations = ['Mong Kok', 'Prince Edward', 'Kowloon Tong', 'Hung Hom', 'Admiralty', 'Nam Cheong', 'North Point'];
  for (const mid of commonStations) {
    const a = MTR_TRAVEL_TIMES[from]?.[mid] || MTR_TRAVEL_TIMES[mid]?.[from];
    const b = MTR_TRAVEL_TIMES[mid]?.[to] || MTR_TRAVEL_TIMES[to]?.[mid];
    if (a && b) return a + b;
  }
  return 20;
}

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return haversineMeters(lat1, lng1, lat2, lng2) / 1000;
}

function firstOf(args: any, ...keys: string[]): any {
  for (const k of keys) {
    const v = args[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

// ── Main dispatcher ──

export async function executeTool(name: string, args: any, emit: EmitFn): Promise<ToolResult> {
  emit(`Running tool: ${name}`);
  switch (name) {
    case 'search_places':
      return searchPlaces(firstOf(args, 'query', 'category', 'interest', 'keywords', 'name', 'q') || '',
        firstOf(args, 'region', 'area') || '',
        firstOf(args, 'budget', 'price', 'cost') || '',
        emit);
    case 'create_itinerary':
      return createItineraryTool(
        parseInt(firstOf(args, 'days', 'num_days', 'number_of_days')) || 1,
        firstOf(args, 'preferences', 'preference', 'interests', 'interest', 'theme', 'description') || 'general Kowloon trip',
        emit,
        firstOf(args, 'existing_itinerary_id', 'itinerary_id'),
        firstOf(args, 'region', 'area') || 'kowloon'
      );
    case 'edit_itinerary': return editItineraryTool(
      firstOf(args, 'itinerary_id', 'id'),
      firstOf(args, 'changes', 'action', 'modification', 'stops', 'modifications') || '',
      emit
    );
    case 'get_itinerary': return getItineraryTool(firstOf(args, 'itinerary_id', 'id', 'trip_id'));
    case 'list_itineraries': return listItinerariesTool();
    case 'delete_itinerary': return deleteItineraryTool(firstOf(args, 'itinerary_id', 'id'));
    case 'route_distance':
      return routeDistanceTool(
        parseFloat(firstOf(args, 'from_lat', 'origin_lat', 'lat1')) || 0,
        parseFloat(firstOf(args, 'from_lng', 'origin_lng', 'lng1')) || 0,
        parseFloat(firstOf(args, 'to_lat', 'dest_lat', 'lat2')) || 0,
        parseFloat(firstOf(args, 'to_lng', 'dest_lng', 'lng2')) || 0,
        firstOf(args, 'from_name', 'origin', 'from'),
        firstOf(args, 'to_name', 'destination', 'to')
      );
    case 'find_transport':
      return findTransportTool(
        firstOf(args, 'from_name', 'origin', 'from'),
        parseFloat(firstOf(args, 'from_lat', 'origin_lat')) || 0,
        parseFloat(firstOf(args, 'from_lng', 'origin_lng')) || 0,
        firstOf(args, 'to_name', 'destination', 'to'),
        parseFloat(firstOf(args, 'to_lat', 'dest_lat')) || 0,
        parseFloat(firstOf(args, 'to_lng', 'dest_lng')) || 0
      );
    case 'get_travel_time':
      return getTravelTimeTool(
        parseFloat(firstOf(args, 'from_lat', 'origin_lat')) || 0,
        parseFloat(firstOf(args, 'from_lng', 'origin_lng')) || 0,
        parseFloat(firstOf(args, 'to_lat', 'dest_lat')) || 0,
        parseFloat(firstOf(args, 'to_lng', 'dest_lng')) || 0,
        firstOf(args, 'mode', 'transport', 'method') || 'walking',
        firstOf(args, 'from_name', 'origin', 'from'),
        firstOf(args, 'to_name', 'destination', 'to')
      );
    case 'optimize_route': return optimizeRouteTool(firstOf(args, 'stops', 'waypoints', 'places'));
    case 'search_database': return searchDatabaseTool(firstOf(args, 'query', 'q', 'search', 'term'));
    case 'get_place_alternatives':
      return getPlaceAlternativesTool(
        firstOf(args, 'place_name', 'name', 'place'),
        firstOf(args, 'reason', 'why', 'issue'),
        firstOf(args, 'category', 'type', 'kind')
      );
    case 'check_accessibility':
      return checkAccessibilityTool(firstOf(args, 'place_name', 'name', 'place', 'location', 'query', 'q'));
    case 'set_preferences':
      return setPreferencesTool(args, emit);
    default: return { response: `Unknown tool: ${name}` };
  }
}
