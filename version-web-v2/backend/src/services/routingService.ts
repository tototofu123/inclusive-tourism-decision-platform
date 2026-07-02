const OSRM_BASE = process.env.OSRM_BASE || 'https://router.project-osrm.org';

export async function getRoute(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  try {
    const url = `${OSRM_BASE}/route/v1/walking/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OSRM ${res.status}`);
    const data = await res.json() as any;
    if (!data.routes?.length) throw new Error('No route');
    const dist = data.routes[0].distance;
    const dur = data.routes[0].duration;
    // OSRM walking profile sometimes returns driving data for areas without walking coverage.
    // Reject if walking speed > 8 km/h (likely driving data)
    const speedKph = dist / dur * 3.6;
    if (speedKph > 8) {
      console.log(`OSRM speed ${speedKph.toFixed(1)} km/h too high for walking, using fallback`);
      return haversineFallback(fromLat, fromLng, toLat, toLng);
    }
    return { distance_meters: Math.round(dist), duration_seconds: Math.round(dur), geometry: data.routes[0].geometry };
  } catch (err) {
    console.error('OSRM failed:', (err as Error).message);
    return haversineFallback(fromLat, fromLng, toLat, toLng);
  }
}

function haversineFallback(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  const dist = haversine(fromLat, fromLng, toLat, toLng);
  const roadDist = dist * 1.4;
  const durSec = Math.round(roadDist / 1.4);
  return {
    distance_meters: Math.round(roadDist),
    duration_seconds: durSec,
    geometry: { type: 'LineString', coordinates: [[fromLng, fromLat], [toLng, toLat]] },
  };
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
