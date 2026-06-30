const OSRM_BASE = process.env.OSRM_BASE || 'https://router.project-osrm.org';

export async function getRoute(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  try {
    const url = `${OSRM_BASE}/route/v1/walking/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OSRM ${res.status}`);
    const data = await res.json() as any;
    if (!data.routes?.length) throw new Error('No route');
    return { distance_meters: Math.round(data.routes[0].distance), duration_seconds: Math.round(data.routes[0].duration), geometry: data.routes[0].geometry };
  } catch (err) {
    console.error('OSRM failed:', (err as Error).message);
    const dist = haversine(fromLat, fromLng, toLat, toLng);
    return { distance_meters: Math.round(dist * 1.4), duration_seconds: Math.round(dist * 1.4 / 1.4), geometry: { type: 'LineString', coordinates: [[fromLng, fromLat], [toLng, toLat]] } };
  }
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
