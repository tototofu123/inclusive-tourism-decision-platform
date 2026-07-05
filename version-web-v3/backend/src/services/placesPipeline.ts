import { query } from '../db/client';
import { HK_PIPELINE_CENTER, HK_REGION } from '../constants';

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
  'top rated museum Hong Kong',
  'popular restaurant Hong Kong Kowloon',
  'best cafe Hong Kong',
  'shopping mall Hong Kong',
  'tourist attraction Hong Kong',
  'historic site Hong Kong',
  'park Hong Kong garden',
  'viewpoint Hong Kong skyline',
  'Hong Kong temple',
  'art gallery Hong Kong',
  'market Hong Kong street market',
  'Hong Kong hotel',
  'dim sum restaurant Hong Kong',
  'seafood restaurant Hong Kong',
  'rooftop bar Hong Kong view',
  'museum Hong Kong Island',
  'nature park Hong Kong',
  'Hong Kong cultural site',
  'night market Hong Kong',
  'family attraction Hong Kong',
];

const HK_LOCATION_RESTRICTION = {
  circle: { center: { latitude: HK_PIPELINE_CENTER.lat, longitude: HK_PIPELINE_CENTER.lng }, radius: 25000 },
};

export async function runPlacesPipeline(maxQueries = 20): Promise<{ added: number; skipped: number }> {
  let added = 0;
  let skipped = 0;

  const results = await Promise.allSettled(
    SEARCH_QUERIES.slice(0, maxQueries).map(q => searchGooglePlaces(q))
  );
  for (const result of results) {
    if (result.status === 'rejected') continue;
    for (const place of result.value) {
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
      const lat = place.location?.lat || HK_PIPELINE_CENTER.lat;
      const lng = place.location?.lng || HK_PIPELINE_CENTER.lng;
      const score = tags.length >= 2 ? 5 : tags.length === 1 ? 3 : 1;

      const priceMap: Record<string, string> = {
        PRICE_LEVEL_FREE: 'free', PRICE_LEVEL_INEXPENSIVE: 'cheap',
        PRICE_LEVEL_MODERATE: 'medium', PRICE_LEVEL_EXPENSIVE: 'expensive', PRICE_LEVEL_VERY_EXPENSIVE: 'very_expensive',
      };
      const priceLevel = place.priceLevel ? priceMap[place.priceLevel] || place.priceLevel.toLowerCase() : null;
      const phone = place.nationalPhoneNumber || null;
      const website = place.websiteUri || null;
      const openingHours = place.regularOpeningHours?.weekdayDescriptions
        ? place.regularOpeningHours.weekdayDescriptions.join('; ')
        : null;

      await query(
        `INSERT INTO places (name, category, lat, lng, description, accessibility_tags, accessibility_score, region, price_level, phone, website, opening_hours)
         SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
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
          priceLevel,
          phone,
          website,
          openingHours,
        ],
      );
      added++;
    }
  }

  return { added, skipped };
}

async function searchGooglePlaces(query: string): Promise<PlaceResult[]> {
  const body = {
    textQuery: query,
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
  const r = HK_REGION;
  if (lat > r.kowloon.minLat && lat < r.kowloon.maxLat && lng > r.kowloon.minLng && lng < r.kowloon.maxLng) return 'kowloon';
  if (lat > r.hong_kong_island.minLat && lat < r.hong_kong_island.maxLat && lng > r.hong_kong_island.minLng && lng < r.hong_kong_island.maxLng) return 'hong_kong_island';
  return 'new_territories';
}
