import { query } from '../../db/client';
import { resolveStops } from '../placeResolver';
import { searchBySemantic } from '../ragService';
import { LLMStop } from '../../types';
import { ToolResult, EmitFn } from './utils';

export const searchCache = new Map<string, { results: any[]; timestamp: number }>();
const CACHE_TTL = 60000;

export async function searchPlaces(query_text: string, region: string, budget: string, emit: EmitFn): Promise<ToolResult> {
  const th: string[] = [];
  const regionLabel = region ? region.replace(/_/g, ' ') : 'Kowloon';
  emit(`Searching ${regionLabel} for matching places...`); th.push(`Searching ${regionLabel} for matching places...`);

  const cacheKey = `${query_text}|${region}|${budget}`.toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { response: `Found ${cached.results.length} place(s): ${cached.results.map((r: any) => r.label).join(', ')}`, places: cached.results };
  }

  const t = query_text.toLowerCase();
  const categories: string[] = [];
  if (t.includes('museum')) categories.push('museum');
  if (t.includes('gallery') || (t.includes('art') && !t.includes('museum'))) categories.push('art_gallery');
  if (t.includes('cafe') || t.includes('coffee') || t.includes('tea') || t.includes('bakery') || t.includes('bistro') || t.includes('brunch')) categories.push('cafe');
  if (t.includes('restaurant') || t.includes('food') || t.includes('eat') || t.includes('dining') || t.includes('diner') || t.includes('cuisine') || t.includes('lunch') || t.includes('dinner') || t.includes('breakfast')) categories.push('restaurant');
  if (t.includes('park') || t.includes('garden') || t.includes('nature') || t.includes('playground') || t.includes('outdoor')) categories.push('park');
  if (t.includes('temple') || t.includes('church') || t.includes('mosque') || t.includes('monastery') || t.includes('shrine')) categories.push('temple');
  if (t.includes('mall') || t.includes('shop') || t.includes('store') || t.includes('plaza')) categories.push('shopping_mall');
  if (t.includes('view') || t.includes('harbour') || t.includes('harbor') || t.includes('waterfront') || t.includes('skyline') || t.includes('observation')) categories.push('viewpoint');
  if (t.includes('market') || t.includes('bazaar')) categories.push('market');
  if (t.includes('hotel') || t.includes('hostel') || t.includes('lodging') || t.includes('live') || t.includes('stay') || t.includes('accommodation')) categories.push('hotel');
  if (t.includes('historic') || t.includes('heritage')) categories.push('historic_site');
  if (t.includes('toilet') || t.includes('restroom') || t.includes('bathroom') || t.includes('wc') || t.includes('washroom')) categories.push('restroom');

  const hasSpecificCategory = categories.length > 0;
  if (categories.length === 0) categories.push('museum', 'cafe', 'restaurant', 'park', 'temple', 'shopping_mall', 'viewpoint', 'market', 'art_gallery', 'historic_site', 'hotel');

  emit(`Looking for categories: ${categories.join(', ')}`); th.push(`Looking for categories: ${categories.join(', ')}`);

  const dbRegion = (region || '').toLowerCase().replace(/\s+/g, '_');
  const resolvedRegion = (dbRegion === 'hong_kong' || dbRegion === 'all' || dbRegion === '') ? undefined : dbRegion;

  const stops: LLMStop[] = categories.map(c => ({ label: c, category: c, approx_duration_minutes: 60, notes: '' }));
  const places = await resolveStops(stops, resolvedRegion, budget);

  let semanticPlaces: any[] = [];
  if (!hasSpecificCategory && query_text.length > 5) {
    const semMsg = `Trying semantic search for: "${query_text}"`;
    emit(semMsg); th.push(semMsg);
    try {
      const results = await searchBySemantic(query_text, 8);
      semanticPlaces = results
        .filter((r: any) => {
          const n = r.name || '';
          return !n.match(/^[a-z_]+ \(Kowloon\)$/);
        })
        .map((r: any) => ({
          placeId: r.id,
          label: r.name,
          lat: r.lat,
          lng: r.lng,
          category: r.category || 'attraction',
          similarity: r.similarity,
        }));
      emit(`Semantic search added ${semanticPlaces.length} relevant places`); th.push(`Semantic search added ${semanticPlaces.length} relevant places`);
    } catch (err: any) {
      console.error('Semantic search failed:', err.message);
    }
  }

  const foundMsg = `Found ${places.length} places in ${regionLabel}`;
  emit(foundMsg); th.push(foundMsg);

  const filtered = places.filter(p => !p.label.match(/^[a-z_]+ \(Kowloon\)$/));
  const allPlaces = semanticPlaces.length > 0
    ? [...new Map([...semanticPlaces, ...filtered].map(p => [p.placeId, p])).values()]
    : filtered;
  const names = allPlaces.length > 0 ? allPlaces.map(p => `- ${p.label}`).join('\n') : '(no curated places found for this search)';
  const placesOut = allPlaces.length > 0
    ? allPlaces.map((p, i) => ({ id: p.placeId, name: p.label, lat: p.lat, lng: p.lng, category: p.category || 'attraction' }))
    : places.map((p, i) => ({ id: p.placeId, name: p.label, lat: p.lat, lng: p.lng, category: categories[i] || 'attraction' }));
  searchCache.set(cacheKey, { results: placesOut, timestamp: Date.now() });
  if (searchCache.size > 100) {
    const oldest = [...searchCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
    if (oldest) searchCache.delete(oldest[0]);
  }
  return {
    response: `I found ${allPlaces.length} place${allPlaces.length !== 1 ? 's' : ''} in ${regionLabel}:\n${names}`,
    thinking: th,
    places: placesOut,
  };
}

export async function searchDatabaseTool(query_text: string): Promise<ToolResult> {
  const t = query_text.toLowerCase();
  const rows = await query(
    `SELECT DISTINCT p.id, p.name, p.category, p.lat, p.lng 
     FROM places p 
     WHERE LOWER(p.name) LIKE $1 OR LOWER(p.category) LIKE $1 
     LIMIT 20`,
    [`%${t}%`]
  );
  if (rows.rows.length === 0) return { response: `No places found matching "${query_text}" in the database.` };
  const names = rows.rows.map((r: any) => `${r.name} (${r.category || 'unknown'})`).join(', ');
  return { response: `Found ${rows.rows.length} place(s): ${names}`, places: rows.rows };
}

export async function getPlaceAlternativesTool(placeName: string, _reason: string, category?: string): Promise<ToolResult> {
  const t = placeName.toLowerCase();
  const rows = await query(
    `SELECT id, name, category, lat, lng 
     FROM places 
     WHERE LOWER(name) != $1 AND (LOWER(category) = $2 OR $2 IS NULL)
     ORDER BY RANDOM() LIMIT 5`,
    [t, category || null]
  );
  if (rows.rows.length === 0) {
    return searchDatabaseTool(category || 'attraction');
  }
  const names = rows.rows.map((r: any) => `${r.name} (${r.category || 'unknown'})`).join(', ');
  return {
    response: `Here are some alternatives instead of "${placeName}": ${names}`,
    places: rows.rows,
  };
}
