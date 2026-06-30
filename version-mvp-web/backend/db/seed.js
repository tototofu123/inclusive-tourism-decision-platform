// Seed 10 accessible HK spots into SQLite
const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'mvp.sqlite');
const db = new Database(DB_PATH);

// Create tables from schema
const fs = require('fs');
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

const places = [
  {
    name: 'Hong Kong Park',
    name_zh: '香港公園',
    district: 'Central',
    lat: 22.2776, lng: 114.1627,
    category: 'attraction',
    accessibility_score: 88,
    has_ramp: 1, has_lift: 1, has_accessible_toilet: 1, has_tactile_path: 1,
    bench_count: 20,
    notes: 'Fully accessible paths throughout. Lift access to all levels. Aviary has step-free entry.'
  },
  {
    name: 'Tai Chi Garden (Kowloon Park)',
    name_zh: '九龍公園太極園',
    district: 'Tsim Sha Tsui',
    lat: 22.3009, lng: 114.1694,
    category: 'rest_stop',
    accessibility_score: 82,
    has_ramp: 1, has_lift: 0, has_accessible_toilet: 1, has_tactile_path: 1,
    bench_count: 15,
    notes: 'Flat paved paths, plenty of seating. No lifts but all ground level.'
  },
  {
    name: 'Hong Kong Museum of History',
    name_zh: '香港歷史博物館',
    district: 'Tsim Sha Tsui',
    lat: 22.3042, lng: 114.1758,
    category: 'attraction',
    accessibility_score: 95,
    has_ramp: 1, has_lift: 1, has_accessible_toilet: 1, has_tactile_path: 1,
    bench_count: 30,
    notes: 'Excellent accessibility. Wheelchairs available at entrance for free loan. All exhibits step-free.'
  },
  {
    name: 'Ocean Park Main Entrance Area',
    name_zh: '海洋公園正門區域',
    district: 'Southern',
    lat: 22.2481, lng: 114.1741,
    category: 'attraction',
    accessibility_score: 78,
    has_ramp: 1, has_lift: 1, has_accessible_toilet: 1, has_tactile_path: 0,
    bench_count: 25,
    notes: 'Lower park fully accessible. Cable car has accessible gondola. Some upper park areas have steep gradients.'
  },
  {
    name: 'Temple Street Night Market (South End)',
    name_zh: '廟街夜市（南段）',
    district: 'Yau Ma Tei',
    lat: 22.3082, lng: 114.1697,
    category: 'attraction',
    accessibility_score: 55,
    has_ramp: 0, has_lift: 0, has_accessible_toilet: 0, has_tactile_path: 0,
    bench_count: 5,
    notes: 'Flat road surface but crowded. Best visited early evening. Limited rest seating nearby.'
  },
  {
    name: 'Citygate Outlets',
    name_zh: '東薈城名店倉',
    district: 'Tung Chung',
    lat: 22.2890, lng: 113.9416,
    category: 'rest_stop',
    accessibility_score: 92,
    has_ramp: 1, has_lift: 1, has_accessible_toilet: 1, has_tactile_path: 1,
    bench_count: 40,
    notes: 'Fully step-free mall. Air-conditioned rest areas. Accessible MTR connection (Tung Chung line).'
  },
  {
    name: 'Lung Cheung Road Garden',
    name_zh: '龍翔道花園',
    district: 'Wong Tai Sin',
    lat: 22.3397, lng: 114.1928,
    category: 'rest_stop',
    accessibility_score: 70,
    has_ramp: 1, has_lift: 0, has_accessible_toilet: 1, has_tactile_path: 0,
    bench_count: 12,
    notes: 'Quiet garden with paved paths. Good for rest stops. Gentle slopes only.'
  },
  {
    name: 'Hong Kong Space Museum',
    name_zh: '香港太空館',
    district: 'Tsim Sha Tsui',
    lat: 22.2942, lng: 114.1724,
    category: 'attraction',
    accessibility_score: 90,
    has_ramp: 1, has_lift: 1, has_accessible_toilet: 1, has_tactile_path: 1,
    bench_count: 20,
    notes: 'Excellent accessibility throughout. Planetarium has wheelchair spaces. Waterfront promenade adjacent.'
  },
  {
    name: 'Tsim Sha Tsui Promenade (East)',
    name_zh: '尖沙咀海濱長廊（東）',
    district: 'Tsim Sha Tsui',
    lat: 22.2944, lng: 114.1796,
    category: 'attraction',
    accessibility_score: 85,
    has_ramp: 1, has_lift: 0, has_accessible_toilet: 1, has_tactile_path: 1,
    bench_count: 35,
    notes: 'Flat paved waterfront walkway. Many benches with harbour views. Step-free from MTR exit.'
  },
  {
    name: 'Pacific Place Shopping Mall',
    name_zh: '太古廣場',
    district: 'Admiralty',
    lat: 22.2775, lng: 114.1654,
    category: 'rest_stop',
    accessibility_score: 93,
    has_ramp: 1, has_lift: 1, has_accessible_toilet: 1, has_tactile_path: 1,
    bench_count: 30,
    notes: 'Premium accessible mall. Connected to Admiralty MTR. Excellent rest facilities and dining options.'
  }
];

const insert = db.prepare(`
  INSERT OR REPLACE INTO places 
  (name, name_zh, district, lat, lng, category, accessibility_score, 
   has_ramp, has_lift, has_accessible_toilet, has_tactile_path, bench_count, notes)
  VALUES 
  (@name, @name_zh, @district, @lat, @lng, @category, @accessibility_score,
   @has_ramp, @has_lift, @has_accessible_toilet, @has_tactile_path, @bench_count, @notes)
`);

const insertMany = db.transaction((places) => {
  for (const place of places) insert.run(place);
});

insertMany(places);

const count = db.prepare('SELECT COUNT(*) as count FROM places').get();
console.log(`✅ Seeded ${count.count} places into ${DB_PATH}`);
db.close();
