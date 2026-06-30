/**
 * mapsDirections.ts
 *
 * Thin wrapper around the Google Maps Directions API.
 * Returns simplified direction metadata for the itinerary.
 */

export interface DirectionsRequest {
  origin: string;
  destination: string;
  mode: 'walking' | 'transit' | 'driving';
}

export interface DirectionsResult {
  duration_mins: number;
  distance_m: number;
  steps: { instruction: string; distance_m: number }[];
  polyline?: string;
}

export async function getDirections(req: DirectionsRequest): Promise<DirectionsResult> {
  const key = process.env.MAPS_API_KEY;
  if (!key) throw new Error('MAPS_API_KEY not set');

  const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
  url.searchParams.set('origin', req.origin);
  url.searchParams.set('destination', req.destination);
  url.searchParams.set('mode', req.mode);
  url.searchParams.set('key', key);
  url.searchParams.set('language', 'en');

  const resp = await fetch(url.toString());
  const data = await resp.json() as any;

  if (data.status !== 'OK') {
    throw new Error(`Maps API error: ${data.status}`);
  }

  const leg = data.routes[0].legs[0];
  return {
    duration_mins: Math.ceil(leg.duration.value / 60),
    distance_m: leg.distance.value,
    polyline: data.routes[0].overview_polyline?.points,
    steps: leg.steps.map((s: any) => ({
      instruction: s.html_instructions.replace(/<[^>]+>/g, ''),
      distance_m: s.distance.value,
    })),
  };
}
