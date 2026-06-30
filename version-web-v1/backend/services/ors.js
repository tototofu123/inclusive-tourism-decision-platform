const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const ORS_BASE = process.env.ORS_BASE || 'https://router.project-osrm.org';

async function route(startLng, startLat, endLng, endLat, profile = 'foot') {
  const url = `${ORS_BASE}/route/v1/${profile}/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data.routes?.length) return null;
    const r = data.routes[0];
    return {
      distance_km: Math.round(r.distance / 10) / 100,
      duration_min: Math.round(r.duration / 60),
      legs: r.legs?.map(l => ({
        distance_km: Math.round(l.distance / 10) / 100,
        duration_min: Math.round(l.duration / 60),
        steps: l.steps?.map(s => ({
          instruction: s.maneuver?.instruction || s.name || 'Continue',
          distance_m: Math.round(s.distance)
        })) || []
      })) || []
    };
  } catch {
    return null;
  }
}

async function routeBetweenStops(places, profile = 'foot') {
  if (places.length < 2) return [];
  const results = [];
  for (let i = 0; i < places.length - 1; i++) {
    const a = places[i], b = places[i + 1];
    const r = await route(a.lng, a.lat, b.lng, b.lat, profile);
    results.push({ from: a.name, to: b.name, route: r });
  }
  return results;
}

module.exports = { route, routeBetweenStops };
