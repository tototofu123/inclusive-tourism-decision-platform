// Seed script: populate tourism.db with 100+ real Hong Kong places
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'tourism.db');
const db = new Database(DB_PATH);

// Ensure schema exists
db.exec(`
  CREATE TABLE IF NOT EXISTS places (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    category TEXT,
    description TEXT,
    source_api TEXT DEFAULT 'seed',
    region TEXT,
    budget TEXT,
    price_level TEXT,
    phone TEXT,
    website TEXT,
    opening_hours TEXT,
    accessibility_score INTEGER DEFAULT 0,
    accessibility_tags TEXT,
    address TEXT DEFAULT '',
    tags TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    area TEXT DEFAULT '',
    place_type TEXT DEFAULT 'attraction',
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(name, lat, lng)
  );
`);

const places = [
  // === MUSEUMS ===
  { name: 'Hong Kong Museum of History', lat: 22.3015, lng: 114.1776, category: 'museum', region: 'kowloon', area: 'Tsim Sha Tsui', description: 'Comprehensive museum covering HK history from prehistoric to modern.', accessibility_score: 5, price_level: 'free', place_type: 'museum' },
  { name: 'Hong Kong Science Museum', lat: 22.3018, lng: 114.1774, category: 'museum', region: 'kowloon', area: 'Tsim Sha Tsui', description: 'Interactive science museum with 500+ exhibits.', accessibility_score: 4, price_level: 'moderate', place_type: 'museum' },
  { name: 'Hong Kong Space Museum', lat: 22.2948, lng: 114.1706, category: 'museum', region: 'kowloon', area: 'Tsim Sha Tsui', description: 'Dome-shaped planetarium and space exhibits.', accessibility_score: 5, price_level: 'moderate', place_type: 'museum' },
  { name: 'M+ Museum', lat: 22.3005, lng: 114.1625, category: 'museum', region: 'kowloon', area: 'West Kowloon', description: 'World-class contemporary art museum in West Kowloon Cultural District.', accessibility_score: 5, price_level: 'moderate', place_type: 'museum' },
  { name: 'Hong Kong Palace Museum', lat: 22.3010, lng: 114.1630, category: 'museum', region: 'kowloon', area: 'West Kowloon', description: 'Exquisite exhibits of Chinese art and culture from the Palace Museum.', accessibility_score: 5, price_level: 'moderate', place_type: 'museum' },
  { name: 'Hong Kong Heritage Museum', lat: 22.3817, lng: 114.1874, category: 'museum', region: 'new_territories', area: 'Sha Tin', description: 'Museum of HK history, art, and culture in Sha Tin.', accessibility_score: 4, price_level: 'moderate', place_type: 'museum' },
  { name: 'Dr Sun Yat-sen Museum', lat: 22.2831, lng: 114.1502, category: 'museum', region: 'hong_kong_island', area: 'Mid-Levels', description: 'Historical museum about Dr Sun Yat-sen in a restored mansion.', accessibility_score: 3, price_level: 'free', place_type: 'museum' },
  { name: 'Hong Kong Maritime Museum', lat: 22.2904, lng: 114.1613, category: 'museum', region: 'hong_kong_island', area: 'Central', description: 'Maritime history museum at Central Pier 8.', accessibility_score: 4, price_level: 'moderate', place_type: 'museum' },
  { name: 'Flagstaff House Museum of Tea Ware', lat: 22.2775, lng: 114.1650, category: 'museum', region: 'hong_kong_island', area: 'Central', description: 'Tea ware museum in the oldest colonial building in HK.', accessibility_score: 3, price_level: 'free', place_type: 'museum' },
  { name: 'Lei Cheng Uk Han Tomb Museum', lat: 22.3375, lng: 114.1600, category: 'museum', region: 'kowloon', area: 'Sham Shui Po', description: 'Ancient Han dynasty tomb discovered in 1955.', accessibility_score: 3, price_level: 'free', place_type: 'museum' },

  // === PARKS ===
  { name: 'Kowloon Park', lat: 22.3025, lng: 114.1700, category: 'park', region: 'kowloon', area: 'Tsim Sha Tsui', description: 'Large public park with a lake, bird aviary, sculpture walk, and swimming pool.', accessibility_score: 5, price_level: 'free', place_type: 'park' },
  { name: 'Hong Kong Park', lat: 22.2775, lng: 114.1610, category: 'park', region: 'hong_kong_island', area: 'Central', description: 'Urban park with aviary, greenhouse, and waterfall.', accessibility_score: 4, price_level: 'free', place_type: 'park' },
  { name: 'Victoria Park', lat: 22.2800, lng: 114.1880, category: 'park', region: 'hong_kong_island', area: 'Causeway Bay', description: 'Largest public park on HK Island with sports facilities.', accessibility_score: 5, price_level: 'free', place_type: 'park' },
  { name: 'Nan Lian Garden', lat: 22.3360, lng: 114.2040, category: 'park', region: 'kowloon', area: 'Diamond Hill', description: 'Tang dynasty-style classical Chinese garden.', accessibility_score: 4, price_level: 'free', place_type: 'park' },
  { name: 'Hong Kong Zoological & Botanical Gardens', lat: 22.2780, lng: 114.1560, category: 'park', region: 'hong_kong_island', area: 'Central', description: 'Oldest park in HK with animals and plants.', accessibility_score: 3, price_level: 'free', place_type: 'park' },
  { name: 'Ocean Park', lat: 22.2467, lng: 114.1690, category: 'park', region: 'hong_kong_island', area: 'Wong Chuk Hang', description: 'Marine mammal park, oceanarium, and amusement park.', accessibility_score: 4, price_level: 'expensive', place_type: 'amusement_park' },
  { name: 'Hong Kong Wetland Park', lat: 22.4680, lng: 113.9980, category: 'park', region: 'new_territories', area: 'Tin Shui Wai', description: '60-hectare wetland reserve with boardwalks and bird hides.', accessibility_score: 4, price_level: 'moderate', place_type: 'park' },
  { name: 'Tsz Shan Monastery Garden', lat: 22.4710, lng: 114.2010, category: 'park', region: 'new_territories', area: 'Tai Po', description: 'Peaceful gardens with the iconic Guan Yin statue.', accessibility_score: 3, price_level: 'free', place_type: 'park' },
  { name: 'Kowloon Walled City Park', lat: 22.3320, lng: 114.1890, category: 'park', region: 'kowloon', area: 'Kowloon City', description: 'Jiangnan-style garden on the site of the former Walled City.', accessibility_score: 4, price_level: 'free', place_type: 'park' },

  // === TEMPLES ===
  { name: 'Wong Tai Sin Temple', lat: 22.3420, lng: 114.1930, category: 'temple', region: 'kowloon', area: 'Wong Tai Sin', description: 'Famous Taoist temple known for fortune-telling.', accessibility_score: 4, price_level: 'free', place_type: 'temple' },
  { name: 'Man Mo Temple', lat: 22.2850, lng: 114.1510, category: 'temple', region: 'hong_kong_island', area: 'Sheung Wan', description: 'Historic temple dedicated to the gods of literature and war.', accessibility_score: 3, price_level: 'free', place_type: 'temple' },
  { name: 'Tin Hau Temple (Repulse Bay)', lat: 22.2370, lng: 114.1940, category: 'temple', region: 'hong_kong_island', area: 'Repulse Bay', description: 'Seaside temple dedicated to the sea goddess Tin Hau.', accessibility_score: 3, price_level: 'free', place_type: 'temple' },
  { name: 'Chi Lin Nunnery', lat: 22.3350, lng: 114.2030, category: 'temple', region: 'kowloon', area: 'Diamond Hill', description: 'Buddhist nunnery with Tang dynasty architecture.', accessibility_score: 4, price_level: 'free', place_type: 'temple' },
  { name: 'Ten Thousand Buddhas Monastery', lat: 22.3840, lng: 114.1900, category: 'temple', region: 'new_territories', area: 'Sha Tin', description: 'Monastery with 12,800 Buddha statues up a steep path.', accessibility_score: 1, price_level: 'free', place_type: 'temple' },
  { name: 'Po Lin Monastery', lat: 22.2540, lng: 113.9050, category: 'temple', region: 'lantau', area: 'Ngong Ping', description: 'Buddhist monastery home to the Big Buddha statue.', accessibility_score: 3, price_level: 'free', place_type: 'temple' },
  { name: 'Hung Shing Temple', lat: 22.2810, lng: 114.1310, category: 'temple', region: 'hong_kong_island', area: 'Kennedy Town', description: 'Grade I historic building on Kennedy Town waterfront.', accessibility_score: 2, price_level: 'free', place_type: 'temple' },

  // === LANDMARKS / VIEWPOINTS ===
  { name: 'Victoria Peak', lat: 22.2750, lng: 114.1450, category: 'viewpoint', region: 'hong_kong_island', area: 'The Peak', description: 'Highest point on HK Island with panoramic views.', accessibility_score: 4, price_level: 'moderate', place_type: 'viewpoint' },
  { name: 'Tsim Sha Tsui Promenade', lat: 22.2950, lng: 114.1720, category: 'viewpoint', region: 'kowloon', area: 'Tsim Sha Tsui', description: 'Waterfront walkway with stunning HK skyline views.', accessibility_score: 5, price_level: 'free', place_type: 'viewpoint' },
  { name: 'Sky100 Observation Deck', lat: 22.3025, lng: 114.1610, category: 'viewpoint', region: 'kowloon', area: 'West Kowloon', description: '360-degree views from the 100th floor of ICC.', accessibility_score: 5, price_level: 'expensive', place_type: 'viewpoint' },
  { name: 'Avenue of Stars', lat: 22.2940, lng: 114.1725, category: 'viewpoint', region: 'kowloon', area: 'Tsim Sha Tsui', description: 'HK version of Hollywood Walk of Fame along the harbour.', accessibility_score: 5, price_level: 'free', place_type: 'viewpoint' },
  { name: 'Lion Rock', lat: 22.3530, lng: 114.1870, category: 'viewpoint', region: 'kowloon', area: 'Kowloon', description: 'Iconic mountain with hiking trail and panoramic views.', accessibility_score: 1, price_level: 'free', place_type: 'viewpoint' },
  { name: 'Dragon\'s Back', lat: 22.2260, lng: 114.2050, category: 'viewpoint', region: 'hong_kong_island', area: 'Shek O', description: 'Scenic hiking ridge with coastal views.', accessibility_score: 1, price_level: 'free', place_type: 'viewpoint' },

  // === SHOPPING ===
  { name: 'Harbour City', lat: 22.2955, lng: 114.1680, category: 'shopping_mall', region: 'kowloon', area: 'Tsim Sha Tsui', description: 'One of the largest shopping malls in HK with 450+ shops.', accessibility_score: 5, price_level: 'expensive', place_type: 'shopping_mall' },
  { name: 'IFC Mall', lat: 22.2845, lng: 114.1580, category: 'shopping_mall', region: 'hong_kong_island', area: 'Central', description: 'Luxury shopping mall in the IFC complex.', accessibility_score: 5, price_level: 'expensive', place_type: 'shopping_mall' },
  { name: 'Times Square', lat: 22.2785, lng: 114.1820, category: 'shopping_mall', region: 'hong_kong_island', area: 'Causeway Bay', description: 'Iconic shopping centre in Causeway Bay.', accessibility_score: 5, price_level: 'moderate', place_type: 'shopping_mall' },
  { name: 'Langham Place', lat: 22.3175, lng: 114.1690, category: 'shopping_mall', region: 'kowloon', area: 'Mong Kok', description: '15-storey shopping mall in Mong Kok.', accessibility_score: 5, price_level: 'moderate', place_type: 'shopping_mall' },
  { name: 'Elements Mall', lat: 22.3050, lng: 114.1600, category: 'shopping_mall', region: 'kowloon', area: 'West Kowloon', description: 'Luxury mall connected to ICC and airport express.', accessibility_score: 5, price_level: 'expensive', place_type: 'shopping_mall' },
  { name: 'Cityplaza', lat: 22.2870, lng: 114.2140, category: 'shopping_mall', region: 'hong_kong_island', area: 'Taikoo Shing', description: 'Large shopping centre in Taikoo Shing.', accessibility_score: 5, price_level: 'moderate', place_type: 'shopping_mall' },
  { name: 'Ladies Market', lat: 22.3190, lng: 114.1700, category: 'market', region: 'kowloon', area: 'Mong Kok', description: 'Famous street market with clothing and accessories.', accessibility_score: 2, price_level: 'cheap', place_type: 'market' },
  { name: 'Temple Street Night Market', lat: 22.3070, lng: 114.1695, category: 'market', region: 'kowloon', area: 'Jordan', description: 'Evening market with food, clothing, and souvenirs.', accessibility_score: 2, price_level: 'cheap', place_type: 'market' },
  { name: 'Stanley Market', lat: 22.2185, lng: 114.2100, category: 'market', region: 'hong_kong_island', area: 'Stanley', description: 'Tourist market on the south side of HK Island.', accessibility_score: 3, price_level: 'moderate', place_type: 'market' },
  { name: 'Goldfish Market', lat: 22.3180, lng: 114.1690, category: 'market', region: 'kowloon', area: 'Mong Kok', description: 'Street market selling aquarium fish and supplies.', accessibility_score: 3, price_level: 'cheap', place_type: 'market' },
  { name: 'Flower Market', lat: 22.3200, lng: 114.1700, category: 'market', region: 'kowloon', area: 'Prince Edward', description: 'Vibrant flower market in Prince Edward.', accessibility_score: 3, price_level: 'cheap', place_type: 'market' },
  { name: 'Apm Mall', lat: 22.3120, lng: 114.2250, category: 'shopping_mall', region: 'kowloon', area: 'Kwun Tong', description: 'Youth-oriented shopping mall in Kwun Tong.', accessibility_score: 4, price_level: 'moderate', place_type: 'shopping_mall' },

  // === RESTAURANTS ===
  { name: 'Tim Ho Wan (Sham Shui Po)', lat: 22.3280, lng: 114.1620, category: 'restaurant', region: 'kowloon', area: 'Sham Shui Po', description: 'Michelin-starred dim sum at budget prices.', accessibility_score: 3, price_level: 'cheap', place_type: 'restaurant' },
  { name: 'Yung Kee Restaurant', lat: 22.2820, lng: 114.1550, category: 'restaurant', region: 'hong_kong_island', area: 'Central', description: 'Famous for roast goose since 1942.', accessibility_score: 3, price_level: 'expensive', place_type: 'restaurant' },
  { name: 'Kam\'s Roast Goose', lat: 22.2835, lng: 114.1520, category: 'restaurant', region: 'hong_kong_island', area: 'Wan Chai', description: 'Michelin-starred roast goose specialist.', accessibility_score: 3, price_level: 'expensive', place_type: 'restaurant' },
  { name: 'Din Tai Fung (Causeway Bay)', lat: 22.2790, lng: 114.1830, category: 'restaurant', region: 'hong_kong_island', area: 'Causeway Bay', description: 'Famous Taiwanese xiaolongbao (soup dumplings).', accessibility_score: 4, price_level: 'moderate', place_type: 'restaurant' },
  { name: 'One Dim Sum', lat: 22.3050, lng: 114.1700, category: 'restaurant', region: 'kowloon', area: 'Prince Edward', description: 'Michelin Bib Gourmand dim sum restaurant.', accessibility_score: 3, price_level: 'cheap', place_type: 'restaurant' },
  { name: 'Australia Dairy Company', lat: 22.3080, lng: 114.1690, category: 'restaurant', region: 'kowloon', area: 'Jordan', description: 'Classic HK-style cha chaan teng for breakfast.', accessibility_score: 2, price_level: 'cheap', place_type: 'restaurant' },
  { name: 'Tsui Wah Restaurant', lat: 22.2960, lng: 114.1710, category: 'restaurant', region: 'kowloon', area: 'Tsim Sha Tsui', description: 'Popular cha chaan teng chain with diverse menu.', accessibility_score: 4, price_level: 'moderate', place_type: 'restaurant' },
  { name: 'Luk Yu Tea House', lat: 22.2800, lng: 114.1580, category: 'restaurant', region: 'hong_kong_island', area: 'Central', description: 'Traditional dim sum teahouse established 1933.', accessibility_score: 2, price_level: 'expensive', place_type: 'restaurant' },
  { name: 'Joy Hing Roasted Meat', lat: 22.2830, lng: 114.1510, category: 'restaurant', region: 'hong_kong_island', area: 'Wan Chai', description: 'Iconic siu mei (roasted meat) shop since 1962.', accessibility_score: 2, price_level: 'cheap', place_type: 'restaurant' },
  { name: 'Café Gray Deluxe', lat: 22.2780, lng: 114.1720, category: 'restaurant', region: 'hong_kong_island', area: 'Admiralty', description: 'Fine dining with stunning harbour views.', accessibility_score: 5, price_level: 'expensive', place_type: 'restaurant' },
  { name: 'The Chairman', lat: 22.2835, lng: 114.1530, category: 'restaurant', region: 'hong_kong_island', area: 'Central', description: 'Award-winning Cantonese fine dining.', accessibility_score: 3, price_level: 'expensive', place_type: 'restaurant' },
  { name: 'Tsim Chai Kee Noodle', lat: 22.2830, lng: 114.1530, category: 'restaurant', region: 'hong_kong_island', area: 'Central', description: 'Michelin Bib Gourmand wonton noodle shop.', accessibility_score: 2, price_level: 'cheap', place_type: 'restaurant' },

  // === CAFES ===
  { name: 'The Coffee Academics (TST)', lat: 22.2980, lng: 114.1720, category: 'cafe', region: 'kowloon', area: 'Tsim Sha Tsui', description: 'Specialty coffee with a modern industrial vibe.', accessibility_score: 4, price_level: 'moderate', place_type: 'cafe' },
  { name: 'Elephant Grounds (TST)', lat: 22.2950, lng: 114.1700, category: 'cafe', region: 'kowloon', area: 'Tsim Sha Tsui', description: 'Trendy cafe with specialty coffee and brunch.', accessibility_score: 4, price_level: 'moderate', place_type: 'cafe' },
  { name: 'Starbucks Duddell Street', lat: 22.2820, lng: 114.1560, category: 'cafe', region: 'hong_kong_island', area: 'Central', description: 'Retro HK-themed Starbucks in a historic building.', accessibility_score: 2, price_level: 'moderate', place_type: 'cafe' },
  { name: 'Common Ground (Sheung Wan)', lat: 22.2855, lng: 114.1510, category: 'cafe', region: 'hong_kong_island', area: 'Sheung Wan', description: 'Minimalist cafe with specialty pour-over coffee.', accessibility_score: 3, price_level: 'moderate', place_type: 'cafe' },
  { name: 'Halfway Coffee', lat: 22.2850, lng: 114.1520, category: 'cafe', region: 'hong_kong_island', area: 'Sheung Wan', description: 'Retro cafe serving coffee in vintage Chinese cups.', accessibility_score: 2, price_level: 'moderate', place_type: 'cafe' },
  { name: 'Omotesando Koffee', lat: 22.2780, lng: 114.1800, category: 'cafe', region: 'hong_kong_island', area: 'Causeway Bay', description: 'Japanese minimalist coffee shop.', accessibility_score: 3, price_level: 'moderate', place_type: 'cafe' },
  { name: 'Knockbox Coffee Company', lat: 22.2830, lng: 114.1700, category: 'cafe', region: 'hong_kong_island', area: 'Wan Chai', description: 'Specialty coffee roaster with champion baristas.', accessibility_score: 3, price_level: 'moderate', place_type: 'cafe' },
  { name: 'Cafe Sausalito', lat: 22.3020, lng: 114.1710, category: 'cafe', region: 'kowloon', area: 'Tsim Sha Tsui', description: 'Cosy cafe in the HK Museum of Art.', accessibility_score: 5, price_level: 'moderate', place_type: 'cafe' },

  // === ART GALLERIES ===
  { name: 'Hong Kong Museum of Art', lat: 22.2935, lng: 114.1695, category: 'art_gallery', region: 'kowloon', area: 'Tsim Sha Tsui', description: 'Extensive collection of Chinese art and modern HK art.', accessibility_score: 5, price_level: 'free', place_type: 'art_gallery' },
  { name: 'PMQ Central', lat: 22.2835, lng: 114.1535, category: 'art_gallery', region: 'hong_kong_island', area: 'Central', description: 'Creative hub in a former police quarters with galleries and studios.', accessibility_score: 4, price_level: 'free', place_type: 'art_gallery' },
  { name: 'Tai Kwun Centre for Heritage and Arts', lat: 22.2825, lng: 114.1540, category: 'art_gallery', region: 'hong_kong_island', area: 'Central', description: 'Restored police station turned arts complex.', accessibility_score: 5, price_level: 'free', place_type: 'art_gallery' },
  { name: 'Para Site', lat: 22.2810, lng: 114.1750, category: 'art_gallery', region: 'hong_kong_island', area: 'Quarry Bay', description: 'Leading contemporary art space in HK.', accessibility_score: 3, price_level: 'free', place_type: 'art_gallery' },
  { name: 'Gagosian Gallery', lat: 22.2815, lng: 114.1560, category: 'art_gallery', region: 'hong_kong_island', area: 'Central', description: 'World-renowned contemporary art gallery.', accessibility_score: 4, price_level: 'free', place_type: 'art_gallery' },

  // === HISTORIC SITES ===
  { name: 'Former Kowloon-Canton Railway Clock Tower', lat: 22.2930, lng: 114.1700, category: 'historic_site', region: 'kowloon', area: 'Tsim Sha Tsui', description: 'Iconic 44m clock tower from 1915.', accessibility_score: 5, price_level: 'free', place_type: 'historic_site' },
  { name: 'Murray House', lat: 22.2190, lng: 114.2100, category: 'historic_site', region: 'hong_kong_island', area: 'Stanley', description: '1844 building relocated from Central to Stanley.', accessibility_score: 4, price_level: 'free', place_type: 'historic_site' },
  { name: 'Western Market', lat: 22.2870, lng: 114.1490, category: 'historic_site', region: 'hong_kong_island', area: 'Sheung Wan', description: '1906 Edwardian-style market building.', accessibility_score: 3, price_level: 'free', place_type: 'historic_site' },
  { name: 'Blue House', lat: 22.2850, lng: 114.1500, category: 'historic_site', region: 'hong_kong_island', area: 'Wan Chai', description: '1920s blue-painted tenement building.', accessibility_score: 2, price_level: 'free', place_type: 'historic_site' },
  { name: 'Kowloon City Walled Site & Yamen', lat: 22.3310, lng: 114.1880, category: 'historic_site', region: 'kowloon', area: 'Kowloon City', description: 'Remains of the Qing dynasty yamen inside Walled City Park.', accessibility_score: 4, price_level: 'free', place_type: 'historic_site' },

  // === HOTELS ===
  { name: 'The Peninsula Hong Kong', lat: 22.2950, lng: 114.1710, category: 'hotel', region: 'kowloon', area: 'Tsim Sha Tsui', description: 'Historic luxury hotel known as the "Grande Dame of the Far East".', accessibility_score: 5, price_level: 'expensive', place_type: 'hotel' },
  { name: 'The Ritz-Carlton Hong Kong', lat: 22.3030, lng: 114.1615, category: 'hotel', region: 'kowloon', area: 'West Kowloon', description: 'Luxury hotel occupying floors 102-118 of ICC.', accessibility_score: 5, price_level: 'expensive', place_type: 'hotel' },
  { name: 'Four Seasons Hong Kong', lat: 22.2870, lng: 114.1560, category: 'hotel', region: 'hong_kong_island', area: 'Central', description: 'Waterfront luxury hotel in IFC.', accessibility_score: 5, price_level: 'expensive', place_type: 'hotel' },
  { name: 'Harbour Grand Kowloon', lat: 22.3050, lng: 114.1830, category: 'hotel', region: 'kowloon', area: 'Hung Hom', description: 'Waterfront hotel with harbour views.', accessibility_score: 4, price_level: 'moderate', place_type: 'hotel' },
  { name: 'W Hong Kong', lat: 22.3040, lng: 114.1620, category: 'hotel', region: 'kowloon', area: 'West Kowloon', description: 'Modern luxury hotel in the W Hotel brand.', accessibility_score: 5, price_level: 'expensive', place_type: 'hotel' },
  { name: 'Hotel ICON', lat: 22.3040, lng: 114.1690, category: 'hotel', region: 'kowloon', area: 'Tsim Sha Tsui', description: 'Design hotel operated by PolyU\'s hotel school.', accessibility_score: 5, price_level: 'moderate', place_type: 'hotel' },

  // === ADDITIONAL ATTRACTIONS ===
  { name: 'Hong Kong Disneyland', lat: 22.3125, lng: 114.0410, category: 'park', region: 'lantau', area: 'Sunny Bay', description: 'Disney theme park with 7 themed lands.', accessibility_score: 5, price_level: 'expensive', place_type: 'amusement_park' },
  { name: 'Ngong Ping 360', lat: 22.2540, lng: 113.9040, category: 'viewpoint', region: 'lantau', area: 'Ngong Ping', description: 'Cable car ride to the Big Buddha on Lantau Island.', accessibility_score: 4, price_level: 'expensive', place_type: 'viewpoint' },
  { name: 'Big Buddha (Tian Tan Buddha)', lat: 22.2540, lng: 113.9050, category: 'temple', region: 'lantau', area: 'Ngong Ping', description: '34m bronze Buddha statue on Lantau Island.', accessibility_score: 3, price_level: 'free', place_type: 'temple' },
  { name: 'Repulse Bay Beach', lat: 22.2365, lng: 114.1935, category: 'park', region: 'hong_kong_island', area: 'Repulse Bay', description: 'Popular sandy beach on the south side of HK Island.', accessibility_score: 3, price_level: 'free', place_type: 'beach' },
  { name: 'Cheung Chau Island', lat: 22.2080, lng: 114.0280, category: 'historic_site', region: 'outlying', area: 'Cheung Chau', description: 'Traditional fishing island accessible by ferry.', accessibility_score: 2, price_level: 'free', place_type: 'attraction' },
  { name: 'HKG Airport Sky Deck', lat: 22.3085, lng: 113.9145, category: 'viewpoint', region: 'lantau', area: 'Airport', description: 'Observation deck at HK International Airport.', accessibility_score: 5, price_level: 'free', place_type: 'viewpoint' },
  { name: 'Wong Chuk Hang MTR Station Public Art', lat: 22.2480, lng: 114.1750, category: 'art_gallery', region: 'hong_kong_island', area: 'Wong Chuk Hang', description: 'Large-scale public art installation at MTR station.', accessibility_score: 5, price_level: 'free', place_type: 'art_gallery' },
  { name: 'Sai Kung Waterfront', lat: 22.3800, lng: 114.2700, category: 'viewpoint', region: 'new_territories', area: 'Sai Kung', description: 'Picturesque fishing town with waterfront restaurants.', accessibility_score: 3, price_level: 'moderate', place_type: 'viewpoint' },
  { name: 'Happy Valley Racecourse', lat: 22.2720, lng: 114.1730, category: 'historic_site', region: 'hong_kong_island', area: 'Happy Valley', description: 'Historic horse racing venue operating since 1846.', accessibility_score: 4, price_level: 'moderate', place_type: 'historic_site' },
  { name: 'Macau Ferry Terminal', lat: 22.2890, lng: 114.1520, category: 'transit', region: 'hong_kong_island', area: 'Sheung Wan', description: 'Ferry terminal for turbojet to Macau.', accessibility_score: 5, price_level: 'moderate', place_type: 'transit' },
  { name: 'Star Ferry Pier (TST)', lat: 22.2950, lng: 114.1695, category: 'historic_site', region: 'kowloon', area: 'Tsim Sha Tsui', description: 'Iconic ferry pier connecting TST to Central.', accessibility_score: 4, price_level: 'cheap', place_type: 'transit' },
  { name: 'Star Ferry Pier (Central)', lat: 22.2870, lng: 114.1580, category: 'historic_site', region: 'hong_kong_island', area: 'Central', description: 'Historic ferry pier in Central connecting to TST.', accessibility_score: 4, price_level: 'cheap', place_type: 'transit' },
];

const insert = db.prepare(`
  INSERT OR IGNORE INTO places (name, lat, lng, category, description, source_api, region, price_level, accessibility_score, area, place_type)
  VALUES (?, ?, ?, ?, ?, 'seed', ?, ?, ?, ?, ?)
`);

let inserted = 0;
let skipped = 0;

const tx = db.transaction(() => {
  for (const p of places) {
    const info = insert.run(
      p.name, p.lat, p.lng, p.category, p.description,
      p.region, p.price_level, p.accessibility_score, p.area, p.place_type
    );
    if (info.changes > 0) inserted++;
    else skipped++;
  }
});

tx();

const total = db.prepare('SELECT COUNT(*) as c FROM places').get();
console.log(`Inserted: ${inserted}, Skipped (duplicates): ${skipped}`);
console.log(`Total places in DB: ${total.c}`);

const cats = db.prepare('SELECT category, COUNT(*) as c FROM places GROUP BY category ORDER BY c DESC').all();
console.log('Categories:');
cats.forEach(c => console.log(`  ${c.category}: ${c.c}`));

db.close();
