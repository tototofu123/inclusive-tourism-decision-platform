export interface ToolResult {
  response: string;
  thinking?: string[];
  places?: any[];
  itinerary?: { id: number; stops: any[] };
}

export type EmitFn = (msg: string) => void;

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return haversineMeters(lat1, lng1, lat2, lng2) / 1000;
}

export function firstOf(args: any, ...keys: string[]): any {
  for (const k of keys) {
    const v = args[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}
