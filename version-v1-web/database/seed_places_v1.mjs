import pg from 'pg';
const { Client } = pg;

const client = new Client({
  user: 'postgres',
  password: 'postgres',
  database: 'inclusive_tourism_v1',
});

const PLACES = [
  // ── KOWLOON (~100) ──
  // Museums & Culture
  { name:'Hong Kong Museum of History', lat:22.3018, lng:114.1775, category:'museum', region:'kowloon', area:'Tsim Sha Tsui East', budget:'moderate', accessibility_tags:['wheelchair_accessible','accessible_toilet'], accessibility_score:4, place_type:'attraction', tags:['history','culture','exhibition'] },
  { name:'Hong Kong Science Museum', lat:22.3014, lng:114.1777, category:'museum', region:'kowloon', area:'Tsim Sha Tsui East', budget:'moderate', accessibility_tags:['wheelchair_accessible','accessible_toilet'], accessibility_score:4, place_type:'attraction', tags:['science','interactive','family'] },
  { name:'Hong Kong Space Museum', lat:22.2947, lng:114.1718, category:'museum', region:'kowloon', area:'Tsim Sha Tsui', budget:'moderate', accessibility_tags:['wheelchair_accessible'], accessibility_score:3, place_type:'attraction', tags:['space','planetarium','education'] },
  { name:'Hong Kong Museum of Art', lat:22.2950, lng:114.1720, category:'museum', region:'kowloon', area:'Tsim Sha Tsui', budget:'moderate', accessibility_tags:['wheelchair_accessible'], accessibility_score:3, place_type:'attraction', tags:['art','gallery','exhibition'] },
  { name:'Hong Kong Heritage Discovery Centre', lat:22.3000, lng:114.1710, category:'museum', region:'kowloon', area:'Tsim Sha Tsui', budget:'free', accessibility_tags:['wheelchair_accessible'], accessibility_score:3, place_type:'attraction', tags:['heritage','history','free'] },
  // Parks & Nature
  { name:'Kowloon Park', lat:22.3013, lng:114.1704, category:'park', region:'kowloon', area:'Tsim Sha Tsui', budget:'free', accessibility_tags:['wheelchair_accessible','accessible_toilet','ramp'], accessibility_score:5, place_type:'attraction', tags:['park','aviary','sculpture','free'] },
  { name:'Nan Lian Garden', lat:22.3417, lng:114.2060, category:'park', region:'kowloon', area:'Diamond Hill', budget:'free', accessibility_tags:['wheelchair_accessible','ramp'], accessibility_score:4, place_type:'attraction', tags:['garden','chinese','landscape','free'] },
  { name:'Kowloon Walled City Park', lat:22.3320, lng:114.1900, category:'park', region:'kowloon', area:'Kowloon City', budget:'free', accessibility_tags:['wheelchair_accessible'], accessibility_score:3, place_type:'attraction', tags:['park','history','garden','free'] },
  { name:'Hong Kong Zoological & Botanical Gardens', lat:22.2770, lng:114.1570, category:'park', region:'hong_kong_island', area:'Central', budget:'free', accessibility_tags:['wheelchair_accessible','ramp'], accessibility_score:4, place_type:'attraction', tags:['zoo','garden','nature','free'] },
  // Shopping
  { name:'Harbour City', lat:22.2951, lng:114.1689, category:'shopping_mall', region:'kowloon', area:'Tsim Sha Tsui', budget:'expensive', accessibility_tags:['wheelchair_accessible','accessible_toilet','elevator'], accessibility_score:5, place_type:'attraction', tags:['shopping','mall','waterfront'] },
  { name:'Elements Mall', lat:22.3040, lng:114.1610, category:'shopping_mall', region:'kowloon', area:'West Kowloon', budget:'expensive', accessibility_tags:['wheelchair_accessible','accessible_toilet','elevator'], accessibility_score:5, place_type:'attraction', tags:['shopping','mall','luxury'] },
  { name:'Mong Kok Ladies Market', lat:22.3170, lng:114.1690, category:'market', region:'kowloon', area:'Mong Kok', budget:'cheap', accessibility_tags:['wheelchair_accessible'], accessibility_score:2, place_type:'attraction', tags:['market','shopping','street'] },
  { name:'Temple Street Night Market', lat:22.3050, lng:114.1700, category:'market', region:'kowloon', area:'Jordan', budget:'cheap', accessibility_tags:['wheelchair_accessible'], accessibility_score:2, place_type:'attraction', tags:['market','night','street_food'] },
  { name:'Mong Kok Flower Market', lat:22.3220, lng:114.1730, category:'market', region:'kowloon', area:'Mong Kok', budget:'cheap', accessibility_tags:['wheelchair_accessible'], accessibility_score:3, place_type:'attraction', tags:['market','flowers','garden'] },
  { name:'Mong Kok Goldfish Market', lat:22.3200, lng:114.1710, category:'market', region:'kowloon', area:'Mong Kok', budget:'cheap', accessibility_tags:['wheelchair_accessible'], accessibility_score:2, place_type:'attraction', tags:['market','pets','fish'] },
  // Viewpoints
  { name:'Tsim Sha Tsui Promenade', lat:22.2935, lng:114.1725, category:'viewpoint', region:'kowloon', area:'Tsim Sha Tsui', budget:'free', accessibility_tags:['wheelchair_accessible','ramp'], accessibility_score:5, place_type:'attraction', tags:['viewpoint','harbour','skyline','free'] },
  { name:'Sky 100 Observation Deck', lat:22.3040, lng:114.1600, category:'viewpoint', region:'kowloon', area:'West Kowloon', budget:'expensive', accessibility_tags:['wheelchair_accessible','elevator'], accessibility_score:4, place_type:'attraction', tags:['viewpoint','observation','skyline'] },
  { name:'West Kowloon Cultural District', lat:22.2990, lng:114.1650, category:'viewpoint', region:'kowloon', area:'West Kowloon', budget:'free', accessibility_tags:['wheelchair_accessible','ramp'], accessibility_score:5, place_type:'attraction', tags:['viewpoint','culture','waterfront','free'] },
  // Temples
  { name:'Wong Tai Sin Temple', lat:22.3420, lng:114.1930, category:'temple', region:'kowloon', area:'Wong Tai Sin', budget:'free', accessibility_tags:['wheelchair_accessible','ramp'], accessibility_score:3, place_type:'attraction', tags:['temple','taoist','culture','free'] },
  { name:'Chi Lin Nunnery', lat:22.3415, lng:114.2065, category:'temple', region:'kowloon', area:'Diamond Hill', budget:'free', accessibility_tags:['wheelchair_accessible','ramp'], accessibility_score:4, place_type:'attraction', tags:['temple','buddhist','architecture','free'] },
  { name:'Tin Hau Temple (Yau Ma Tei)', lat:22.3115, lng:114.1705, category:'temple', region:'kowloon', area:'Yau Ma Tei', budget:'free', accessibility_tags:['wheelchair_accessible'], accessibility_score:2, place_type:'attraction', tags:['temple','historic','free'] },
  // Historic Sites
  { name:'Former Kowloon-Canton Railway Clock Tower', lat:22.2930, lng:114.1695, category:'historic_site', region:'kowloon', area:'Tsim Sha Tsui', budget:'free', accessibility_tags:['wheelchair_accessible'], accessibility_score:3, place_type:'attraction', tags:['historic','clock_tower','colonial','free'] },
  { name:'Kowloon City (Old Walled City)', lat:22.3310, lng:114.1900, category:'historic_site', region:'kowloon', area:'Kowloon City', budget:'free', accessibility_tags:['wheelchair_accessible'], accessibility_score:2, place_type:'attraction', tags:['historic','city_wall','free'] },
  // Hotels
  { name:'The Peninsula Hong Kong', lat:22.2955, lng:114.1710, category:'hotel', region:'kowloon', area:'Tsim Sha Tsui', budget:'expensive', accessibility_tags:['wheelchair_accessible','accessible_toilet','elevator'], accessibility_score:5, place_type:'hotel', tags:['luxury','hotel','heritage'] },
  { name:'Rosewood Hong Kong', lat:22.3000, lng:114.1800, category:'hotel', region:'kowloon', area:'Tsim Sha Tsui East', budget:'expensive', accessibility_tags:['wheelchair_accessible','elevator'], accessibility_score:5, place_type:'hotel', tags:['luxury','hotel','waterfront'] },
  { name:'Hotel ICON', lat:22.3020, lng:114.1790, category:'hotel', region:'kowloon', area:'Tsim Sha Tsui East', budget:'expensive', accessibility_tags:['wheelchair_accessible','elevator'], accessibility_score:4, place_type:'hotel', tags:['hotel','design','harbour_view'] },
  { name:'Eaton Hotel Hong Kong', lat:22.3040, lng:114.1710, category:'hotel', region:'kowloon', area:'Jordan', budget:'moderate', accessibility_tags:['wheelchair_accessible','elevator'], accessibility_score:4, place_type:'hotel', tags:['hotel','midtown','boutique'] },
  { name:'Cityview Hong Kong', lat:22.3070, lng:114.1710, category:'hotel', region:'kowloon', area:'Yau Ma Tei', budget:'moderate', accessibility_tags:['wheelchair_accessible','elevator'], accessibility_score:3, place_type:'hotel', tags:['hotel','budget','convenient'] },
  // Restaurants (selection)
  { name:'Yung Kee Restaurant', lat:22.2840, lng:114.1540, category:'restaurant', region:'hong_kong_island', area:'Central', budget:'expensive', accessibility_tags:['wheelchair_accessible'], accessibility_score:3, place_type:'restaurant', tags:['restaurant','cantonese','roast_goose'] },
  { name:'Tim Ho Wan (Sham Shui Po)', lat:22.3310, lng:114.1620, category:'restaurant', region:'kowloon', area:'Sham Shui Po', budget:'cheap', accessibility_tags:['wheelchair_accessible'], accessibility_score:2, place_type:'restaurant', tags:['dim_sum','michilin','cheap'] },
  { name:'Din Tai Fung (Harbour City)', lat:22.2950, lng:114.1690, category:'restaurant', region:'kowloon', area:'Tsim Sha Tsui', budget:'moderate', accessibility_tags:['wheelchair_accessible'], accessibility_score:3, place_type:'restaurant', tags:['dumplings','taiwanese','xiao_long_bao'] },
  { name:'Australian Dairy Company', lat:22.3340, lng:114.1640, category:'restaurant', region:'kowloon', area:'Jordan', budget:'cheap', accessibility_tags:[], accessibility_score:1, place_type:'restaurant', tags:['cha_chaan_teng','breakfast','cheap'] },
  { name:'Lan Fong Yuen', lat:22.2850, lng:114.1530, category:'restaurant', region:'hong_kong_island', area:'Central', budget:'cheap', accessibility_tags:[], accessibility_score:1, place_type:'restaurant', tags:['milk_tea','cha_chaan_teng','iconic'] },
  // Cafes
  { name:'Starbucks (TST Star Ferry)', lat:22.2930, lng:114.1690, category:'cafe', region:'kowloon', area:'Tsim Sha Tsui', budget:'moderate', accessibility_tags:['wheelchair_accessible'], accessibility_score:3, place_type:'restaurant', tags:['cafe','coffee','waterfront'] },
  { name:'The Coffee Academics (TST)', lat:22.2970, lng:114.1740, category:'cafe', region:'kowloon', area:'Tsim Sha Tsui', budget:'moderate', accessibility_tags:['wheelchair_accessible'], accessibility_score:3, place_type:'restaurant', tags:['cafe','coffee','specialty'] },
  // Transport Hubs
  { name:'Tsim Sha Tsui MTR Station', lat:22.2978, lng:114.1721, category:'transport_hub', region:'kowloon', area:'Tsim Sha Tsui', budget:'free', accessibility_tags:['wheelchair_accessible','elevator','ramp'], accessibility_score:4, place_type:'transport_hub', tags:['mtr','transport','underground'] },
  { name:'Mong Kok MTR Station', lat:22.3180, lng:114.1700, category:'transport_hub', region:'kowloon', area:'Mong Kok', budget:'free', accessibility_tags:['wheelchair_accessible','elevator'], accessibility_score:4, place_type:'transport_hub', tags:['mtr','transport'] },
  { name:'Hung Hom MTR Station', lat:22.3030, lng:114.1870, category:'transport_hub', region:'kowloon', area:'Hung Hom', budget:'free', accessibility_tags:['wheelchair_accessible','elevator','ramp'], accessibility_score:4, place_type:'transport_hub', tags:['mtr','transport','cross_border'] },
  { name:'Kowloon Tong MTR Station', lat:22.3370, lng:114.1770, category:'transport_hub', region:'kowloon', area:'Kowloon Tong', budget:'free', accessibility_tags:['wheelchair_accessible','elevator'], accessibility_score:4, place_type:'transport_hub', tags:['mtr','transport','interchange'] },
  { name:'Diamond Hill MTR Station', lat:22.3400, lng:114.2020, category:'transport_hub', region:'kowloon', area:'Diamond Hill', budget:'free', accessibility_tags:['wheelchair_accessible','elevator'], accessibility_score:4, place_type:'transport_hub', tags:['mtr','transport'] },
  { name:'Jordan MTR Station', lat:22.3051, lng:114.1693, category:'transport_hub', region:'kowloon', area:'Jordan', budget:'free', accessibility_tags:['wheelchair_accessible','elevator'], accessibility_score:4, place_type:'transport_hub', tags:['mtr','transport'] },
  { name:'Star Ferry Pier TST', lat:22.2930, lng:114.1690, category:'transport_hub', region:'kowloon', area:'Tsim Sha Tsui', budget:'cheap', accessibility_tags:['wheelchair_accessible','ramp'], accessibility_score:3, place_type:'transport_hub', tags:['ferry','transport','iconic','cheap'] },

  // ── HONG KONG ISLAND (~100) ──
  // Central
  { name:'Victoria Peak (The Peak)', lat:22.2750, lng:114.1450, category:'viewpoint', region:'hong_kong_island', area:'The Peak', budget:'moderate', accessibility_tags:['wheelchair_accessible','accessible_toilet'], accessibility_score:4, place_type:'attraction', tags:['viewpoint','peak','skyline'] },
  { name:'Peak Tram', lat:22.2770, lng:114.1580, category:'transport_hub', region:'hong_kong_island', area:'Central', budget:'moderate', accessibility_tags:['wheelchair_accessible'], accessibility_score:3, place_type:'transport_hub', tags:['tram','transport','historic'] },
  { name:'Hong Kong Park', lat:22.2770, lng:114.1600, category:'park', region:'hong_kong_island', area:'Central', budget:'free', accessibility_tags:['wheelchair_accessible','ramp','accessible_toilet'], accessibility_score:5, place_type:'attraction', tags:['park','aviary','waterfall','free'] },
  { name:'Central Mid-Levels Escalator', lat:22.2810, lng:114.1550, category:'viewpoint', region:'hong_kong_island', area:'Central', budget:'free', accessibility_tags:['wheelchair_accessible','ramp'], accessibility_score:4, place_type:'attraction', tags:['escalator','city_view','free'] },
  { name:'HSBC Main Building', lat:22.2800, lng:114.1580, category:'historic_site', region:'hong_kong_island', area:'Central', budget:'free', accessibility_tags:['wheelchair_accessible'], accessibility_score:2, place_type:'attraction', tags:['architecture','historic','colonial','free'] },
  { name:'Bank of China Tower', lat:22.2790, lng:114.1610, category:'viewpoint', region:'hong_kong_island', area:'Central', budget:'free', accessibility_tags:['wheelchair_accessible'], accessibility_score:2, place_type:'attraction', tags:['architecture','skyline','free'] },
  { name:'Statue Square', lat:22.2810, lng:114.1590, category:'historic_site', region:'hong_kong_island', area:'Central', budget:'free', accessibility_tags:['wheelchair_accessible'], accessibility_score:3, place_type:'attraction', tags:['square','colonial','historic','free'] },
  { name:'Legislative Council Building', lat:22.2810, lng:114.1600, category:'historic_site', region:'hong_kong_island', area:'Central', budget:'free', accessibility_tags:['wheelchair_accessible'], accessibility_score:2, place_type:'attraction', tags:['architecture','colonial','government','free'] },
  // Admiralty
  { name:'Hong Kong Park (Admiralty)', lat:22.2760, lng:114.1630, category:'park', region:'hong_kong_island', area:'Admiralty', budget:'free', accessibility_tags:['wheelchair_accessible','accessible_toilet'], accessibility_score:5, place_type:'attraction', tags:['park','aviary','garden','free'] },
  { name:'Pacific Place', lat:22.2780, lng:114.1660, category:'shopping_mall', region:'hong_kong_island', area:'Admiralty', budget:'expensive', accessibility_tags:['wheelchair_accessible','elevator','accessible_toilet'], accessibility_score:5, place_type:'attraction', tags:['shopping','mall','luxury'] },
  { name:'Flagstaff House Museum of Tea Ware', lat:22.2770, lng:114.1620, category:'museum', region:'hong_kong_island', area:'Admiralty', budget:'free', accessibility_tags:['wheelchair_accessible'], accessibility_score:3, place_type:'attraction', tags:['museum','tea','history','free'] },
  // Wan Chai
  { name:'Golden Bauhinia Square', lat:22.2840, lng:114.1730, category:'historic_site', region:'hong_kong_island', area:'Wan Chai', budget:'free', accessibility_tags:['wheelchair_accessible'], accessibility_score:3, place_type:'attraction', tags:['square','flag','landmark','free'] },
  { name:'Hong Kong Convention & Exhibition Centre', lat:22.2830, lng:114.1730, category:'historic_site', region:'hong_kong_island', area:'Wan Chai', budget:'free', accessibility_tags:['wheelchair_accessible','accessible_toilet'], accessibility_score:4, place_type:'attraction', tags:['exhibition','convention','waterfront'] },
  { name:'Wan Chai Market (Old)', lat:22.2780, lng:114.1730, category:'historic_site', region:'hong_kong_island', area:'Wan Chai', budget:'free', accessibility_tags:[], accessibility_score:1, place_type:'attraction', tags:['market','historic','architecture'] },
  // Causeway Bay
  { name:'Victoria Park', lat:22.2810, lng:114.1870, category:'park', region:'hong_kong_island', area:'Causeway Bay', budget:'free', accessibility_tags:['wheelchair_accessible','ramp','accessible_toilet'], accessibility_score:5, place_type:'attraction', tags:['park','sports','garden','free'] },
  { name:'Times Square', lat:22.2780, lng:114.1820, category:'shopping_mall', region:'hong_kong_island', area:'Causeway Bay', budget:'expensive', accessibility_tags:['wheelchair_accessible','elevator','accessible_toilet'], accessibility_score:4, place_type:'attraction', tags:['shopping','mall','entertainment'] },
  { name:'Sogo Causeway Bay', lat:22.2800, lng:114.1850, category:'shopping_mall', region:'hong_kong_island', area:'Causeway Bay', budget:'moderate', accessibility_tags:['wheelchair_accessible','elevator'], accessibility_score:3, place_type:'attraction', tags:['shopping','department_store','japanese'] },
  { name:'Hysan Place', lat:22.2790, lng:114.1830, category:'shopping_mall', region:'hong_kong_island', area:'Causeway Bay', budget:'moderate', accessibility_tags:['wheelchair_accessible','elevator'], accessibility_score:4, place_type:'attraction', tags:['shopping','mall','trendy'] },
  { name:'Jardine\u2019s Lookout', lat:22.2690, lng:114.2010, category:'viewpoint', region:'hong_kong_island', area:'Causeway Bay', budget:'free', accessibility_tags:[], accessibility_score:1, place_type:'attraction', tags:['viewpoint','hike','nature','free'] },
  // Sheung Wan / Sai Ying Pun
  { name:'Man Mo Temple', lat:22.2860, lng:114.1500, category:'temple', region:'hong_kong_island', area:'Sheung Wan', budget:'free', accessibility_tags:['wheelchair_accessible'], accessibility_score:2, place_type:'attraction', tags:['temple','historic','culture','free'] },
  { name:'Cat Street (Upper Lascar Row)', lat:22.2850, lng:114.1510, category:'market', region:'hong_kong_island', area:'Sheung Wan', budget:'cheap', accessibility_tags:[], accessibility_score:1, place_type:'attraction', tags:['market','antiques','art'] },
  { name:'Western Market', lat:22.2870, lng:114.1480, category:'market', region:'hong_kong_island', area:'Sheung Wan', budget:'cheap', accessibility_tags:['wheelchair_accessible'], accessibility_score:2, place_type:'attraction', tags:['market','colonial','architecture'] },
  { name:'Sun Yat Sen Museum', lat:22.2840, lng:114.1510, category:'museum', region:'hong_kong_island', area:'Sheung Wan', budget:'free', accessibility_tags:['wheelchair_accessible'], accessibility_score:3, place_type:'attraction', tags:['museum','history','revolution','free'] },
  // Kennedy Town
  { name:'Kennedy Town Promenade', lat:22.2830, lng:114.1280, category:'viewpoint', region:'hong_kong_island', area:'Kennedy Town', budget:'free', accessibility_tags:['wheelchair_accessible','ramp'], accessibility_score:4, place_type:'attraction', tags:['viewpoint','waterfront','sunset','free'] },
  // Aberdeen / South Side
  { name:'Ocean Park', lat:22.2467, lng:114.1715, category:'park', region:'hong_kong_island', area:'Aberdeen', budget:'expensive', accessibility_tags:['wheelchair_accessible','accessible_toilet','elevator'], accessibility_score:4, place_type:'attraction', tags:['theme_park','marine','roller_coaster'] },
  { name:'Aberdeen Fishing Village', lat:22.2480, lng:114.1600, category:'historic_site', region:'hong_kong_island', area:'Aberdeen', budget:'moderate', accessibility_tags:['wheelchair_accessible'], accessibility_score:2, place_type:'attraction', tags:['village','fishing','culture'] },
  { name:'Stanley Market', lat:22.2200, lng:114.2090, category:'market', region:'hong_kong_island', area:'Stanley', budget:'cheap', accessibility_tags:['wheelchair_accessible'], accessibility_score:3, place_type:'attraction', tags:['market','waterfront','shopping'] },
  { name:'Stanley Main Beach', lat:22.2190, lng:114.2100, category:'park', region:'hong_kong_island', area:'Stanley', budget:'free', accessibility_tags:['wheelchair_accessible','ramp'], accessibility_score:3, place_type:'attraction', tags:['beach','waterfront','free'] },
  { name:'Repulse Bay Beach', lat:22.2360, lng:114.1990, category:'park', region:'hong_kong_island', area:'Repulse Bay', budget:'free', accessibility_tags:['wheelchair_accessible','ramp'], accessibility_score:3, place_type:'attraction', tags:['beach','swimming','free'] },
  // Hotels (HK Island)
  { name:'The Mandarin Oriental Hong Kong', lat:22.2810, lng:114.1580, category:'hotel', region:'hong_kong_island', area:'Central', budget:'expensive', accessibility_tags:['wheelchair_accessible','elevator','accessible_toilet'], accessibility_score:5, place_type:'hotel', tags:['luxury','hotel','heritage'] },
  { name:'Four Seasons Hotel Hong Kong', lat:22.2840, lng:114.1510, category:'hotel', region:'hong_kong_island', area:'Central', budget:'expensive', accessibility_tags:['wheelchair_accessible','elevator'], accessibility_score:5, place_type:'hotel', tags:['luxury','hotel','waterfront'] },
  { name:'The Upper House', lat:22.2840, lng:114.1640, category:'hotel', region:'hong_kong_island', area:'Admiralty', budget:'expensive', accessibility_tags:['wheelchair_accessible','elevator'], accessibility_score:4, place_type:'hotel', tags:['hotel','design','luxury'] },
  { name:'Harbour Grand Hong Kong', lat:22.2900, lng:114.1930, category:'hotel', region:'hong_kong_island', area:'Fortress Hill', budget:'expensive', accessibility_tags:['wheelchair_accessible','elevator'], accessibility_score:4, place_type:'hotel', tags:['hotel','harbour_view','luxury'] },
  // MTR (HK Island)
  { name:'Central MTR Station', lat:22.2820, lng:114.1580, category:'transport_hub', region:'hong_kong_island', area:'Central', budget:'free', accessibility_tags:['wheelchair_accessible','elevator'], accessibility_score:4, place_type:'transport_hub', tags:['mtr','transport','interchange'] },
  { name:'Admiralty MTR Station', lat:22.2780, lng:114.1650, category:'transport_hub', region:'hong_kong_island', area:'Admiralty', budget:'free', accessibility_tags:['wheelchair_accessible','elevator'], accessibility_score:4, place_type:'transport_hub', tags:['mtr','transport','interchange'] },
  { name:'Causeway Bay MTR Station', lat:22.2800, lng:114.1850, category:'transport_hub', region:'hong_kong_island', area:'Causeway Bay', budget:'free', accessibility_tags:['wheelchair_accessible','elevator'], accessibility_score:4, place_type:'transport_hub', tags:['mtr','transport','shopping'] },

  // ── NEW TERRITORIES (~100) ──
  // Sha Tin
  { name:'Hong Kong Heritage Museum', lat:22.3770, lng:114.1860, category:'museum', region:'new_territories', area:'Sha Tin', budget:'moderate', accessibility_tags:['wheelchair_accessible','accessible_toilet'], accessibility_score:4, place_type:'attraction', tags:['museum','heritage','culture'] },
  { name:'Sha Tin Park', lat:22.3820, lng:114.1870, category:'park', region:'new_territories', area:'Sha Tin', budget:'free', accessibility_tags:['wheelchair_accessible','ramp'], accessibility_score:4, place_type:'attraction', tags:['park','garden','waterfront','free'] },
  { name:'New Town Plaza', lat:22.3820, lng:114.1890, category:'shopping_mall', region:'new_territories', area:'Sha Tin', budget:'moderate', accessibility_tags:['wheelchair_accessible','elevator','accessible_toilet'], accessibility_score:4, place_type:'attraction', tags:['shopping','mall','family'] },
  { name:'Sha Tin Racecourse', lat:22.4000, lng:114.2000, category:'historic_site', region:'new_territories', area:'Sha Tin', budget:'moderate', accessibility_tags:['wheelchair_accessible'], accessibility_score:3, place_type:'attraction', tags:['horse_racing','sports','entertainment'] },
  // Tsuen Wan
  { name:'Tsuen Wan Park', lat:22.3680, lng:114.1150, category:'park', region:'new_territories', area:'Tsuen Wan', budget:'free', accessibility_tags:['wheelchair_accessible','ramp'], accessibility_score:4, place_type:'attraction', tags:['park','waterfront','free'] },
  { name:'Sam Tung Uk Museum', lat:22.3700, lng:114.1180, category:'museum', region:'new_territories', area:'Tsuen Wan', budget:'free', accessibility_tags:['wheelchair_accessible'], accessibility_score:3, place_type:'attraction', tags:['museum','hakka','heritage','free'] },
  { name:'Citywalk', lat:22.3690, lng:114.1170, category:'shopping_mall', region:'new_territories', area:'Tsuen Wan', budget:'moderate', accessibility_tags:['wheelchair_accessible','elevator','accessible_toilet'], accessibility_score:4, place_type:'attraction', tags:['shopping','mall','cinema'] },
  // Tuen Mun
  { name:'Tuen Mun Park', lat:22.3930, lng:113.9750, category:'park', region:'new_territories', area:'Tuen Mun', budget:'free', accessibility_tags:['wheelchair_accessible','ramp'], accessibility_score:4, place_type:'attraction', tags:['park','garden','free'] },
  { name:'Tuen Mun Town Plaza', lat:22.3920, lng:113.9770, category:'shopping_mall', region:'new_territories', area:'Tuen Mun', budget:'moderate', accessibility_tags:['wheelchair_accessible','elevator'], accessibility_score:3, place_type:'attraction', tags:['shopping','mall','local'] },
  { name:'Tsing Shan Monastery', lat:22.4000, lng:113.9700, category:'temple', region:'new_territories', area:'Tuen Mun', budget:'free', accessibility_tags:[], accessibility_score:2, place_type:'attraction', tags:['temple','buddhist','mountain','free'] },
  // Yuen Long
  { name:'Yuen Long Park', lat:22.4430, lng:114.0260, category:'park', region:'new_territories', area:'Yuen Long', budget:'free', accessibility_tags:['wheelchair_accessible','ramp'], accessibility_score:3, place_type:'attraction', tags:['park','free'] },
  { name:'Ping Shan Heritage Trail', lat:22.4470, lng:114.0080, category:'historic_site', region:'new_territories', area:'Yuen Long', budget:'free', accessibility_tags:['wheelchair_accessible'], accessibility_score:2, place_type:'attraction', tags:['heritage','trail','historic','free'] },
  { name:'Tai Fu Tai Mansion', lat:22.4500, lng:114.0300, category:'historic_site', region:'new_territories', area:'Yuen Long', budget:'free', accessibility_tags:[], accessibility_score:1, place_type:'attraction', tags:['historic','mansion','heritage','free'] },
  // Tai Po
  { name:'Tai Po Waterfront Park', lat:22.4520, lng:114.1680, category:'park', region:'new_territories', area:'Tai Po', budget:'free', accessibility_tags:['wheelchair_accessible','ramp'], accessibility_score:4, place_type:'attraction', tags:['park','waterfront','bike','free'] },
  { name:'Hong Kong Railway Museum', lat:22.4470, lng:114.1650, category:'museum', region:'new_territories', area:'Tai Po', budget:'free', accessibility_tags:['wheelchair_accessible'], accessibility_score:3, place_type:'attraction', tags:['museum','railway','historic','free'] },
  { name:'Tai Po Market (Old)', lat:22.4480, lng:114.1650, category:'market', region:'new_territories', area:'Tai Po', budget:'cheap', accessibility_tags:[], accessibility_score:1, place_type:'attraction', tags:['market','local','food'] },
  // Sai Kung
  { name:'Sai Kung Waterfront', lat:22.3810, lng:114.2700, category:'viewpoint', region:'new_territories', area:'Sai Kung', budget:'free', accessibility_tags:['wheelchair_accessible','ramp'], accessibility_score:4, place_type:'attraction', tags:['waterfront','seafood','village','free'] },
  { name:'Sai Kung Promenade', lat:22.3800, lng:114.2720, category:'viewpoint', region:'new_territories', area:'Sai Kung', budget:'free', accessibility_tags:['wheelchair_accessible'], accessibility_score:3, place_type:'attraction', tags:['viewpoint','waterfront','free'] },
  { name:'Sai Kung Hoi Sing Wan (Sea View)', lat:22.3700, lng:114.2700, category:'viewpoint', region:'new_territories', area:'Sai Kung', budget:'free', accessibility_tags:[], accessibility_score:2, place_type:'attraction', tags:['viewpoint','nature','hike','free'] },
  // Lantau Island
  { name:'Tian Tan Buddha (Big Buddha)', lat:22.2540, lng:113.9050, category:'temple', region:'new_territories', area:'Lantau Island', budget:'free', accessibility_tags:['wheelchair_accessible'], accessibility_score:2, place_type:'attraction', tags:['buddha','statue','culture','free'] },
  { name:'Po Lin Monastery', lat:22.2550, lng:113.9050, category:'temple', region:'new_territories', area:'Lantau Island', budget:'free', accessibility_tags:['wheelchair_accessible'], accessibility_score:3, place_type:'attraction', tags:['monastery','buddhist','culture','free'] },
  { name:'Ngong Ping 360 Cable Car', lat:22.2500, lng:113.9000, category:'viewpoint', region:'new_territories', area:'Lantau Island', budget:'expensive', accessibility_tags:['wheelchair_accessible'], accessibility_score:3, place_type:'attraction', tags:['cable_car','viewpoint','scenic'] },
  { name:'Tai O Fishing Village', lat:22.2550, lng:113.8650, category:'historic_site', region:'new_territories', area:'Lantau Island', budget:'free', accessibility_tags:['wheelchair_accessible'], accessibility_score:2, place_type:'attraction', tags:['village','fishing','stilt_house','free'] },
  { name:'Hong Kong Disneyland', lat:22.3120, lng:114.0410, category:'park', region:'new_territories', area:'Lantau Island', budget:'expensive', accessibility_tags:['wheelchair_accessible','accessible_toilet','elevator'], accessibility_score:5, place_type:'attraction', tags:['theme_park','disney','family'] },
  // MTR New Territories
  { name:'Sha Tin MTR Station', lat:22.3820, lng:114.1880, category:'transport_hub', region:'new_territories', area:'Sha Tin', budget:'free', accessibility_tags:['wheelchair_accessible','elevator'], accessibility_score:4, place_type:'transport_hub', tags:['mtr','transport'] },
  { name:'Tsuen Wan MTR Station', lat:22.3700, lng:114.1170, category:'transport_hub', region:'new_territories', area:'Tsuen Wan', budget:'free', accessibility_tags:['wheelchair_accessible','elevator'], accessibility_score:4, place_type:'transport_hub', tags:['mtr','transport'] },
  { name:'Tuen Mun MTR Station', lat:22.3940, lng:113.9760, category:'transport_hub', region:'new_territories', area:'Tuen Mun', budget:'free', accessibility_tags:['wheelchair_accessible','elevator'], accessibility_score:4, place_type:'transport_hub', tags:['mtr','transport','light_rail'] },
  { name:'Tai Po MTR Station', lat:22.4470, lng:114.1670, category:'transport_hub', region:'new_territories', area:'Tai Po', budget:'free', accessibility_tags:['wheelchair_accessible','elevator'], accessibility_score:3, place_type:'transport_hub', tags:['mtr','transport'] },

  // ── Restaurants New Territories ──
  { name:'Sha Tin 18 (Hyatt Regency)', lat:22.3830, lng:114.1860, category:'restaurant', region:'new_territories', area:'Sha Tin', budget:'expensive', accessibility_tags:['wheelchair_accessible'], accessibility_score:3, place_type:'restaurant', tags:['restaurant','cantonese','hotel'] },
  { name:'Cafe 100 (Ritz-Carlton)', lat:22.3030, lng:114.1600, category:'restaurant', region:'kowloon', area:'West Kowloon', budget:'expensive', accessibility_tags:['wheelchair_accessible','elevator'], accessibility_score:4, place_type:'restaurant', tags:['restaurant','buffet','sky_view'] },

  // ── Additional Kowloon Places (~50 more to fill 100) ──
  { name:'Kowloon Peak (Fei Ngo Shan)', lat:22.3450, lng:114.2250, category:'viewpoint', region:'kowloon', area:'Kowloon Peak', budget:'free', accessibility_tags:[], accessibility_score:1, place_type:'attraction', tags:['viewpoint','hike','sunrise','free'] },
  { name:'Lung Tsun Stone Bridge', lat:22.3300, lng:114.1920, category:'historic_site', region:'kowloon', area:'Kai Tak', budget:'free', accessibility_tags:['wheelchair_accessible'], accessibility_score:2, place_type:'attraction', tags:['historic','bridge','waterfront','free'] },
  { name:'Kai Tak Runway Park', lat:22.3260, lng:114.1950, category:'park', region:'kowloon', area:'Kai Tak', budget:'free', accessibility_tags:['wheelchair_accessible','ramp'], accessibility_score:4, place_type:'attraction', tags:['park','waterfront','aviation','free'] },
  { name:'Kai Tak Cruise Terminal', lat:22.3150, lng:114.1940, category:'viewpoint', region:'kowloon', area:'Kai Tak', budget:'free', accessibility_tags:['wheelchair_accessible','elevator'], accessibility_score:4, place_type:'attraction', tags:['viewpoint','cruise','waterfront','free'] },
  { name:'Mong Kok Computer Centre', lat:22.3170, lng:114.1710, category:'shopping_mall', region:'kowloon', area:'Mong Kok', budget:'moderate', accessibility_tags:['wheelchair_accessible'], accessibility_score:2, place_type:'attraction', tags:['shopping','electronics','computers'] },
  { name:'Sino Centre', lat:22.3190, lng:114.1700, category:'shopping_mall', region:'kowloon', area:'Mong Kok', budget:'moderate', accessibility_tags:['wheelchair_accessible'], accessibility_score:2, place_type:'attraction', tags:['shopping','anime','toys'] },
  { name:'Langham Place', lat:22.3170, lng:114.1680, category:'shopping_mall', region:'kowloon', area:'Mong Kok', budget:'moderate', accessibility_tags:['wheelchair_accessible','elevator','accessible_toilet'], accessibility_score:4, place_type:'attraction', tags:['shopping','mall','cinema'] },
  { name:'MOKO Mall', lat:22.3270, lng:114.1740, category:'shopping_mall', region:'kowloon', area:'Mong Kok', budget:'moderate', accessibility_tags:['wheelchair_accessible','elevator'], accessibility_score:4, place_type:'attraction', tags:['shopping','mall','family'] },
  { name:'Festival Walk', lat:22.3370, lng:114.1760, category:'shopping_mall', region:'kowloon', area:'Kowloon Tong', budget:'moderate', accessibility_tags:['wheelchair_accessible','elevator','accessible_toilet'], accessibility_score:5, place_type:'attraction', tags:['shopping','mall','ice_skating'] },
  { name:'MegaBox', lat:22.3190, lng:114.2030, category:'shopping_mall', region:'kowloon', area:'Kowloon Bay', budget:'moderate', accessibility_tags:['wheelchair_accessible','elevator'], accessibility_score:4, place_type:'attraction', tags:['shopping','mall','family'] },
  { name:'Hollywood Plaza', lat:22.3390, lng:114.1980, category:'shopping_mall', region:'kowloon', area:'Diamond Hill', budget:'moderate', accessibility_tags:['wheelchair_accessible','elevator'], accessibility_score:4, place_type:'attraction', tags:['shopping','mall','local'] },
  { name:'Kwun Tong Promenade', lat:22.3090, lng:114.2260, category:'viewpoint', region:'kowloon', area:'Kwun Tong', budget:'free', accessibility_tags:['wheelchair_accessible','ramp'], accessibility_score:4, place_type:'attraction', tags:['viewpoint','waterfront','sunset','free'] },
  { name:'LEGOLAND Discovery Centre', lat:22.3380, lng:114.1760, category:'museum', region:'kowloon', area:'Kowloon Bay', budget:'moderate', accessibility_tags:['wheelchair_accessible'], accessibility_score:3, place_type:'attraction', tags:['lego','family','indoor'] },
  { name:'Kowloon Bay International Trade Centre', lat:22.3200, lng:114.2050, category:'viewpoint', region:'kowloon', area:'Kowloon Bay', budget:'free', accessibility_tags:['wheelchair_accessible','elevator'], accessibility_score:3, place_type:'attraction', tags:['viewpoint','exhibition','free'] },
  { name:'Shek Kip Mei Estate (Public Housing Museum)', lat:22.3360, lng:114.1630, category:'historic_site', region:'kowloon', area:'Shek Kip Mei', budget:'free', accessibility_tags:['wheelchair_accessible'], accessibility_score:2, place_type:'attraction', tags:['historic','housing','heritage','free'] },
  { name:'Sham Shui Po Street Art', lat:22.3300, lng:114.1620, category:'viewpoint', region:'kowloon', area:'Sham Shui Po', budget:'free', accessibility_tags:['wheelchair_accessible'], accessibility_score:2, place_type:'attraction', tags:['street_art','murals','free'] },
  { name:'Apliu Street Flea Market', lat:22.3300, lng:114.1630, category:'market', region:'kowloon', area:'Sham Shui Po', budget:'cheap', accessibility_tags:[], accessibility_score:1, place_type:'attraction', tags:['market','electronics','flea','cheap'] },
  { name:'Yau Ma Tei Fruit Market', lat:22.3120, lng:114.1700, category:'market', region:'kowloon', area:'Yau Ma Tei', budget:'cheap', accessibility_tags:[], accessibility_score:1, place_type:'attraction', tags:['market','fruit','wholesale'] },
  // Hotels Kowloon
  { name:'W Hong Kong', lat:22.3010, lng:114.1600, category:'hotel', region:'kowloon', area:'West Kowloon', budget:'expensive', accessibility_tags:['wheelchair_accessible','elevator','accessible_toilet'], accessibility_score:5, place_type:'hotel', tags:['luxury','hotel','design'] },
  { name:'The Salisbury', lat:22.2960, lng:114.1700, category:'hotel', region:'kowloon', area:'Tsim Sha Tsui', budget:'expensive', accessibility_tags:['wheelchair_accessible','elevator'], accessibility_score:4, place_type:'hotel', tags:['hotel','heritage','museum'] },
  { name:'Kowloon Shangri-La', lat:22.3030, lng:114.1770, category:'hotel', region:'kowloon', area:'Tsim Sha Tsui East', budget:'expensive', accessibility_tags:['wheelchair_accessible','elevator'], accessibility_score:4, place_type:'hotel', tags:['hotel','luxury','harbour_view'] },
  { name:'Holiday Inn Golden Mile', lat:22.2970, lng:114.1720, category:'hotel', region:'kowloon', area:'Tsim Sha Tsui', budget:'moderate', accessibility_tags:['wheelchair_accessible','elevator'], accessibility_score:3, place_type:'hotel', tags:['hotel','midtown','convenient'] },
  // Restaurants Kowloon
  { name:'Spring Deer Restaurant', lat:22.3180, lng:114.1690, category:'restaurant', region:'kowloon', area:'Mong Kok', budget:'moderate', accessibility_tags:[], accessibility_score:1, place_type:'restaurant', tags:['restaurant','beijing','duck'] },
  { name:'Hutong (Harbour City)', lat:22.2950, lng:114.1690, category:'restaurant', region:'kowloon', area:'Tsim Sha Tsui', budget:'expensive', accessibility_tags:['wheelchair_accessible'], accessibility_score:3, place_type:'restaurant', tags:['restaurant','chinese','northern'] },
  // Hotels HK Island additional
  { name:'The Murray Hong Kong', lat:22.2760, lng:114.1600, category:'hotel', region:'hong_kong_island', area:'Central', budget:'expensive', accessibility_tags:['wheelchair_accessible','elevator'], accessibility_score:4, place_type:'hotel', tags:['luxury','hotel','design'] },
  { name:'Kew Green Hotel Wanchai', lat:22.2780, lng:114.1720, category:'hotel', region:'hong_kong_island', area:'Wan Chai', budget:'moderate', accessibility_tags:['wheelchair_accessible','elevator'], accessibility_score:3, place_type:'hotel', tags:['hotel','budget','conference'] },
  // New Territories additional
  { name:'Ma Wan Park', lat:22.3490, lng:114.0600, category:'park', region:'new_territories', area:'Ma Wan', budget:'free', accessibility_tags:['wheelchair_accessible','ramp'], accessibility_score:3, place_type:'attraction', tags:['park','beach','nature','free'] },
  { name:'Tsing Ma Bridge View Point', lat:22.3520, lng:114.0740, category:'viewpoint', region:'new_territories', area:'Tsing Yi', budget:'free', accessibility_tags:['wheelchair_accessible'], accessibility_score:2, place_type:'attraction', tags:['viewpoint','bridge','engineering','free'] },
  { name:'Lantau Island Beach (Cheung Sha)', lat:22.2350, lng:113.9430, category:'park', region:'new_territories', area:'Lantau Island', budget:'free', accessibility_tags:['wheelchair_accessible','ramp'], accessibility_score:3, place_type:'attraction', tags:['beach','swimming','nature','free'] },
  { name:'Discovery Bay', lat:22.2980, lng:114.0140, category:'viewpoint', region:'new_territories', area:'Lantau Island', budget:'free', accessibility_tags:['wheelchair_accessible','ramp'], accessibility_score:4, place_type:'attraction', tags:['waterfront','resort','free'] },
  { name:'Hong Kong Wetlands Park', lat:22.4680, lng:114.0040, category:'park', region:'new_territories', area:'Tin Shui Wai', budget:'moderate', accessibility_tags:['wheelchair_accessible','accessible_toilet','ramp'], accessibility_score:5, place_type:'attraction', tags:['nature','wetlands','bird_watching'] },
  { name:'Mai Po Nature Reserve', lat:22.4900, lng:114.0400, category:'park', region:'new_territories', area:'Mai Po', budget:'moderate', accessibility_tags:['wheelchair_accessible'], accessibility_score:2, place_type:'attraction', tags:['nature','bird_watching','wetlands'] },
  { name:'Kam Tin (Walled Village)', lat:22.4450, lng:114.0550, category:'historic_site', region:'new_territories', area:'Kam Tin', budget:'free', accessibility_tags:[], accessibility_score:1, place_type:'attraction', tags:['historic','village','walled','free'] },
  { name:'Kat Hing Wai Walled Village', lat:22.4450, lng:114.0560, category:'historic_site', region:'new_territories', area:'Kam Tin', budget:'free', accessibility_tags:[], accessibility_score:1, place_type:'attraction', tags:['historic','village','walled','free'] },
  { name:'Lion Rock Country Park', lat:22.3550, lng:114.1830, category:'park', region:'kowloon', area:'Lion Rock', budget:'free', accessibility_tags:[], accessibility_score:1, place_type:'attraction', tags:['hike','nature','viewpoint','free'] },
  { name:'Kam Shan Country Park (Monkey Mountain)', lat:22.3530, lng:114.1500, category:'park', region:'kowloon', area:'Kam Shan', budget:'free', accessibility_tags:['wheelchair_accessible'], accessibility_score:2, place_type:'attraction', tags:['park','nature','monkeys','free'] },
  { name:'Tai Mo Shan (Highest Peak)', lat:22.4100, lng:114.1200, category:'viewpoint', region:'new_territories', area:'Tai Mo Shan', budget:'free', accessibility_tags:[], accessibility_score:1, place_type:'attraction', tags:['hike','nature','peak','free'] },
  { name:'Ten Thousand Buddhas Monastery', lat:22.3780, lng:114.1840, category:'temple', region:'new_territories', area:'Sha Tin', budget:'free', accessibility_tags:[], accessibility_score:1, place_type:'attraction', tags:['temple','buddha','statues','free'] },
  { name:'Che Kung Temple', lat:22.3760, lng:114.1820, category:'temple', region:'new_territories', area:'Sha Tin', budget:'free', accessibility_tags:['wheelchair_accessible'], accessibility_score:2, place_type:'attraction', tags:['temple','taoist','culture','free'] },
  { name:'Sik Sik Yuen Wong Tai Sin Temple', lat:22.3425, lng:114.1935, category:'temple', region:'kowloon', area:'Wong Tai Sin', budget:'free', accessibility_tags:['wheelchair_accessible','ramp'], accessibility_score:3, place_type:'attraction', tags:['temple','taoist','fortune_telling','free'] },
  // Additional HK Island
  { name:'Tai Kwun Centre for Heritage & Arts', lat:22.2820, lng:114.1540, category:'museum', region:'hong_kong_island', area:'Central', budget:'free', accessibility_tags:['wheelchair_accessible','accessible_toilet'], accessibility_score:4, place_type:'attraction', tags:['museum','heritage','art','free'] },
  { name:'PMQ', lat:22.2840, lng:114.1530, category:'shopping_mall', region:'hong_kong_island', area:'Central', budget:'moderate', accessibility_tags:['wheelchair_accessible','elevator'], accessibility_score:3, place_type:'attraction', tags:['shopping','design','art'] },
  { name:'Dr Sun Yat Sen Historical Trail', lat:22.2830, lng:114.1510, category:'historic_site', region:'hong_kong_island', area:'Central', budget:'free', accessibility_tags:['wheelchair_accessible'], accessibility_score:2, place_type:'attraction', tags:['trail','history','free'] },
  { name:'Hollywood Road (Antique Shops)', lat:22.2860, lng:114.1510, category:'historic_site', region:'hong_kong_island', area:'Central', budget:'moderate', accessibility_tags:['wheelchair_accessible'], accessibility_score:2, place_type:'attraction', tags:['antiques','shopping','historic'] },
  { name:'Dragon\u2019s Back Hike', lat:22.2350, lng:114.2060, category:'viewpoint', region:'hong_kong_island', area:'Shek O', budget:'free', accessibility_tags:[], accessibility_score:1, place_type:'attraction', tags:['hike','viewpoint','nature','free'] },
  { name:'Shek O Beach', lat:22.2290, lng:114.2530, category:'park', region:'hong_kong_island', area:'Shek O', budget:'free', accessibility_tags:['wheelchair_accessible','ramp'], accessibility_score:3, place_type:'attraction', tags:['beach','swimming','barbecue','free'] },
  { name:'Big Wave Bay', lat:22.2310, lng:114.2520, category:'park', region:'hong_kong_island', area:'Shek O', budget:'free', accessibility_tags:['wheelchair_accessible'], accessibility_score:2, place_type:'attraction', tags:['beach','surfing','free'] },
  { name:'Happy Valley Racecourse', lat:22.2720, lng:114.1830, category:'historic_site', region:'hong_kong_island', area:'Happy Valley', budget:'moderate', accessibility_tags:['wheelchair_accessible'], accessibility_score:3, place_type:'attraction', tags:['horse_racing','entertainment','night'] },
  { name:'Wong Nai Chung Reservoir Park', lat:22.2620, lng:114.1920, category:'park', region:'hong_kong_island', area:'Happy Valley', budget:'free', accessibility_tags:['wheelchair_accessible','ramp'], accessibility_score:3, place_type:'attraction', tags:['park','reservoir','nature','free'] },
  { name:'Lamma Island (Family Walk)', lat:22.2090, lng:114.1250, category:'viewpoint', region:'hong_kong_island', area:'Lamma Island', budget:'free', accessibility_tags:[], accessibility_score:1, place_type:'attraction', tags:['island','hike','seafood','free'] },
  { name:'Cheung Chau Island', lat:22.2090, lng:114.0290, category:'viewpoint', region:'hong_kong_island', area:'Cheung Chau', budget:'free', accessibility_tags:['wheelchair_accessible'], accessibility_score:2, place_type:'attraction', tags:['island','fishing','bun_festival','free'] },
];

async function seed() {
  await client.connect();
  console.log(`Seeding ${PLACES.length} places...`);
  let count = 0;
  for (const p of PLACES) {
    try {
      await client.query(
        `INSERT INTO places (name, lat, lng, category, region, area, budget, accessibility_tags, accessibility_score, place_type, tags, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT ON CONSTRAINT places_name_lng_lat_key DO UPDATE SET
           region=EXCLUDED.region, area=EXCLUDED.area, budget=EXCLUDED.budget,
           accessibility_tags=EXCLUDED.accessibility_tags, accessibility_score=EXCLUDED.accessibility_score,
           place_type=EXCLUDED.place_type, tags=EXCLUDED.tags, notes=EXCLUDED.notes`,
        [p.name, p.lat, p.lng, p.category, p.region, p.area, p.budget,
         p.accessibility_tags, p.accessibility_score, p.place_type, p.tags, p.notes || '']
      );
      count++;
    } catch (err) {
      console.error(`Failed to insert ${p.name}:`, err.message);
    }
  }

  const regions = await client.query('SELECT region, COUNT(*) as cnt FROM places GROUP BY region ORDER BY region');
  for (const r of regions.rows) {
    console.log(`  ${r.region}: ${r.cnt} places`);
  }
  console.log(`\nTotal: ${count} places seeded`);
  await client.end();
}

seed().catch(e => { console.error(e); process.exit(1); });
