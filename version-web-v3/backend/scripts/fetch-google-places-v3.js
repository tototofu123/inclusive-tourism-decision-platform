const Database = require('better-sqlite3');
const path = require('path');
process.env.MAPS_API_KEY = 'AIzaSyAcJFWcwd2Sb4WctvuZhL4axGbv9FI8JTc';
const PLACES_BASE = 'https://places.googleapis.com/v1/places:searchText';

const QUERIES = [
  'bar Hong Kong', 'pub Hong Kong', 'club Hong Kong',
  'vegan restaurant Hong Kong', 'vegetarian restaurant Hong Kong',
  'halal restaurant Hong Kong', 'indian restaurant Hong Kong',
  'italian restaurant Hong Kong', 'french restaurant Hong Kong',
  'thai restaurant Hong Kong', 'korean restaurant Hong Kong',
  'vietnamese restaurant Hong Kong',
  'playground Hong Kong', 'children museum Hong Kong',
  'science centre Hong Kong', 'planetarium Hong Kong',
  'cultural centre Hong Kong', 'performance venue Hong Kong',
  'convention centre Hong Kong', 'exhibition centre Hong Kong',
  'ferry pier Hong Kong', 'harbour Hong Kong',
  'walking trail Hong Kong', 'nature reserve Hong Kong',
  'botanical garden Hong Kong', 'bird park Hong Kong',
  'sports centre Hong Kong', 'swimming pool Hong Kong',
  'disneyland Hong Kong', 'ocean park Hong Kong',
  'heritage trail Hong Kong', 'art centre Hong Kong',
  'clothing store Hong Kong', 'souvenir shop Hong Kong',
  'tea house Hong Kong', 'dessert shop Hong Kong',
  'bakery Hong Kong', 'dim sum restaurant Hong Kong',
  'noodle shop Hong Kong', 'dumpling Hong Kong',
  'dessert Hong Kong', 'ice cream Hong Kong',
];

function getRegion(lat, lng) {
  if (lat > 22.28 && lat < 22.34 && lng > 114.14 && lng < 114.24) return 'kowloon';
  if (lat > 22.22 && lat < 22.30 && lng > 114.10 && lng < 114.24) return 'hong_kong_island';
  return 'new_territories';
}

function inferCategory(types) {
  if (types.some(t => t.includes('museum') || t.includes('art_gallery'))) return types.some(t=>t.includes('art_gallery')) ? 'art_gallery' : 'museum';
  if (types.some(t => t.includes('restaurant') || t.includes('food') || t.includes('meal'))) return 'restaurant';
  if (types.some(t => t.includes('park') || t.includes('garden') || t.includes('beach') || t.includes('natural') || t.includes('playground') || t.includes('reserve'))) return 'park';
  if (types.some(t => t.includes('cafe') || t.includes('coffee') || t.includes('tea'))) return 'cafe';
  if (types.some(t => t.includes('shopping_mall') || t.includes('shopping') || t.includes('store') || t.includes('department_store') || t.includes('souvenir') || t.includes('clothing'))) return 'shopping_mall';
  if (types.some(t => t.includes('temple') || t.includes('church') || t.includes('place_of_worship') || t.includes('monastery'))) return 'temple';
  if (types.some(t => t.includes('hotel') || t.includes('lodging'))) return 'hotel';
  if (types.some(t => t.includes('market'))) return 'market';
  if (types.some(t => t.includes('tourist') || t.includes('view') || t.includes('observation') || t.includes('harbor') || t.includes('marina') || t.includes('ferry') || t.includes('pier'))) return 'viewpoint';
  if (types.some(t => t.includes('library') || t.includes('cultural') || t.includes('convention') || t.includes('exhibition') || t.includes('performance') || t.includes('centre'))) return 'library';
  if (types.some(t => t.includes('movie') || t.includes('theater') || t.includes('casino') || t.includes('night_club') || t.includes('bar') || t.includes('pub') || t.includes('club') || t.includes('entertainment'))) return 'entertainment';
  if (types.some(t => t.includes('landmark') || t.includes('historical') || t.includes('memorial') || t.includes('castle') || t.includes('heritage') || t.includes('trail'))) return 'historic_site';
  if (types.some(t => t.includes('amusement') || t.includes('zoo') || t.includes('aquarium') || t.includes('disney') || t.includes('ocean'))) return 'amusement_park';
  if (types.some(t => t.includes('hiking') || t.includes('trail'))) return 'park';
  if (types.some(t => t.includes('sports') || t.includes('swimming') || t.includes('gym'))) return 'entertainment';
  if (types.some(t => t.includes('planetarium') || t.includes('science') || t.includes('observatory'))) return 'museum';
  return 'attraction';
}

(async () => {
  const dbPath = path.join(__dirname, '..', 'data', 'tourism.db');
  const db = new Database(dbPath);
  const currentTotal = db.prepare('SELECT COUNT(*) as c FROM places').get().c;
  console.log(`Current: ${currentTotal}`);

  const insert = db.prepare(`
    INSERT OR IGNORE INTO places (name, lat, lng, category, description, source_api, region, price_level, accessibility_tags, accessibility_score, phone, website, opening_hours, place_type, address)
    VALUES (?, ?, ?, ?, ?, 'google-places', ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let added = 0;

  for (const query of QUERIES) {
    process.stdout.write(`"${query}"... `);
    try {
      const res = await fetch(PLACES_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': process.env.MAPS_API_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.userRatingCount,places.priceLevel,places.editorialSummary',
        },
        body: JSON.stringify({ textQuery: query, pageSize: 10 }),
      });
      if (!res.ok) { console.log(`HTTP ${res.status}`); continue; }
      const data = await res.json();
      const places = data.places || [];
      console.log(`${places.length} results`);

      for (const p of places) {
        const name = p.displayName?.text || 'Unknown';
        const lat = p.location?.latitude || 0;
        const lng = p.location?.longitude || 0;
        const category = inferCategory(p.types || []);
        const region = getRegion(lat, lng);
        const priceMap = { PRICE_LEVEL_FREE: 'free', PRICE_LEVEL_INEXPENSIVE: 'cheap', PRICE_LEVEL_MODERATE: 'moderate', PRICE_LEVEL_EXPENSIVE: 'expensive' };
        const pl = p.priceLevel ? (priceMap[p.priceLevel] || p.priceLevel.toLowerCase()) : null;
        const ratingStr = p.rating ? `Rating: ${p.rating}/5 (${p.userRatingCount || 0} reviews)` : '';
        const summary = p.editorialSummary?.text || '';
        const desc = [p.formattedAddress, ratingStr, summary].filter(Boolean).join(' · ');
        const info = insert.run(name, lat, lng, category, desc, region, pl, '[]', p.rating >= 4 ? 3 : 1, null, null, null, category, p.formattedAddress || '');
        if (info.changes > 0) added++;
      }
    } catch (err) {
      console.log(`ERROR: ${err.message.slice(0, 100)}`);
    }
  }

  const total = db.prepare('SELECT COUNT(*) as c FROM places').get();
  console.log(`\nAdded: ${added}, Total: ${total.c}`);
  const cats = db.prepare('SELECT category, COUNT(*) as c FROM places GROUP BY category ORDER BY c DESC').all();
  cats.forEach(c => console.log(`  ${c.category}: ${c.c}`));
  db.close();
})();
