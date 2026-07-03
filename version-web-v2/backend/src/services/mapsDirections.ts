import { getRoute } from './routingService';

export interface DirectionsRequest {
  origin: string;
  destination: string;
  mode: 'walking' | 'transit' | 'driving';
  originLat?: number;
  originLng?: number;
  destLat?: number;
  destLng?: number;
}

export interface DirectionsResult {
  duration_mins: number;
  distance_m: number;
  steps: { instruction: string; distance_m: number }[];
  polyline?: string;
}

export async function getDirections(req: DirectionsRequest): Promise<DirectionsResult> {
  const fromLat = req.originLat ?? 0;
  const fromLng = req.originLng ?? 0;
  const toLat = req.destLat ?? 0;
  const toLng = req.destLng ?? 0;

  const route = await getRoute(fromLat, fromLng, toLat, toLng);

  return {
    duration_mins: Math.round((route.duration_seconds || 600) / 60),
    distance_m: route.distance_meters || 0,
    polyline: JSON.stringify(route.geometry),
    steps: [],
  };
}
