import { query } from '../db/client';
import { LLMStop } from '../types';
import { savePlace } from '../db/client';
import { queryAllAccessibility } from './accessibilityService';
import { KOWLOON_CENTER, KOWLOON_BBOX } from '../constants';

const OVERPASS_BASE = process.env.OVERPASS_BASE || 'https://overpass-api.de/api/interpreter';
const NOMINATIM_BASE = process.env.NOMINATIM_BASE || 'https://nominatim.openstreetmap.org';
const MAPS_API_KEY = process.env.MAPS_API_KEY || '';

const CATEGORY_OVERPASS: Record<string, string> = {
  museum: 'node["tourism"="museum"]',
  cafe: 'node["amenity"="cafe"]',
  restaurant: 'node["amenity"="restaurant"]',
  park: 'node["leisure"="park"]',
  temple: 'node["amenity"="place_of_worship"]',
  shopping_mall: 'node["shop"="mall"]',
  viewpoint: 'node["tourism"="viewpoint"]',
  market: 'node["amenity"="marketplace"]',
  art_gallery: 'node["tourism"="gallery"]',
  historic_site: 'node["historic"~"."]',
  hotel: 'node["tourism"="hotel"]',
};

const FALLBACK_CATEGORIES: Record<string, string[]> = {
  museum: ['museum', 'historic'],
  cafe: ['cafe'],
  restaurant: ['restaurant'],
  park: ['park'],
  temple: ['place_of_worship'],
  shopping_mall: ['mall'],
  viewpoint: ['viewpoint'],
  market: ['marketplace'],
  art_gallery: ['gallery'],
  historic_site: ['historic', 'monument'],
  hotel: ['hotel'],
};

const CATEGORY_PLACE_TYPE: Record<string, string> = {
  museum: 'attraction',
  cafe: 'restaurant',
  restaurant: 'restaurant',
  park: 'attraction',
  temple: 'attraction',
  shopping_mall: 'attraction',
  viewpoint: 'attraction',
  market: 'attraction',
  art_gallery: 'attraction',
  historic_site: 'attraction',
  hotel: 'hotel',
  transport_hub: 'transport_hub',
};

export async function resolveStops(
  stops: LLMStop[],
  region?: string,
  budget?: string,
): Promise<Array<{ placeId: number; label: string; lat: number; lng: number; duration: number }>> {
  const results: Array<{ placeId: number; label: string; lat: number; lng: number; duration: number }> = [];
  const allAccess = await queryAllAccessibility();

  for (const stop of stops) {
    const cats = FALLBACK_CATEGORIES[stop.category] || [stop.category];
    const placeType = CATEGORY_PLACE_TYPE[stop.category] || 'attraction';
    let place: { id?: number; name: string; lat: number; lng: number } | null = null;

    const params: any[] = [cats];
    let sql = `SELECT id, name, lat, lng FROM places
               WHERE (LOWER(category) = ANY($1) OR LOWER(place_type) = ANY($1))`;
    let idx = 2;
    if (region) { sql += ` AND region = $${idx++}`; params.push(region); }
    if (budget) { sql += ` AND budget = $${idx++}`; params.push(budget); }
    sql += ` ORDER BY accessibility_score DESC, RANDOM() LIMIT 3`;
    const dbResult = await query(sql, params);

    if (dbResult.rows.length > 0) {
      place = dbResult.rows[0];
    }

    let wheelTag = '';
    const foundPlace = place;
    if (foundPlace) {
        const near = allAccess.find(a => Math.abs(a.lat - foundPlace.lat) < 0.005 && Math.abs(a.lng - foundPlace.lng) < 0.005);
        if (near?.tags?.wheelchair) wheelTag = ` Wheelchair: ${near.tags.wheelchair}.`;
        results.push({
          placeId: foundPlace.id!,
          label: foundPlace.name,
          lat: foundPlace.lat,
          lng: foundPlace.lng,
          duration: stop.approx_duration_minutes,
        });
        continue;
    }

    // Prefer Google Places API when key is set
    if (MAPS_API_KEY) {
      place = await queryPlacesApi(stop.label + ' ' + stop.category);
    }

    if (!place) {
      for (const cat of cats) {
        place = await queryOverpass(cat, stop.label);
        if (place) break;
      }
    }

    if (!place) {
      place = await queryNominatim(stop.label, stop.category);
    }

    if (place) {
      const near = allAccess.find(a => Math.abs(a.lat - place!.lat) < 0.005 && Math.abs(a.lng - place!.lng) < 0.005);
      if (near?.tags?.wheelchair) wheelTag = ` Wheelchair: ${near.tags.wheelchair}.`;
    }

    if (place) {
      const placeId = await savePlace({
        name: place.name, lat: place.lat, lng: place.lng,
        category: stop.category, description: (stop.notes || `${stop.label} in Kowloon`) + wheelTag,
        source_api: 'osm',
      });
      results.push({ placeId, label: place.name, lat: place.lat, lng: place.lng, duration: stop.approx_duration_minutes });
    } else {
      const clat = KOWLOON_CENTER.lat - 0.014 + Math.random() * 0.03;
      const clng = KOWLOON_CENTER.lng - 0.005 + Math.random() * 0.03;
      const placeId = await savePlace({
        name: `${stop.label} (Kowloon)`, lat: clat, lng: clng,
        category: stop.category, description: (stop.notes || `${stop.label} in Kowloon`) + (wheelTag || ' (seed)'),
        source_api: wheelTag ? 'osm' : 'seed',
      });
      results.push({ placeId, label: `${stop.label} (Kowloon)`, lat: clat, lng: clng, duration: stop.approx_duration_minutes });
    }
  }
  return results;
}

async function queryPlacesApi(query: string): Promise<{ name: string; lat: number; lng: number } | null> {
  if (!MAPS_API_KEY) return null;
  try {
    const url = `https://places.googleapis.com/v1/places:searchText`;
    const body = {
      textQuery: `${query} Hong Kong`,
      locationBias: { circle: { center: { latitude: KOWLOON_CENTER.lat, longitude: KOWLOON_CENTER.lng }, radius: 5000 } },
      pageSize: 3,
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': MAPS_API_KEY, 'X-Goog-FieldMask': 'places.displayName,places.location' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = await res.json() as any;
    const place = data.places?.[0];
    return place ? {
      name: place.displayName?.text || query,
      lat: place.location?.latitude || KOWLOON_CENTER.lat,
      lng: place.location?.longitude || KOWLOON_CENTER.lng,
    } : null;
  } catch { return null; }
}

async function queryOverpass(category: string, label: string): Promise<{ name: string; lat: number; lng: number } | null> {
  const query = CATEGORY_OVERPASS[category];
  if (!query) return null;
  try {
    const q = `[out:json][timeout:10];(${query}(${KOWLOON_BBOX}););out body 5;`;
    const res = await fetch(OVERPASS_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json', 'User-Agent': 'InclusiveTourismMVP/1.0' },
      body: new URLSearchParams({ data: q }),
    });
    if (!res.ok) return null;
    const data = await res.json() as any;
    const el = data.elements?.[0];
    return el ? { name: el.tags?.name || el.tags?.official_name || label, lat: el.lat, lng: el.lon } : null;
  } catch { return null; }
}

async function queryNominatim(q: string, category: string): Promise<{ name: string; lat: number; lng: number } | null> {
  try {
    const parts = KOWLOON_BBOX.split(',').map(Number);
    const [south, west, north, east] = [parts[0], parts[1], parts[2], parts[3]];
    const url = `${NOMINATIM_BASE}/search?q=${encodeURIComponent(q + ' Kowloon Hong Kong')}&format=json&limit=1&bounded=1&viewbox=${west},${north},${east},${south}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'InclusiveTourismMVP/1.0' } });
    if (!res.ok) return null;
    const data = await res.json() as any[];
    return data[0] ? { name: data[0].display_name?.split(',')[0] || q, lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) } : null;
  } catch { return null; }
}
