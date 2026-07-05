const Database = require('better-sqlite3');
const path = require('path');
process.env.MAPS_API_KEY = 'AIzaSyAcJFWcwd2Sb4WctvuZhL4axGbv9FI8JTc';

const PLACES_BASE = 'https://places.googleapis.com/v1/places:searchText';

const QUERIES = [
  'museum Hong Kong', 'art museum Hong Kong', 'history museum Hong Kong',
  'science museum Hong Kong', 'contemporary art Hong Kong',
  'restaurant Hong Kong', 'fine dining Hong Kong', 'dim sum Hong Kong',
  'seafood restaurant Hong Kong', 'chinese restaurant Hong Kong',
  'japanese restaurant Hong Kong', 'western restaurant Hong Kong',
  'cheap eats Hong Kong', 'rooftop restaurant Hong Kong',
  'cafe Hong Kong', 'coffee shop Hong Kong', 'brunch cafe Hong Kong',
  'shopping mall Hong Kong', 'luxury shopping Hong Kong',
  'electronics store Hong Kong', 'bookstore Hong Kong',
  'tourist attraction Hong Kong', 'landmark Hong Kong',
  'historic site Hong Kong', 'heritage building Hong Kong',
  'park Hong Kong', 'garden Hong Kong', 'waterfront Hong Kong',
  'viewpoint Hong Kong', 'observation deck Hong Kong',
  'skyline view Hong Kong', 'rooftop bar Hong Kong',
  'temple Hong Kong', 'church Hong Kong', 'monastery Hong Kong',
  'market Hong Kong', 'street market Hong Kong', 'night market Hong Kong',
  'art gallery Hong Kong', 'cultural centre Hong Kong',
  'hotel Hong Kong', 'luxury hotel Hong Kong', 'boutique hotel Hong Kong',
  'nature Hong Kong', 'beach Hong Kong', 'hiking trail Hong Kong',
  'amusement park Hong Kong', 'family attraction Hong Kong',
  'nightlife Hong Kong', 'entertainment Hong Kong',
  'library Hong Kong', 'community centre Hong Kong',
];

function getRegion(lat, lng) {
  if (lat > 22.28 && lat < 22.34 && lng > 114.14 && lng < 114.24) return 'kowloon';
  if (lat > 22.22 && lat < 22.30 && lng > 114.10 && lng < 114.24) return 'hong_kong_island';
  return 'new_territories';
}

function inferCategory(types) {
  if (types.some(t => t.includes('museum') || t.includes('art_gallery'))) return types.some(t=>t.includes('art_gallery')) ? 'art_gallery' : 'museum';
  if (types.some(t => t.includes('restaurant') || t.includes('food'))) return 'restaurant';
  if (types.some(t => t.includes('park') || t.includes('garden') || t.includes('beach') || t.includes('natural'))) return 'park';
  if (types.some(t => t.includes('cafe') || t.includes('coffee'))) return 'cafe';
  if (types.some(t => t.includes('shopping_mall') || t.includes('shopping') || t.includes('store') || t.includes('department_store'))) return 'shopping_mall';
  if (types.some(t => t.includes('temple') || t.includes('church') || t.includes('place_of_worship') || t.includes('monastery'))) return 'temple';
  if (types.some(t => t.includes('hotel') || t.includes('lodging'))) return 'hotel';
  if (types.some(t => t.includes('market'))) return 'market';
  if (types.some(t => t.includes('tourist') || t.includes('view') || t.includes('observation') || t.includes('harbor') || t.includes('marina'))) return 'viewpoint';
  if (types.some(t => t.includes('library'))) return 'library';
  if (types.some(t => t.includes('movie') || t.includes('theater') || t.includes('casino') || t.includes('night_club') || t.includes('bar') || t.includes('entertainment'))) return 'entertainment';
  if (types.some(t => t.includes('landmark') || t.includes('historical') || t.includes('memorial') || t.includes('castle'))) return 'historic_site';
  if (types.some(t => t.includes('amusement') || t.includes('zoo') || t.includes('aquarium'))) return 'amusement_park';
  if (types.some(t => t.includes('hiking') || t.includes('trail'))) return 'park';
  return 'attraction';
}

(async () => {
  const dbPath = path.join(__dirname, '..', 'data', 'tourism.db');
  const db = new Database(dbPath);
  
  // Keep existing Google data, just add more
  const currentTotal = db.prepare('SELECT COUNT(*) as c FROM places').get().c;
  console.log(`Current places: ${currentTotal}`);

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
  console.log('Categories:');
  cats.forEach(c => console.log(`  ${c.category}: ${c.c}`));

  db.close();
})();
