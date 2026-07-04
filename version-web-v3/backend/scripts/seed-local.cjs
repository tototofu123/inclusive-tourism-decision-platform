// Seed local SQLite with Hong Kong tourism data
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'data', 'tourism.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS places (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL,
    category TEXT, description TEXT, source_api TEXT DEFAULT 'seed',
    region TEXT, budget TEXT, price_level TEXT, phone TEXT, website TEXT,
    opening_hours TEXT, accessibility_score INTEGER DEFAULT 0,
    accessibility_tags TEXT, address TEXT DEFAULT '', tags TEXT DEFAULT '',
    notes TEXT DEFAULT '', area TEXT DEFAULT '', place_type TEXT DEFAULT 'attraction',
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(name, lat, lng)
  );
  CREATE TABLE IF NOT EXISTS itineraries (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_text TEXT,
    region TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS itinerary_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT, itinerary_id INTEGER REFERENCES itineraries(id),
    place_id INTEGER REFERENCES places(id), stop_index INTEGER, label TEXT,
    start_time TEXT, end_time TEXT, road_distance_meters REAL DEFAULT 0,
    duration_minutes INTEGER DEFAULT 60, route_geometry_json TEXT,
    day_number INTEGER DEFAULT 1, transport_cost REAL DEFAULT 0,
    entry_cost REAL DEFAULT 0, transport_mode TEXT DEFAULT 'walking',
    confirmed INTEGER DEFAULT 0, confirmed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT DEFAULT 'New Chat',
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS session_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT, session_id INTEGER REFERENCES sessions(id),
    role TEXT NOT NULL, content TEXT NOT NULL, intent TEXT, thinking TEXT,
    places_json TEXT, itinerary_id INTEGER, created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS global_preferences (
    id INTEGER PRIMARY KEY DEFAULT 1, mobility TEXT DEFAULT 'none',
    interests TEXT DEFAULT '[]', budget_level TEXT DEFAULT 'medium',
    home_base TEXT DEFAULT '', urgent_mode INTEGER DEFAULT 0,
    confirmed_itinerary_id INTEGER, updated_at TEXT DEFAULT (datetime('now'))
  );
`);

// Clear and seed
db.exec('DELETE FROM places');

const insert = db.prepare(`INSERT OR IGNORE INTO places 
  (name, lat, lng, category, description, region, budget, price_level, phone, website, opening_hours, 
   accessibility_score, accessibility_tags, address, tags, place_type, area)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

const places = [
  // === MUSEUMS ===
  ['Hong Kong Museum of History', 22.3011, 114.1773, 'museum',
   'Comprehensive museum covering HK history with wheelchair access, braille guides, and accessible toilets.',
   'kowloon', 'moderate', 'moderate', '+852 2724 9042', 'https://hk.history.museum',
   'Mon-Wed,Fri 10:00-18:00, Sat-Sun 10:00-19:00', 5, '["wheelchair_accessible","braille","accessible_toilet","step_free"]',
   '100 Chatham Rd South, TST', 'museum,history,culture', 'attraction', 'Tsim Sha Tsui'],
  ['Hong Kong Space Museum', 22.2942, 114.1719, 'museum',
   'Space museum with Omnimax theatre, wheelchair accessible with hearing loops.',
   'kowloon', 'moderate', 'moderate', '+852 2721 0226', 'https://hk.space.museum',
   'Mon-Wed,Fri 13:00-21:00, Sat-Sun 10:00-21:00', 4, '["wheelchair_accessible","hearing_loop","step_free"]',
   '10 Salisbury Rd, TST', 'museum,space,science', 'attraction', 'Tsim Sha Tsui'],
  ['Hong Kong Heritage Discovery Centre', 22.3007, 114.1698, 'museum',
   'Heritage centre in Kowloon Park with accessible entrance and tactile guides.',
   'kowloon', 'free', 'free', '+852 2208 4400', 'https://www.heritage.gov.hk',
   'Mon-Wed,Fri 10:00-18:00, Sat-Sun 10:00-19:00', 3, '["wheelchair_accessible","tactile"]',
   'Kowloon Park, TST', 'museum,heritage,culture', 'attraction', 'Tsim Sha Tsui'],
  ['Hong Kong Science Museum', 22.3016, 114.1775, 'museum',
   'Interactive science museum with step-free access and accessible exhibits.',
   'kowloon', 'moderate', 'moderate', '+852 2732 3232', 'https://hk.science.museum',
   'Mon-Wed,Fri 10:00-19:00, Sat-Sun 10:00-21:00', 4, '["wheelchair_accessible","step_free"]',
   '2 Science Museum Rd, TST East', 'museum,science,interactive', 'attraction', 'Tsim Sha Tsui'],

  // === PARKS ===
  ['Kowloon Park', 22.3014, 114.1700, 'park',
   'Large park with accessible paths, rest areas, bird lake and sculpture trail. Flat terrain suitable for wheelchair/cane users.',
   'kowloon', 'free', 'free', '+852 2724 3344', 'https://www.lcsd.gov.hk/parks/kp',
   'Daily 05:00-00:00', 5, '["wheelchair_accessible","accessible_toilet","rest_areas","step_free"]',
   '22 Salisbury Rd, TST', 'park,nature,accessible', 'attraction', 'Tsim Sha Tsui'],
  ['Hong Kong Park', 22.2773, 114.1614, 'park',
   'Central park with aviary, greenhouse, and accessible paths. Some slopes but manageable.',
   'hong_kong_island', 'free', 'free', '+852 2521 5041', 'https://www.lcsd.gov.hk/parks/hkp',
   'Daily 06:00-23:00', 3, '["wheelchair_accessible","accessible_toilet"]',
   '19 Cotton Tree Dr, Central', 'park,nature,garden', 'attraction', 'Central'],
  ['Victoria Park', 22.2809, 114.1888, 'park',
   'Large park in Causeway Bay with flat paths, swimming pool complex, and sports facilities.',
   'hong_kong_island', 'free', 'free', '+852 2570 6186', '',
   'Daily 05:00-23:00', 4, '["wheelchair_accessible","accessible_toilet","step_free"]',
   '1 Hing Fat St, Causeway Bay', 'park,sports,recreation', 'attraction', 'Causeway Bay'],

  // === RESTAURANTS ===
  ['Tim Ho Wan (TST)', 22.3042, 114.1722, 'restaurant',
   'Michelin-starred dim sum restaurant. Ground floor location, accessible entrance. Famous for BBQ pork buns.',
   'kowloon', 'budget', 'budget', '+852 2332 3078', '',
   'Daily 10:00-21:30', 3, '["wheelchair_accessible","step_free"]',
   '9-11 Fuk Wing St, Sham Shui Po', 'dimsum,chinese,michelin', 'restaurant', 'Tsim Sha Tsui'],
  ['Din Tai Fung (Harbour City)', 22.2949, 114.1688, 'restaurant',
   'Famous Taiwanese soup dumplings. Located in Harbour City mall with full wheelchair access.',
   'kowloon', 'moderate', 'moderate', '+852 2730 6928', '',
   'Daily 11:00-22:00', 5, '["wheelchair_accessible","accessible_toilet","step_free"]',
   'Shop 3002, 3/F Harbour City, TST', 'taiwanese,dumplings,mall', 'restaurant', 'Tsim Sha Tsui'],
  ['Australia Dairy Company', 22.3049, 114.1706, 'restaurant',
   'Famous HK-style cafe. Budget-friendly, quick service. Narrow entrance but step-free.',
   'kowloon', 'cheap', 'budget', '+852 2730 1356', '',
   'Daily 07:30-22:00', 2, '["step_free"]',
   '47-49 Parkes St, Jordan', 'cha chaan teng,hk style,budget', 'restaurant', 'Jordan'],
  ['Mido Cafe', 22.3046, 114.1703, 'restaurant',
   'Iconic retro cha chaan teng in Jordan. Budget-friendly HK-style comfort food.',
   'kowloon', 'cheap', 'budget', '+852 2384 6402', '',
   'Daily 07:00-22:00', 1, '[]',
   '63 Temple St, Jordan', 'cha chaan teng,retro,budget', 'restaurant', 'Jordan'],
  ['Yat Lok Restaurant', 22.2838, 114.1537, 'restaurant',
   'Michelin-starred roasted goose. Ground floor with step-free access near Central.',
   'hong_kong_island', 'moderate', 'moderate', '+852 2524 3882', '',
   'Daily 10:00-21:00', 3, '["step_free"]',
   '34-38 Stanley St, Central', 'roast goose,chinese,michelin', 'restaurant', 'Central'],
  ['Luk Yu Tea House', 22.2795, 114.1588, 'restaurant',
   'Historic tea house with traditional dim sum in Central. Classic HK experience.',
   'hong_kong_island', 'expensive', 'expensive', '+852 2523 5464', '',
   'Daily 07:00-22:00', 2, '["step_free"]',
   '22 Stanley St, Central', 'dimsum,tea house,traditional', 'restaurant', 'Central'],

  // === LANDMARKS ===
  ['The Peak', 22.2713, 114.1499, 'landmark',
   'Victoria Peak with panoramic views. Peak Tram has wheelchair spaces. Upper terminal is accessible.',
   'hong_kong_island', 'moderate', 'expensive', '+852 2849 0668', 'https://www.thepeak.com.hk',
   'Peak Tram 07:00-22:00', 3, '["wheelchair_accessible","step_free"]',
   'Victoria Gap', 'peak,view,landmark', 'attraction', 'Central'],
  ['Tsim Sha Tsui Promenade', 22.2938, 114.1722, 'landmark',
   'Waterfront walkway with stunning HK skyline views. Flat, wide paths. Avenue of Stars.',
   'kowloon', 'free', 'free', '', '',
   'Daily 24 hours', 5, '["wheelchair_accessible","accessible_toilet","step_free","rest_areas"]',
   'Salisbury Rd, TST', 'promenade,view,waterfront', 'attraction', 'Tsim Sha Tsui'],
  ['Clock Tower', 22.2939, 114.1698, 'landmark',
   'Historic landmark at TST Ferry Pier. Flat area with accessible paths.',
   'kowloon', 'free', 'free', '', '',
   'Daily 24 hours', 4, '["wheelchair_accessible","step_free"]',
   'TST Ferry Concourse', 'landmark,history,heritage', 'attraction', 'Tsim Sha Tsui'],
  ['Wong Tai Sin Temple', 22.3429, 114.1931, 'landmark',
   'Famous Taoist temple. Accessible entrance and paths. Ramped access to main hall.',
   'kowloon', 'free', 'free', '+852 2327 8141', '',
   'Daily 07:00-17:30', 3, '["wheelchair_accessible","step_free"]',
   '2 Chuk Yuen Rd, Wong Tai Sin', 'temple,taoist,culture', 'attraction', 'Wong Tai Sin'],

  // === SHOPPING ===
  ['Harbour City', 22.2953, 114.1689, 'shopping',
   'Massive mall complex in TST with full wheelchair access, accessible toilets, and wide corridors.',
   'kowloon', 'expensive', 'expensive', '+852 2118 8666', 'https://www.harbourcity.com.hk',
   'Daily 10:00-22:00', 5, '["wheelchair_accessible","accessible_toilet","step_free","hearing_loop"]',
   '3-27 Canton Rd, TST', 'shopping,mall,waterfront', 'attraction', 'Tsim Sha Tsui'],
  ['Elements Mall', 22.3044, 114.1616, 'shopping',
   'Accessible mall above Kowloon Station. Wide corridors, accessible toilets, quiet areas.',
   'kowloon', 'expensive', 'expensive', '+852 2735 5234', 'https://www.elementshk.com',
   'Daily 10:00-22:00', 5, '["wheelchair_accessible","accessible_toilet","step_free","quiet_area"]',
   '1 Austin Rd West, West Kowloon', 'shopping,mall,accessible', 'attraction', 'West Kowloon'],

  // === MTR STATIONS (key accessible ones) ===
  ['Tsim Sha Tsui MTR', 22.2972, 114.1725, 'transit',
   'Major MTR interchange (Tsuen Wan Line). Step-free access, accessible toilets, tactile guide paths.',
   'kowloon', 'budget', '', '', '',
   'Daily 06:00-01:00', 5, '["wheelchair_accessible","accessible_toilet","tactile","step_free"]',
   'TST, Kowloon', 'mtr,transit,accessible', 'transit', 'Tsim Sha Tsui'],
  ['Mong Kok MTR', 22.3182, 114.1699, 'transit',
   'Busy station with step-free access and tactile guide paths. Multiple exits.',
   'kowloon', 'budget', '', '', '',
   'Daily 06:00-01:00', 3, '["wheelchair_accessible","tactile","step_free"]',
   'Mong Kok, Kowloon', 'mtr,transit', 'transit', 'Mong Kok'],
  ['Hung Hom MTR', 22.3038, 114.1869, 'transit',
   'Cross-border station with full accessibility. Ramps, lifts, accessible toilets.',
   'kowloon', 'budget', '', '', '',
   'Daily 06:00-01:00', 5, '["wheelchair_accessible","accessible_toilet","step_free"]',
   'Hung Hom, Kowloon', 'mtr,transit,cross-border', 'transit', 'Hung Hom'],
  ['Kowloon Tong MTR', 22.3377, 114.1765, 'transit',
   'Major interchange (East Rail + Kwun Tong Lines). Step-free with accessible facilities.',
   'kowloon', 'budget', '', '', '',
   'Daily 06:00-01:00', 4, '["wheelchair_accessible","accessible_toilet","step_free"]',
   'Kowloon Tong', 'mtr,transit,interchange', 'transit', 'Kowloon Tong'],
  ['Central MTR', 22.2817, 114.1586, 'transit',
   'Major HK Island hub. Step-free access, tactile paths, accessible toilets.',
   'hong_kong_island', 'budget', '', '', '',
   'Daily 06:00-01:00', 4, '["wheelchair_accessible","accessible_toilet","tactile","step_free"]',
   'Central, HK Island', 'mtr,transit,hub', 'transit', 'Central'],
];

const insertMany = db.transaction((items) => {
  for (const p of items) insert.run(...p);
});
insertMany(places);

const count = db.prepare('SELECT COUNT(*) as c FROM places').get();
console.log(`Seeded ${count.c} places to local DB`);
db.close();
