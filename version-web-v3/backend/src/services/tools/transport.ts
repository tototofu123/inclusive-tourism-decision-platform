import { query } from '../../db/client';
import { getRoute } from '../routingService';
import { getGlobalPreferences } from '../globalPreferencesService';
import { KOWLOON_CENTER, HK_ISLAND_CENTER, NEW_TERRITORIES_CENTER, LANTAU_CENTER } from '../../constants';
import { ToolResult, haversineMeters, firstOf } from './utils';
import { MTR_STATIONS, isMTRStationAccessible, findNearestMtr, estimateMtrTime } from './mtr';

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
  const nameLower = (name || '').toLowerCase();
  if (nameLower.includes('harbour') || nameLower.includes('harbor') || nameLower.includes('central') || nameLower.includes('causeway') || nameLower.includes('wan chai') || nameLower.includes('admiralty') || nameLower.includes('happy valley') || nameLower.includes('shek o') || nameLower.includes('stanley') || nameLower.includes('repulse')) {
    return { ...HK_ISLAND_CENTER, resolvedName: name };
  }
  if (nameLower.includes('sha tin') || nameLower.includes('tai po') || nameLower.includes('tuen mun') || nameLower.includes('yuen long') || nameLower.includes('tsuen wan') || nameLower.includes('fanling') || nameLower.includes('sheung shui') || nameLower.includes('sai kung') || nameLower.includes('kwai')) {
    return { ...NEW_TERRITORIES_CENTER, resolvedName: name };
  }
  if (nameLower.includes('disney') || nameLower.includes('airport') || nameLower.includes('tung chung') || nameLower.includes('lantau')) {
    return { ...LANTAU_CENTER, resolvedName: name };
  }
  return { ...KOWLOON_CENTER, resolvedName: 'Kowloon center' };
}

async function resolvePlaceName(name: string): Promise<{ name: string; lat: number; lng: number }> {
  if (!name) return { name: 'location', ...KOWLOON_CENTER };
  const rows = await query('SELECT name, lat, lng FROM places WHERE LOWER(name) LIKE $1 LIMIT 1', [`%${name.toLowerCase()}%`]);
  if (rows.rows.length > 0) return rows.rows[0];
  const mtr = MTR_STATIONS.find(s => name.toLowerCase().includes(s.name.toLowerCase()));
  if (mtr) return { name: mtr.name, lat: mtr.lat, lng: mtr.lng };
  return { name, ...KOWLOON_CENTER };
}

export async function routeDistanceTool(fromLat: number, fromLng: number, toLat: number, toLng: number, fromName?: string, toName?: string): Promise<ToolResult> {
  const from = await resolveToolCoords(fromLat, fromLng, fromName);
  const to = await resolveToolCoords(toLat, toLng, toName);
  const route = await getRoute(from.lat, from.lng, to.lat, to.lng);
  const multiplier = await getSpeedMultiplier();
  const min = Math.round(route.duration_seconds / 60 / multiplier);
  const km = (route.distance_meters / 1000).toFixed(1);
  return { response: `Walking distance: ${km} km (approx ${min} min).` };
}

export async function findTransportTool(fromName: string, fromLat: number, fromLng: number, toName: string, toLat: number, toLng: number): Promise<ToolResult> {
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
    response += 'Walking is the only option available.';
  }
  return { response };
}

export async function getTravelTimeTool(fromLat: number, fromLng: number, toLat: number, toLng: number, mode: string, fromName?: string, toName?: string): Promise<ToolResult> {
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

export async function optimizeRouteTool(stops: Array<{ name: string; lat: number; lng: number }>): Promise<ToolResult> {
  if (stops.length <= 1) return { response: 'Need at least 2 stops to optimize.' };
  const ordered = nearestNeighborReorder(stops);
  const order = ordered.map((s, i) => `${i + 1}. ${s.name}`).join(' → ');
  return { response: `Optimized route: ${order}` };
}

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
