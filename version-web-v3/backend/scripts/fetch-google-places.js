const Database = require('better-sqlite3');
const path = require('path');

process.env.MAPS_API_KEY = 'AIzaSyAcJFWcwd2Sb4WctvuZhL4axGbv9FI8JTc';
process.env.LOCAL_DB_DIR = path.join(__dirname, '..', 'data');

const PLACES_BASE = 'https://places.googleapis.com/v1/places:searchText';

const QUERIES = [
  'museum Hong Kong', 'restaurant Hong Kong', 'cafe Hong Kong',
  'shopping mall Hong Kong', 'tourist attraction Hong Kong',
  'historic site Hong Kong', 'park Hong Kong', 'viewpoint Hong Kong',
  'temple Hong Kong', 'art gallery Hong Kong', 'market Hong Kong',
  'hotel Hong Kong', 'dim sum Hong Kong', 'seafood Hong Kong',
  'nature Hong Kong', 'cultural site Hong Kong', 'night market Hong Kong',
  'family attraction Hong Kong', 'rooftop bar Hong Kong', 'landmark Hong Kong',
];

const HK_CENTER = { lat: 22.31, lng: 114.17 };

function getRegion(lat, lng) {
  if (lat > 22.28 && lat < 22.34 && lng > 114.14 && lng < 114.24) return 'kowloon';
  if (lat > 22.22 && lat < 22.30 && lng > 114.10 && lng < 114.24) return 'hong_kong_island';
  return 'new_territories';
}

function inferCategory(types) {
  if (types.some(t => t.includes('museum'))) return 'museum';
  if (types.some(t => t.includes('restaurant') || t.includes('food'))) return 'restaurant';
  if (types.some(t => t.includes('park') || t.includes('garden'))) return 'park';
  if (types.some(t => t.includes('cafe') || t.includes('coffee'))) return 'cafe';
  if (types.some(t => t.includes('shopping') || t.includes('mall') || t.includes('store'))) return 'shopping_mall';
  if (types.some(t => t.includes('temple') || t.includes('church') || t.includes('place_of_worship'))) return 'temple';
  if (types.some(t => t.includes('art_gallery'))) return 'art_gallery';
  if (types.some(t => t.includes('hotel') || t.includes('lodging'))) return 'hotel';
  if (types.some(t => t.includes('market'))) return 'market';
  if (types.some(t => t.includes('tourist') || t.includes('view') || t.includes('harbor') || t.includes('observation'))) return 'viewpoint';
  if (types.some(t => t.includes('library'))) return 'library';
  if (types.some(t => t.includes('movie') || t.includes('theater') || t.includes('entertainment') || t.includes('casino'))) return 'entertainment';
  if (types.some(t => t.includes('landmark') || t.includes('historical') || t.includes('memorial') || t.includes('castle'))) return 'historic_site';
  return 'attraction';
}

(async () => {
  // 1. Clear old seed data
  const dbPath = path.join(__dirname, '..', 'data', 'tourism.db');
  const db = new Database(dbPath);
  db.prepare("DELETE FROM places WHERE source_api LIKE 'seed%'").run();
  console.log('Cleared old seed data');

  const insert = db.prepare(`
    INSERT OR IGNORE INTO places (name, lat, lng, category, description, source_api, region, price_level, accessibility_tags, accessibility_score, phone, website, opening_hours, place_type, address)
    VALUES (?, ?, ?, ?, ?, 'google-places', ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let added = 0;

  for (const query of QUERIES) {
    process.stdout.write(`"${query}"... `);
    try {
      const body = {
        textQuery: query,
        pageSize: 10,
      };
      const res = await fetch(PLACES_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': process.env.MAPS_API_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.userRatingCount,places.priceLevel,places.nationalPhoneNumber,places.websiteUri,places.regularOpeningHours,places.accessibilityOptions,places.editorialSummary',
        },
        body: JSON.stringify(body),
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

        const tags = [];
        if (p.accessibilityOptions?.wheelchairAccessibleEntrance) tags.push('step-free access');
        if (p.accessibilityOptions?.wheelchairAccessibleRestroom) tags.push('accessible toilet');
        const score = tags.length >= 2 ? 5 : tags.length === 1 ? 3 : (p.rating >= 4 ? 3 : 1);

        const priceMap = { PRICE_LEVEL_FREE: 'free', PRICE_LEVEL_INEXPENSIVE: 'cheap', PRICE_LEVEL_MODERATE: 'moderate', PRICE_LEVEL_EXPENSIVE: 'expensive' };
        const pl = p.priceLevel ? (priceMap[p.priceLevel] || p.priceLevel.toLowerCase()) : null;
        const ratingStr = p.rating ? `Rating: ${p.rating}/5 (${p.userRatingCount || 0} reviews)` : '';
        const summary = p.editorialSummary?.text || '';
        const desc = [p.formattedAddress, ratingStr, summary].filter(Boolean).join(' · ');

        const info = insert.run(name, lat, lng, category, desc, region, pl,
          JSON.stringify(tags), score, p.nationalPhoneNumber || null, p.websiteUri || null,
          p.regularOpeningHours?.weekdayDescriptions?.join('; ') || null, category, p.formattedAddress || '');
        if (info.changes > 0) added++;
      }
    } catch (err) {
      console.log(`ERROR: ${err.message.slice(0, 120)}`);
    }
  }

  const total = db.prepare('SELECT COUNT(*) as c FROM places').get();
  console.log(`\nAdded: ${added}, Total: ${total.c}`);

  const cats = db.prepare('SELECT category, COUNT(*) as c FROM places GROUP BY category ORDER BY c DESC').all();
  console.log('Categories:');
  cats.forEach(c => console.log(`  ${c.category}: ${c.c}`));

  const withRating = db.prepare("SELECT COUNT(*) as c FROM places WHERE description LIKE '%Rating:%'").get();
  console.log(`With ratings: ${withRating.c}`);

  const samples = db.prepare("SELECT name, category, description FROM places WHERE description LIKE '%Rating:%' ORDER BY ROWID DESC LIMIT 10").all();
  console.log('\nSample places with ratings:');
  samples.forEach(p => console.log(`  ${p.name} (${p.category}): ${p.description.slice(0, 80)}`));

  db.close();
})();
