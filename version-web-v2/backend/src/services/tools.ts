import { query, saveItinerary, saveItineraryItem, getFullItinerary } from '../db/client';
import { resolveStops } from './placeResolver';
import { getRoute } from './routingService';
import { planTrip } from './llmGateway';
import { getAccessibility } from './accessibilityService';
import { searchBySemantic } from './ragService';
import { setGlobalPreferences, getGlobalPreferences } from './globalPreferencesService';
import { LLMStop } from '../types';

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
      const d = Math.sqrt((last.lat - stops[i].lat) ** 2 + (last.lng - stops[i].lng) ** 2);
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

  const t = query_text.toLowerCase();
  const categories: string[] = [];
  if (t.includes('museum')) categories.push('museum');
  if (t.includes('cafe') || t.includes('coffee')) categories.push('cafe');
  if (t.includes('restaurant') || t.includes('food') || t.includes('eat')) categories.push('restaurant');
  if (t.includes('park') || t.includes('garden') || t.includes('nature')) categories.push('park');
  if (t.includes('temple') || t.includes('church')) categories.push('temple');
  if (t.includes('mall') || t.includes('shop') || t.includes('store')) categories.push('shopping_mall');
  if (t.includes('view') || t.includes('harbour') || t.includes('waterfront')) categories.push('viewpoint');
  if (t.includes('market')) categories.push('market');
  if (t.includes('art') || t.includes('gallery')) categories.push('art_gallery');
  if (t.includes('historic') || t.includes('heritage')) categories.push('historic_site');
  if (t.includes('hotel') || t.includes('accommodation') || t.includes('lodging') || t.includes('live') || t.includes('stay') || t.includes('hostel')) categories.push('hotel');

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
    ? [...semanticPlaces, ...filtered].filter((p, i, a) => a.findIndex(x => x.placeId === p.placeId) === i)
    : filtered;
  const names = allPlaces.length > 0 ? allPlaces.map(p => `- ${p.label}`).join('\n') : '(no curated places found for this search)';
  return {
    response: `I found ${allPlaces.length} place${allPlaces.length !== 1 ? 's' : ''} in ${regionLabel}:\n${names}`,
    thinking: th,
    places: allPlaces.length > 0
      ? allPlaces.map((p, i) => ({ id: p.placeId, name: p.label, lat: p.lat, lng: p.lng, category: p.category || 'attraction' }))
      : places.map((p, i) => ({ id: p.placeId, name: p.label, lat: p.lat, lng: p.lng, category: categories[i] || 'attraction' })),
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

  const llmPlan = await planTrip(preferences, context);
  const categories = [...new Set(llmPlan.stops.map(s => s.category))];
  const searchMsg = `Searching for places: ${categories.join(', ')}`;
  emit(searchMsg); th.push(searchMsg);

  let resolved = await resolveStops(llmPlan.stops, region);
  const foundMsg = `Found ${resolved.length} accessible places for your trip`;
  emit(foundMsg); th.push(foundMsg);

  resolved = nearestNeighborReorder(resolved);
  const reorderMsg = 'Reordered stops to minimize walking distance';
  emit(reorderMsg); th.push(reorderMsg);

  const actualDays = Math.max(days || 1, llmPlan.days || 1);
  const itineraryId = await saveItinerary(preferences, regionLabel);
  const stops: Array<{ label: string; placeId: number; startTime: string; endTime: string; lat: number; lng: number; day: number; distance: number }> = [];
  let currentDay = 1, hour = 9;

  for (let i = 0; i < resolved.length; i++) {
    const p = resolved[i];
    const llmDay = llmPlan.stops[i]?.day || currentDay;
    const day = Math.min(llmDay, actualDays);
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
    return llmPlan.stops.some(s => name.includes(s.label.toLowerCase()) || s.label.toLowerCase().includes(name));
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
  return { lat: 22.319, lng: 114.170, resolvedName: 'Kowloon center' };
}

async function routeDistanceTool(fromLat: number, fromLng: number, toLat: number, toLng: number, fromName?: string, toName?: string): Promise<ToolResult> {
  const from = await resolveToolCoords(fromLat, fromLng, fromName);
  const to = await resolveToolCoords(toLat, toLng, toName);
  const route = await getRoute(from.lat, from.lng, to.lat, to.lng);
  const min = Math.round(route.duration_seconds / 60);
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
    return { response: `Walking from ${from.name} to ${to.name} takes only ${walkMin} min (${(walking.distance_meters / 1000).toFixed(1)} km). Walking is the best option.` };
  }

  const nearestFrom = findNearestMtr(from.lat, from.lng);
  const nearestTo = findNearestMtr(to.lat, to.lng);
  const walkToStation = nearestFrom ? Math.round(haversine(from.lat, from.lng, nearestFrom.lat, nearestFrom.lng) / 80) : 0;
  const walkFromStation = nearestTo ? Math.round(haversine(to.lat, to.lng, nearestTo.lat, nearestTo.lng) / 80) : 0;
  const mtrTime = nearestFrom && nearestTo ? estimateMtrTime(nearestFrom.name, nearestTo.name) : 0;
  const totalMtr = walkToStation + mtrTime + walkFromStation;

  let response = `Walking from ${from.name} to ${to.name} takes ${walkMin} min. `;
  if (nearestFrom && nearestTo && totalMtr > 0) {
    response += `MTR alternative: walk ${walkToStation} min to ${nearestFrom.name} station, ~${mtrTime} min MTR to ${nearestTo.name}, walk ${walkFromStation} min to destination. Total: ~${totalMtr} min.`;
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
  const w1 = Math.round(haversine(from.lat, from.lng, nearestFrom.lat, nearestFrom.lng) / 80);
  const mtr = estimateMtrTime(nearestFrom.name, nearestTo.name);
  const w2 = Math.round(haversine(to.lat, to.lng, nearestTo.lat, nearestTo.lng) / 80);
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
  let response = `Accessibility for ${info.placeName}: wheelchair access is "${info.wheelchair}".`;
  if (info.tags.length > 0) response += ` Features: ${info.tags.join(', ')}.`;
  if (info.notes) response += ` ${info.notes}`;
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
  { name: 'Tsim Sha Tsui', lat: 22.2978, lng: 114.1721, line: 'Tsuen Wan', zone: 'kowloon' },
  { name: 'Jordan', lat: 22.3051, lng: 114.1693, line: 'Tsuen Wan', zone: 'kowloon' },
  { name: 'Yau Ma Tei', lat: 22.3129, lng: 114.1713, line: 'Tsuen Wan', zone: 'kowloon' },
  { name: 'Mong Kok', lat: 22.3186, lng: 114.1700, line: 'Tsuen Wan', zone: 'kowloon' },
  { name: 'Prince Edward', lat: 22.3250, lng: 114.1700, line: 'Tsuen Wan', zone: 'kowloon' },
  { name: 'Sham Shui Po', lat: 22.3300, lng: 114.1620, line: 'Tsuen Wan', zone: 'kowloon' },
  { name: 'Cheung Sha Wan', lat: 22.3360, lng: 114.1550, line: 'Tsuen Wan', zone: 'kowloon' },
  { name: 'Lai Chi Kok', lat: 22.3400, lng: 114.1480, line: 'Tsuen Wan', zone: 'kowloon' },
  { name: 'Mei Foo', lat: 22.3370, lng: 114.1400, line: 'Tsuen Wan', zone: 'kowloon' },
  { name: 'East Tsim Sha Tsui', lat: 22.2940, lng: 114.1760, line: 'Tuen Ma', zone: 'kowloon' },
  { name: 'Hung Hom', lat: 22.3010, lng: 114.1860, line: 'Tuen Ma', zone: 'kowloon' },
  { name: 'Ho Man Tin', lat: 22.3100, lng: 114.1880, line: 'Tuen Ma', zone: 'kowloon' },
  { name: 'To Kwa Wan', lat: 22.3180, lng: 114.1900, line: 'Tuen Ma', zone: 'kowloon' },
  { name: 'Kai Tak', lat: 22.3260, lng: 114.1950, line: 'Tuen Ma', zone: 'kowloon' },
  { name: 'Diamond Hill', lat: 22.3410, lng: 114.2050, line: 'Tuen Ma', zone: 'kowloon' },
  { name: 'Kowloon Tong', lat: 22.3370, lng: 114.1750, line: 'East Rail', zone: 'kowloon' },
  { name: 'Lok Fu', lat: 22.3370, lng: 114.1880, line: 'Kwun Tong', zone: 'kowloon' },
  { name: 'Wong Tai Sin', lat: 22.3420, lng: 114.1940, line: 'Kwun Tong', zone: 'kowloon' },
  { name: 'Ngau Chi Wan', lat: 22.3390, lng: 114.2020, line: 'Kwun Tong', zone: 'kowloon' },
  { name: 'Kwun Tong', lat: 22.3120, lng: 114.2250, line: 'Kwun Tong', zone: 'kowloon' },
  { name: 'Ngau Tau Kok', lat: 22.3170, lng: 114.2180, line: 'Kwun Tong', zone: 'kowloon' },
  { name: 'Kowloon Bay', lat: 22.3240, lng: 114.2110, line: 'Kwun Tong', zone: 'kowloon' },
  { name: 'Austin', lat: 22.3020, lng: 114.1660, line: 'Tuen Ma', zone: 'kowloon' },
];

function findNearestMtr(lat: number, lng: number): MtrStation | null {
  let best: MtrStation | null = null;
  let bestDist = Infinity;
  for (const s of MTR_STATIONS) {
    const d = Math.sqrt((lat - s.lat) ** 2 + (lng - s.lng) ** 2);
    if (d < bestDist) { bestDist = d; best = s; }
  }
  return bestDist < 0.05 ? best : null;
}

const MTR_TRAVEL_TIMES: Record<string, Record<string, number>> = {
  'Tsim Sha Tsui': { 'Jordan': 2, 'Yau Ma Tei': 3, 'Mong Kok': 5, 'Prince Edward': 6, 'Sham Shui Po': 8, 'Cheung Sha Wan': 9, 'Lai Chi Kok': 11, 'Mei Foo': 12, 'East Tsim Sha Tsui': 3, 'Hung Hom': 5, 'Kowloon Tong': 10, 'Austin': 2 },
  'Jordan': { 'Tsim Sha Tsui': 2, 'Yau Ma Tei': 2, 'Mong Kok': 3, 'Prince Edward': 5, 'East Tsim Sha Tsui': 4, 'Austin': 3 },
  'Yau Ma Tei': { 'Tsim Sha Tsui': 3, 'Jordan': 2, 'Mong Kok': 2, 'Prince Edward': 3, 'East Tsim Sha Tsui': 5, 'Austin': 4 },
  'Mong Kok': { 'Tsim Sha Tsui': 5, 'Jordan': 3, 'Yau Ma Tei': 2, 'Prince Edward': 2, 'Sham Shui Po': 3, 'Kowloon Tong': 6 },
  'Prince Edward': { 'Tsim Sha Tsui': 6, 'Mong Kok': 2, 'Sham Shui Po': 2, 'Kowloon Tong': 5, 'Lok Fu': 6 },
  'Kowloon Tong': { 'Mong Kok': 6, 'Prince Edward': 5, 'Lok Fu': 3, 'Diamond Hill': 5, 'Ho Man Tin': 4 },
  'Hung Hom': { 'East Tsim Sha Tsui': 2, 'Ho Man Tin': 3, 'Kowloon Tong': 5, 'Tsim Sha Tsui': 5 },
  'East Tsim Sha Tsui': { 'Tsim Sha Tsui': 3, 'Hung Hom': 2, 'Austin': 3 },
  'Austin': { 'Tsim Sha Tsui': 2, 'East Tsim Sha Tsui': 3, 'Hung Hom': 3 },
};

function estimateMtrTime(from: string, to: string): number {
  if (from === to) return 0;
  const direct = MTR_TRAVEL_TIMES[from]?.[to];
  if (direct) return direct;
  const reverse = MTR_TRAVEL_TIMES[to]?.[from];
  if (reverse) return reverse;
  const commonStations = ['Mong Kok', 'Prince Edward', 'Kowloon Tong', 'Hung Hom'];
  for (const mid of commonStations) {
    const a = MTR_TRAVEL_TIMES[from]?.[mid] || MTR_TRAVEL_TIMES[mid]?.[from];
    const b = MTR_TRAVEL_TIMES[mid]?.[to] || MTR_TRAVEL_TIMES[to]?.[mid];
    if (a && b) return a + b;
  }
  return 15;
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
