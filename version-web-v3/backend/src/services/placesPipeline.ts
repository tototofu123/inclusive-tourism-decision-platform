import { query } from '../db/client';

const MAPS_API_KEY = process.env.MAPS_API_KEY || '';
const PLACES_BASE = 'https://places.googleapis.com/v1/places:searchText';

interface PlaceResult {
  name: string;
  formattedAddress?: string;
  location?: { lat: number; lng: number };
  types?: string[];
  accessibilityOptions?: {
    wheelchairAccessibleEntrance?: boolean;
    wheelchairAccessibleParking?: boolean;
    wheelchairAccessibleRestroom?: boolean;
    wheelchairAccessibleSeating?: boolean;
  };
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  priceLevel?: string;
  regularOpeningHours?: { weekdayDescriptions: string[] };
}

const SEARCH_QUERIES = [
  'accessible toilet Hong Kong',
  'wheelchair accessible restaurant Hong Kong',
  'accessible park Hong Kong',
  'resting spot Hong Kong',
  // MTR station accessibility is handled by hardcoded data in tools.ts
  'accessible museum Hong Kong',
  'handicap parking Hong Kong',
  'accessible cafe Hong Kong',
  'accessible shopping mall Hong Kong',
  'accessible tourist attraction Hong Kong',
];

const HK_LOCATION_RESTRICTION = {
  circle: { center: { latitude: 22.3193, longitude: 114.1694 }, radius: 25000 },
};

export async function runPlacesPipeline(limit = 20): Promise<{ added: number; skipped: number }> {
  let added = 0;
  let skipped = 0;

  for (const queryStr of SEARCH_QUERIES.slice(0, limit)) {
    try {
      const results = await searchGooglePlaces(queryStr);
      for (const place of results) {
        const existing = await query(
          'SELECT id FROM places WHERE LOWER(name) = LOWER($1) LIMIT 1',
          [place.name],
        );
        if (existing.rows.length > 0) { skipped++; continue; }

        const tags: string[] = [];
        if (place.accessibilityOptions?.wheelchairAccessibleEntrance) tags.push('step-free access');
        if (place.accessibilityOptions?.wheelchairAccessibleRestroom) tags.push('accessible toilet');
        if (place.accessibilityOptions?.wheelchairAccessibleParking) tags.push('accessible parking');
        if (place.accessibilityOptions?.wheelchairAccessibleSeating) tags.push('accessible seating');

        const category = inferCategory(place.types || []);
        const lat = place.location?.lat || 22.3193;
        const lng = place.location?.lng || 114.1694;
        const score = tags.length >= 2 ? 5 : tags.length === 1 ? 3 : 1;

        await query(
          `INSERT INTO places (name, category, lat, lng, description, accessibility_tags, accessibility_score, region)
           SELECT $1, $2, $3, $4, $5, $6, $7, $8
           WHERE NOT EXISTS (SELECT 1 FROM places WHERE LOWER(name) = LOWER($1) AND ABS(lat - $3) < 0.01 AND ABS(lng - $4) < 0.01)`,
          [
            place.name,
            category,
            lat,
            lng,
            `${place.formattedAddress || ''}${place.rating ? ` · Rating: ${place.rating}/5` : ''}`,
            tags,
            score,
            inferRegion(lat, lng),
          ],
        );
        added++;
      }
    } catch (err) {
      console.error(`Places pipeline error for "${queryStr}":`, (err as Error).message);
    }
  }

  return { added, skipped };
}

async function searchGooglePlaces(query: string): Promise<PlaceResult[]> {
  const body = {
    textQuery: query,
    locationRestriction: HK_LOCATION_RESTRICTION,
    pageSize: 10,
  };

  const res = await fetch(PLACES_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': MAPS_API_KEY,
      'X-Goog-FieldMask': 'places.name,places.formattedAddress,places.location,places.types,places.accessibilityOptions,places.rating,places.priceLevel,places.nationalPhoneNumber,places.websiteUri,places.regularOpeningHours',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Google Places API returned ${res.status}: ${await res.text().catch(() => '')}`);
  }

  const data = await res.json() as any;
  return data.places || [];
}

function inferCategory(types: string[]): string {
  if (types.some(t => t.includes('museum'))) return 'museum';
  if (types.some(t => t.includes('restaurant') || t.includes('food'))) return 'restaurant';
  if (types.some(t => t.includes('park') || t.includes('garden'))) return 'park';
  if (types.some(t => t.includes('cafe') || t.includes('coffee'))) return 'cafe';
  if (types.some(t => t.includes('shopping') || t.includes('mall'))) return 'shopping_mall';
  if (types.some(t => t.includes('temple') || t.includes('church'))) return 'temple';
  if (types.some(t => t.includes('art') || t.includes('gallery'))) return 'art_gallery';
  if (types.some(t => t.includes('hotel'))) return 'hotel';
  if (types.some(t => t.includes('market'))) return 'market';
  if (types.some(t => t.includes('tourist') || t.includes('view') || t.includes('harbor'))) return 'viewpoint';
  if (types.some(t => t.includes('toilet') || t.includes('restroom') || t.includes('bathroom'))) return 'restroom';
  return 'attraction';
}

function inferRegion(lat: number, lng: number): string {
  if (lat > 22.28 && lat < 22.34 && lng > 114.14 && lng < 114.22) return 'kowloon';
  if (lat > 22.24 && lat < 22.30 && lng > 114.12 && lng < 114.22) return 'hong_kong_island';
  return 'new_territories';
}
