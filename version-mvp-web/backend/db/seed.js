const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function main() {
  const db = require('./database');

  // Run schema
  const fs = require('fs');
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await db.exec(schema);

  const places = [
    { name:'Hong Kong Park', name_zh:'香港公園', district:'Central', lat:22.2776, lng:114.1627, category:'attraction', accessibility_score:88, has_ramp:1, has_lift:1, has_accessible_toilet:1, has_tactile_path:1, bench_count:20, notes:'Fully accessible paths throughout. Lift access to all levels.' },
    { name:'Tai Chi Garden (Kowloon Park)', name_zh:'九龍公園太極園', district:'Tsim Sha Tsui', lat:22.3009, lng:114.1694, category:'rest_stop', accessibility_score:82, has_ramp:1, has_lift:0, has_accessible_toilet:1, has_tactile_path:1, bench_count:15, notes:'Flat paved paths, plenty of seating.' },
    { name:'HK Museum of History', name_zh:'香港歷史博物館', district:'Tsim Sha Tsui', lat:22.3042, lng:114.1758, category:'attraction', accessibility_score:95, has_ramp:1, has_lift:1, has_accessible_toilet:1, has_tactile_path:1, bench_count:30, notes:'Excellent accessibility. Free wheelchair loan at entrance.' },
    { name:'Ocean Park Main Entrance', name_zh:'海洋公園正門區域', district:'Southern', lat:22.2481, lng:114.1741, category:'attraction', accessibility_score:78, has_ramp:1, has_lift:1, has_accessible_toilet:1, has_tactile_path:0, bench_count:25, notes:'Lower park fully accessible. Cable car accessible gondola.' },
    { name:'Temple Street Night Market', name_zh:'廟街夜市', district:'Yau Ma Tei', lat:22.3082, lng:114.1697, category:'attraction', accessibility_score:55, has_ramp:0, has_lift:0, has_accessible_toilet:0, has_tactile_path:0, bench_count:5, notes:'Flat road surface but crowded. Limited seating.' },
    { name:'Citygate Outlets', name_zh:'東薈城名店倉', district:'Tung Chung', lat:22.2890, lng:113.9416, category:'rest_stop', accessibility_score:92, has_ramp:1, has_lift:1, has_accessible_toilet:1, has_tactile_path:1, bench_count:40, notes:'Fully step-free mall. Accessible MTR connection.' },
    { name:'Lung Cheung Road Garden', name_zh:'龍翔道花園', district:'Wong Tai Sin', lat:22.3397, lng:114.1928, category:'rest_stop', accessibility_score:70, has_ramp:1, has_lift:0, has_accessible_toilet:1, has_tactile_path:0, bench_count:12, notes:'Quiet garden with paved paths. Gentle slopes only.' },
    { name:'HK Space Museum', name_zh:'香港太空館', district:'Tsim Sha Tsui', lat:22.2942, lng:114.1724, category:'attraction', accessibility_score:90, has_ramp:1, has_lift:1, has_accessible_toilet:1, has_tactile_path:1, bench_count:20, notes:'Excellent accessibility. Planetarium wheelchair spaces.' },
    { name:'TST Promenade East', name_zh:'尖沙咀海濱長廊（東）', district:'Tsim Sha Tsui', lat:22.2944, lng:114.1796, category:'attraction', accessibility_score:85, has_ramp:1, has_lift:0, has_accessible_toilet:1, has_tactile_path:1, bench_count:35, notes:'Flat paved waterfront walkway. Step-free from MTR.' },
    { name:'Pacific Place', name_zh:'太古廣場', district:'Admiralty', lat:22.2775, lng:114.1654, category:'rest_stop', accessibility_score:93, has_ramp:1, has_lift:1, has_accessible_toilet:1, has_tactile_path:1, bench_count:30, notes:'Premium accessible mall. Connected to Admiralty MTR.' },
    { name:'M+ Museum', name_zh:'M+博物館', district:'Tsim Sha Tsui', lat:22.3008, lng:114.1588, category:'attraction', accessibility_score:94, has_ramp:1, has_lift:1, has_accessible_toilet:1, has_tactile_path:1, bench_count:25, notes:'Step-free entrance, wheelchair loan, braille guides. Connected to Kowloon MTR via covered walkway.' },
    { name:'Hong Kong Palace Museum', name_zh:'香港故宮文化博物館', district:'Tsim Sha Tsui', lat:22.3003, lng:114.1554, category:'attraction', accessibility_score:92, has_ramp:1, has_lift:1, has_accessible_toilet:1, has_tactile_path:1, bench_count:20, notes:'Fully accessible galleries. Rest areas on every floor.' },
    { name:'Times Square', name_zh:'時代廣場', district:'Causeway Bay', lat:22.2780, lng:114.1828, category:'rest_stop', accessibility_score:90, has_ramp:1, has_lift:1, has_accessible_toilet:1, has_tactile_path:1, bench_count:25, notes:'Large accessible mall. Direct MTR connection with lift.' },
    { name:'Victoria Park', name_zh:'維多利亞公園', district:'Causeway Bay', lat:22.2819, lng:114.1892, category:'attraction', accessibility_score:80, has_ramp:1, has_lift:0, has_accessible_toilet:1, has_tactile_path:1, bench_count:50, notes:'Flat wide paths. Many benches and pavilions for shade.' },
    { name:'Nan Lian Garden', name_zh:'南蓮園池', district:'Diamond Hill', lat:22.3395, lng:114.2027, category:'attraction', accessibility_score:86, has_ramp:1, has_lift:1, has_accessible_toilet:1, has_tactile_path:1, bench_count:18, notes:'Wheelchair-friendly classical garden. Wooden boardwalks with ramps.' },
    { name:'West Kowloon Art Park', name_zh:'西九藝術公園', district:'Tsim Sha Tsui', lat:22.3020, lng:114.1550, category:'attraction', accessibility_score:88, has_ramp:1, has_lift:0, has_accessible_toilet:1, has_tactile_path:1, bench_count:40, notes:'Expansive flat waterfront park. Accessible toilets throughout.' },
    { name:'Ngong Ping 360', name_zh:'昂坪360', district:'Lantau', lat:22.2524, lng:113.8678, category:'attraction', accessibility_score:81, has_ramp:1, has_lift:1, has_accessible_toilet:1, has_tactile_path:0, bench_count:15, notes:'Crystal cabin gondola accessible. Village flat with paved paths. Accessible shuttle bus from Tung Chung.' },
    { name:'Tsuen Wan Plaza', name_zh:'荃灣廣場', district:'Tsuen Wan', lat:22.3706, lng:114.1179, category:'rest_stop', accessibility_score:85, has_ramp:1, has_lift:1, has_accessible_toilet:1, has_tactile_path:1, bench_count:20, notes:'Step-free mall connected to Tsuen Wan MTR via lift. Quiet upper-floor seating areas.' },
    { name:'Happy Valley Racecourse (rest days)', name_zh:'跑馬地馬場（非賽馬日）', district:'Happy Valley', lat:22.2722, lng:114.1850, category:'attraction', accessibility_score:65, has_ramp:1, has_lift:1, has_accessible_toilet:1, has_tactile_path:0, bench_count:12, notes:'Open park on non-race days. Ramp access to public areas. Limited tactile paths.' },
  ];

  const stmt = `INSERT OR IGNORE INTO places (name, name_zh, district, lat, lng, category, accessibility_score,
        has_ramp, has_lift, has_accessible_toilet, has_tactile_path, bench_count, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  for (const p of places) {
    await db.insert(stmt, [p.name, p.name_zh, p.district, p.lat, p.lng, p.category, p.accessibility_score,
      p.has_ramp, p.has_lift, p.has_accessible_toilet, p.has_tactile_path, p.bench_count, p.notes]);
  }

  const count = await db.get('SELECT COUNT(*) as count FROM places');
  console.log(`Seeded ${count.count} places`);
}

main().catch(console.error);
