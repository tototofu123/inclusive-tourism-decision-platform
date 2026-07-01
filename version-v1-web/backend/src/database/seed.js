/**
 * Seed script — inserts sample HK accessible places for local development.
 * Run: node src/database/seed.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { getPool } = require('./pool');

const PLACES = [
  {
    name: 'Hong Kong Museum of History',
    category: 'museum',
    lat: 22.3044, lng: 114.1731,
    address: '100 Chatham Rd S, Tsim Sha Tsui',
    description: 'Free museum with full wheelchair access, lift on all floors.',
    accessibility_tags: ['wheelchair', 'lift', 'accessible_toilet', 'free_entry'],
  },
  {
    name: 'Tsim Sha Tsui Waterfront Promenade',
    category: 'outdoor',
    lat: 22.2967, lng: 114.1717,
    address: 'Tsim Sha Tsui East Promenade',
    description: 'Flat paved promenade with harbour views. Benches every 100m.',
    accessibility_tags: ['wheelchair', 'bench', 'flat_surface', 'scenic'],
  },
  {
    name: 'Hong Kong Park',
    category: 'park',
    lat: 22.2793, lng: 114.1597,
    address: '19 Cotton Tree Dr, Admiralty',
    description: 'Urban park with accessible paths, aviary, and frequent seating.',
    accessibility_tags: ['wheelchair', 'bench', 'accessible_toilet', 'shaded'],
  },
  {
    name: 'Ocean Park (Accessible Route)',
    category: 'attraction',
    lat: 22.2479, lng: 114.1742,
    address: 'Ocean Park Rd, Aberdeen',
    description: 'Accessible cable car alternative (Ocean Express), mobility equipment rental.',
    accessibility_tags: ['wheelchair', 'lift', 'accessible_toilet', 'mobility_rental'],
  },
  {
    name: 'PMQ (Police Married Quarters)',
    category: 'shopping',
    lat: 22.2817, lng: 114.1543,
    address: '35 Aberdeen St, Central',
    description: 'Heritage complex with step-free lift access, cafes with accessible seating.',
    accessibility_tags: ['wheelchair', 'lift', 'cafe', 'accessible_toilet'],
  },
  {
    name: 'Hong Kong Cultural Centre',
    category: 'venue',
    lat: 22.2949, lng: 114.1706,
    address: '10 Salisbury Rd, Tsim Sha Tsui',
    description: 'Performing arts venue, full wheelchair access, priority seating available.',
    accessibility_tags: ['wheelchair', 'lift', 'accessible_toilet', 'priority_seating'],
  },
  {
    name: 'Nan Lian Garden',
    category: 'park',
    lat: 22.3394, lng: 114.1870,
    address: '60 Fung Tak Rd, Diamond Hill',
    description: 'Tang dynasty garden — smooth stone paths, shaded pavilions, frequent seating.',
    accessibility_tags: ['wheelchair', 'bench', 'shaded', 'flat_surface'],
  },
  {
    name: 'Hong Kong Disneyland - Main Street USA',
    category: 'attraction',
    lat: 22.3130, lng: 114.0413,
    address: 'Lantau Island',
    description: 'Full wheelchair access, disability access cards available at City Hall.',
    accessibility_tags: ['wheelchair', 'accessible_toilet', 'lift', 'mobility_rental'],
  },
];

async function seed() {
  const pool = getPool();
  try {
    console.log('Seeding places...');
    for (const p of PLACES) {
      await pool.query(
        `INSERT INTO places (name, category, lat, lng, address, description, accessibility_tags)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT DO NOTHING`,
        [p.name, p.category, p.lat, p.lng, p.address, p.description, p.accessibility_tags]
      );
      console.log(`  ✓ ${p.name}`);
    }
    console.log(`✅ Seeded ${PLACES.length} places.`);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
