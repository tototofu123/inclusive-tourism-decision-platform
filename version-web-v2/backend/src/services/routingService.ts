const OSRM_BASE = process.env.OSRM_BASE || 'https://router.project-osrm.org';
const MAPS_API_KEY = process.env.MAPS_API_KEY || '';

export async function getRoute(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  // Prefer Google Maps Routes API if key is set
  if (MAPS_API_KEY) {
    try {
      return await mapsRoute(fromLat, fromLng, toLat, toLng);
    } catch (err) {
      console.error('Maps Routes API failed:', (err as Error).message);
      // Fall through to OSRM
    }
  }

  try {
    const url = `${OSRM_BASE}/route/v1/walking/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OSRM ${res.status}`);
    const data = await res.json() as any;
    if (!data.routes?.length) throw new Error('No route');
    const dist = data.routes[0].distance;
    const dur = data.routes[0].duration;
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

async function mapsRoute(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  const url = `https://routes.googleapis.com/directions/v2:computeRoutes`;
  const body = {
    origin: { location: { latLng: { latitude: fromLat, longitude: fromLng } } },
    destination: { location: { latLng: { latitude: toLat, longitude: toLng } } },
    travelMode: 'WALK',
    routingPreference: 'TRAFFIC_AWARE',
    units: 'METRIC',
    polylineQuality: 'OVERVIEW',
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': MAPS_API_KEY,
      'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Routes API ${res.status}: ${await res.text().catch(() => '')}`);
  const data = await res.json() as any;
  const route = data.routes?.[0];
  if (!route) throw new Error('No route found');

  const durSec = parseInt(route.duration?.replace('s', '') || '0');
  const distMeters = route.distanceMeters || 0;

  // Decode polyline to GeoJSON-like geometry
  let geometry: any = { type: 'LineString', coordinates: [[fromLng, fromLat], [toLng, toLat]] };
  try {
    if (route.polyline?.encodedPolyline) {
      const decoded = decodePolyline(route.polyline.encodedPolyline);
      geometry = { type: 'LineString', coordinates: decoded.map((p: [number, number]) => [p[1], p[0]]) };
    }
  } catch {}

  return { distance_meters: distMeters, duration_seconds: durSec, geometry };
}

function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let byte, shift = 0, result = 0;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    const dLat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dLat;
    shift = 0; result = 0;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    const dLng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dLng;
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
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
