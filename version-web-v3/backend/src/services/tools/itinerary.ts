import { query, saveItinerary, saveItineraryItem, getFullItinerary } from '../../db/client';
import { resolveStops } from '../placeResolver';
import { getRoute } from '../routingService';
import { planTrip } from '../llmGateway';
import { getGlobalPreferences } from '../globalPreferencesService';
import { LLMStop } from '../../types';
import { ToolResult, EmitFn, haversineMeters } from './utils';
import { findNearestMtr, estimateMtrTime, isMTRStationAccessible } from './mtr';

function nearestNeighborReorder<T extends { lat: number; lng: number }>(stops: T[]): T[] {
  if (stops.length <= 2) return stops;
  const ordered: T[] = [stops[0]];
  const used = new Set<number>([0]);
  while (ordered.length < stops.length) {
    const last = ordered[ordered.length - 1];
    let best = -1, bestDist = Infinity;
    for (let i = 0; i < stops.length; i++) {
      if (used.has(i)) continue;
      const d = haversineMeters(last.lat, last.lng, stops[i].lat, stops[i].lng);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    used.add(best);
    ordered.push(stops[best]);
  }
  return ordered;
}

export async function createItineraryTool(days: number, preferences: string, emit: EmitFn, existingId?: number, region?: string): Promise<ToolResult> {
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
  const homeCtx = globalPrefs.home_base ? `User staying in: ${globalPrefs.home_base}. Start trip from there.` : undefined;
  const interestCtx = globalPrefs.interests.length > 0 ? `User interests: ${globalPrefs.interests.join(', ')}.` : undefined;
  const llmPlan = await planTrip(preferences, context, [mobCtx, homeCtx, interestCtx].filter(Boolean).join(' '));
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

  // If user has a home_base, start from there
  const startHour = globalPrefs.home_base ? 10 : 9;

  const dayMap = new Map<string, number>();
  llmPlan.stops.forEach((s: any, idx: number) => {
    dayMap.set(s.label || s.category || `stop_${idx}`, s.day || currentDay);
  });

  const routeQueries = resolved.length > 1
    ? await Promise.all(resolved.slice(1).map((_, i) =>
        getRoute(resolved[i].lat, resolved[i].lng, resolved[i + 1].lat, resolved[i + 1].lng)
      ))
    : [];

  hour = startHour;
  for (let i = 0; i < resolved.length; i++) {
    const p = resolved[i];
    const llmDay = dayMap.get(p.label || `stop_${i}`) || currentDay;
    const day = Math.min(llmDay, actualDays);
    if (day !== currentDay) { currentDay = day; hour = startHour; }
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
    emit(`Saved itinerary #${itineraryId} to database (${actualDays} days)`); th.push(`Saved itinerary #${itineraryId} to database (${actualDays} days)`);
  }

  const all = await query('SELECT id, user_text, created_at FROM itineraries ORDER BY created_at DESC LIMIT 20');
  return {
    response: `Planned a ${actualDays}-day ${regionLabel} itinerary with ${stops.length} stops. Open the Itinerary tab to see the full day-by-day plan with walking times.`,
    thinking: th,
    places: resolved.map(p => ({ id: p.placeId, name: p.label, lat: p.lat, lng: p.lng })),
    itinerary: { id: itineraryId, stops },
  };
}

export async function editItineraryTool(itineraryId: number, changes: string, emit: EmitFn): Promise<ToolResult> {
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
    return { response: 'Could not determine which stops to change. No changes made.', thinking: th };
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

export async function getItineraryTool(itineraryId: number): Promise<ToolResult> {
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

export async function listItinerariesTool(): Promise<ToolResult> {
  const all = await query('SELECT id, user_text, created_at FROM itineraries ORDER BY created_at DESC LIMIT 20');
  const count = all.rows.length;
  if (count === 0) return { response: 'No itineraries saved yet.' };
  const list = all.rows.map((r: any) => `#${r.id}: ${(r.user_text || '').slice(0, 50)}`).join('\n');
  return { response: `You have ${count} saved itineraries:\n${list}` };
}

export async function deleteItineraryTool(itineraryId: number): Promise<ToolResult> {
  const existing = await query('SELECT id FROM itineraries WHERE id=$1', [itineraryId]);
  if (existing.rows.length === 0) return { response: `Itinerary #${itineraryId} not found.` };
  await query('DELETE FROM itinerary_items WHERE itinerary_id = $1', [itineraryId]);
  await query('DELETE FROM itineraries WHERE id = $1', [itineraryId]);
  return { response: `Itinerary #${itineraryId} deleted.` };
}
