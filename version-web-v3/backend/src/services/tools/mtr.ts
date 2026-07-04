export interface MtrStation { name: string; lat: number; lng: number; line: string; zone: string; accessible: boolean; accessibleToilet: boolean }

export const MTR_STATIONS: MtrStation[] = [
  { name: 'Tsim Sha Tsui', lat: 22.2978, lng: 114.1721, line: 'Tsuen Wan', zone: 'kowloon', accessible: true, accessibleToilet: true },
  { name: 'Jordan', lat: 22.3051, lng: 114.1693, line: 'Tsuen Wan', zone: 'kowloon', accessible: true, accessibleToilet: true },
  { name: 'Yau Ma Tei', lat: 22.3129, lng: 114.1713, line: 'Tsuen Wan', zone: 'kowloon', accessible: true, accessibleToilet: false },
  { name: 'Mong Kok', lat: 22.3186, lng: 114.1700, line: 'Tsuen Wan', zone: 'kowloon', accessible: true, accessibleToilet: false },
  { name: 'Prince Edward', lat: 22.3250, lng: 114.1700, line: 'Tsuen Wan', zone: 'kowloon', accessible: true, accessibleToilet: true },
  { name: 'Sham Shui Po', lat: 22.3300, lng: 114.1620, line: 'Tsuen Wan', zone: 'kowloon', accessible: true, accessibleToilet: false },
  { name: 'Cheung Sha Wan', lat: 22.3360, lng: 114.1550, line: 'Tsuen Wan', zone: 'kowloon', accessible: true, accessibleToilet: false },
  { name: 'Lai Chi Kok', lat: 22.3400, lng: 114.1480, line: 'Tsuen Wan', zone: 'kowloon', accessible: true, accessibleToilet: true },
  { name: 'Mei Foo', lat: 22.3370, lng: 114.1400, line: 'Tsuen Wan', zone: 'kowloon', accessible: true, accessibleToilet: true },
  { name: 'Lai King', lat: 22.3470, lng: 114.1300, line: 'Tsuen Wan', zone: 'kowloon', accessible: false, accessibleToilet: false },
  { name: 'Kwai Fong', lat: 22.3570, lng: 114.1270, line: 'Tsuen Wan', zone: 'new_territories', accessible: true, accessibleToilet: false },
  { name: 'Kwai Hing', lat: 22.3620, lng: 114.1300, line: 'Tsuen Wan', zone: 'new_territories', accessible: true, accessibleToilet: true },
  { name: 'Tai Wo Hau', lat: 22.3720, lng: 114.1280, line: 'Tsuen Wan', zone: 'new_territories', accessible: true, accessibleToilet: false },
  { name: 'Tsuen Wan', lat: 22.3740, lng: 114.1150, line: 'Tsuen Wan', zone: 'new_territories', accessible: true, accessibleToilet: true },
  { name: 'Admiralty', lat: 22.2790, lng: 114.1630, line: 'Island', zone: 'hong_kong_island', accessible: true, accessibleToilet: true },
  { name: 'Wan Chai', lat: 22.2760, lng: 114.1720, line: 'Island', zone: 'hong_kong_island', accessible: true, accessibleToilet: true },
  { name: 'Causeway Bay', lat: 22.2800, lng: 114.1830, line: 'Island', zone: 'hong_kong_island', accessible: true, accessibleToilet: true },
  { name: 'Tin Hau', lat: 22.2830, lng: 114.1910, line: 'Island', zone: 'hong_kong_island', accessible: true, accessibleToilet: false },
  { name: 'Fortress Hill', lat: 22.2870, lng: 114.1940, line: 'Island', zone: 'hong_kong_island', accessible: true, accessibleToilet: false },
  { name: 'North Point', lat: 22.2900, lng: 114.2000, line: 'Island', zone: 'hong_kong_island', accessible: true, accessibleToilet: true },
  { name: 'Quarry Bay', lat: 22.2880, lng: 114.2100, line: 'Island', zone: 'hong_kong_island', accessible: true, accessibleToilet: false },
  { name: 'Tai Koo', lat: 22.2850, lng: 114.2180, line: 'Island', zone: 'hong_kong_island', accessible: true, accessibleToilet: false },
  { name: 'Sai Wan Ho', lat: 22.2820, lng: 114.2230, line: 'Island', zone: 'hong_kong_island', accessible: true, accessibleToilet: false },
  { name: 'Shau Kei Wan', lat: 22.2790, lng: 114.2290, line: 'Island', zone: 'hong_kong_island', accessible: true, accessibleToilet: false },
  { name: 'Heng Fa Chuen', lat: 22.2760, lng: 114.2400, line: 'Island', zone: 'hong_kong_island', accessible: false, accessibleToilet: false },
  { name: 'Chai Wan', lat: 22.2720, lng: 114.2480, line: 'Island', zone: 'hong_kong_island', accessible: false, accessibleToilet: false },
  { name: 'Kowloon Tong', lat: 22.3370, lng: 114.1750, line: 'East Rail', zone: 'kowloon', accessible: true, accessibleToilet: true },
  { name: 'Exhibition Centre', lat: 22.2830, lng: 114.1750, line: 'East Rail', zone: 'hong_kong_island', accessible: false, accessibleToilet: false },
  { name: 'Mong Kok East', lat: 22.3220, lng: 114.1770, line: 'East Rail', zone: 'kowloon', accessible: false, accessibleToilet: false },
  { name: 'Tai Wai', lat: 22.3740, lng: 114.1800, line: 'East Rail', zone: 'new_territories', accessible: false, accessibleToilet: false },
  { name: 'Sha Tin', lat: 22.3830, lng: 114.1880, line: 'East Rail', zone: 'new_territories', accessible: true, accessibleToilet: true },
  { name: 'Fo Tan', lat: 22.3950, lng: 114.1950, line: 'East Rail', zone: 'new_territories', accessible: true, accessibleToilet: false },
  { name: 'University', lat: 22.4130, lng: 114.2100, line: 'East Rail', zone: 'new_territories', accessible: true, accessibleToilet: true },
  { name: 'Tai Po Market', lat: 22.4450, lng: 114.1700, line: 'East Rail', zone: 'new_territories', accessible: true, accessibleToilet: true },
  { name: 'Sheung Shui', lat: 22.5020, lng: 114.1280, line: 'East Rail', zone: 'new_territories', accessible: true, accessibleToilet: true },
  { name: 'Fanling', lat: 22.4930, lng: 114.1400, line: 'East Rail', zone: 'new_territories', accessible: true, accessibleToilet: true },
  { name: 'East Tsim Sha Tsui', lat: 22.2940, lng: 114.1760, line: 'Tuen Ma', zone: 'kowloon', accessible: true, accessibleToilet: true },
  { name: 'Hung Hom', lat: 22.3010, lng: 114.1860, line: 'Tuen Ma', zone: 'kowloon', accessible: true, accessibleToilet: true },
  { name: 'Ho Man Tin', lat: 22.3100, lng: 114.1880, line: 'Tuen Ma', zone: 'kowloon', accessible: false, accessibleToilet: false },
  { name: 'To Kwa Wan', lat: 22.3180, lng: 114.1900, line: 'Tuen Ma', zone: 'kowloon', accessible: false, accessibleToilet: false },
  { name: 'Kai Tak', lat: 22.3260, lng: 114.1950, line: 'Tuen Ma', zone: 'kowloon', accessible: false, accessibleToilet: false },
  { name: 'Diamond Hill', lat: 22.3410, lng: 114.2050, line: 'Tuen Ma', zone: 'kowloon', accessible: true, accessibleToilet: true },
  { name: 'Austin', lat: 22.3020, lng: 114.1660, line: 'Tuen Ma', zone: 'kowloon', accessible: true, accessibleToilet: true },
  { name: 'Tuen Mun', lat: 22.3940, lng: 113.9750, line: 'Tuen Ma', zone: 'new_territories', accessible: false, accessibleToilet: false },
  { name: 'Siu Hong', lat: 22.4000, lng: 113.9700, line: 'Tuen Ma', zone: 'new_territories', accessible: false, accessibleToilet: false },
  { name: 'Tin Shui Wai', lat: 22.4550, lng: 114.0020, line: 'Tuen Ma', zone: 'new_territories', accessible: false, accessibleToilet: false },
  { name: 'Long Ping', lat: 22.4500, lng: 114.0250, line: 'Tuen Ma', zone: 'new_territories', accessible: false, accessibleToilet: false },
  { name: 'Yuen Long', lat: 22.4450, lng: 114.0350, line: 'Tuen Ma', zone: 'new_territories', accessible: false, accessibleToilet: false },
  { name: 'Tsuen Wan West', lat: 22.3680, lng: 114.1070, line: 'Tuen Ma', zone: 'new_territories', accessible: false, accessibleToilet: false },
  { name: 'Nam Cheong', lat: 22.3260, lng: 114.1550, line: 'Tuen Ma', zone: 'kowloon', accessible: false, accessibleToilet: false },
  { name: 'Lok Fu', lat: 22.3370, lng: 114.1880, line: 'Kwun Tong', zone: 'kowloon', accessible: true, accessibleToilet: false },
  { name: 'Wong Tai Sin', lat: 22.3420, lng: 114.1940, line: 'Kwun Tong', zone: 'kowloon', accessible: true, accessibleToilet: true },
  { name: 'Ngau Chi Wan', lat: 22.3390, lng: 114.2020, line: 'Kwun Tong', zone: 'kowloon', accessible: false, accessibleToilet: false },
  { name: 'Kwun Tong', lat: 22.3120, lng: 114.2250, line: 'Kwun Tong', zone: 'kowloon', accessible: true, accessibleToilet: true },
  { name: 'Ngau Tau Kok', lat: 22.3170, lng: 114.2180, line: 'Kwun Tong', zone: 'kowloon', accessible: true, accessibleToilet: false },
  { name: 'Kowloon Bay', lat: 22.3240, lng: 114.2110, line: 'Kwun Tong', zone: 'kowloon', accessible: true, accessibleToilet: false },
  { name: 'Choi Hung', lat: 22.3340, lng: 114.2100, line: 'Kwun Tong', zone: 'kowloon', accessible: true, accessibleToilet: false },
  { name: 'Lam Tin', lat: 22.3140, lng: 114.2360, line: 'Kwun Tong', zone: 'kowloon', accessible: true, accessibleToilet: true },
  { name: 'Yau Tong', lat: 22.2970, lng: 114.2410, line: 'Kwun Tong', zone: 'kowloon', accessible: false, accessibleToilet: false },
  { name: 'Tseung Kwan O', lat: 22.3090, lng: 114.2600, line: 'Tseung Kwan O', zone: 'new_territories', accessible: true, accessibleToilet: true },
  { name: 'Ti Keng Leng', lat: 22.3040, lng: 114.2530, line: 'Tseung Kwan O', zone: 'new_territories', accessible: false, accessibleToilet: false },
  { name: 'Hang Hau', lat: 22.3170, lng: 114.2700, line: 'Tseung Kwan O', zone: 'new_territories', accessible: true, accessibleToilet: false },
  { name: 'Po Lam', lat: 22.3250, lng: 114.2780, line: 'Tseung Kwan O', zone: 'new_territories', accessible: false, accessibleToilet: false },
  { name: 'LOHAS Park', lat: 22.2930, lng: 114.2720, line: 'Tseung Kwan O', zone: 'new_territories', accessible: false, accessibleToilet: false },
  { name: 'Hong Kong', lat: 22.2850, lng: 114.1580, line: 'Tung Chung', zone: 'hong_kong_island', accessible: true, accessibleToilet: true },
  { name: 'Kowloon', lat: 22.3040, lng: 114.1620, line: 'Tung Chung', zone: 'kowloon', accessible: false, accessibleToilet: false },
  { name: 'Olympic', lat: 22.3170, lng: 114.1600, line: 'Tung Chung', zone: 'kowloon', accessible: false, accessibleToilet: false },
  { name: 'Tsing Yi', lat: 22.3540, lng: 114.1080, line: 'Tung Chung', zone: 'new_territories', accessible: true, accessibleToilet: true },
  { name: 'Tung Chung', lat: 22.2880, lng: 113.9400, line: 'Tung Chung', zone: 'new_territories', accessible: true, accessibleToilet: true },
  { name: 'Ocean Park', lat: 22.2470, lng: 114.1760, line: 'South Island', zone: 'hong_kong_island', accessible: true, accessibleToilet: true },
  { name: 'Wong Chuk Hang', lat: 22.2480, lng: 114.1750, line: 'South Island', zone: 'hong_kong_island', accessible: false, accessibleToilet: false },
  { name: 'Lei Tung', lat: 22.2440, lng: 114.1530, line: 'South Island', zone: 'hong_kong_island', accessible: true, accessibleToilet: false },
  { name: 'South Horizons', lat: 22.2420, lng: 114.1490, line: 'South Island', zone: 'hong_kong_island', accessible: true, accessibleToilet: true },
  { name: 'Disneyland Resort', lat: 22.3120, lng: 114.0430, line: 'Disney', zone: 'new_territories', accessible: false, accessibleToilet: false },
  { name: 'Airport', lat: 22.3150, lng: 113.9350, line: 'Airport Express', zone: 'new_territories', accessible: false, accessibleToilet: false },
  { name: 'AsiaWorld Expo', lat: 22.3210, lng: 113.9400, line: 'Airport Express', zone: 'new_territories', accessible: false, accessibleToilet: false },
];

export function isMTRStationAccessible(stationName: string): boolean {
  const lower = stationName.toLowerCase();
  for (const s of MTR_STATIONS) {
    if (s.name.toLowerCase().includes(lower) || lower.includes(s.name.toLowerCase())) {
      return s.accessible;
    }
  }
  return false;
}

export function findNearestMtr(lat: number, lng: number): MtrStation | null {
  let best: MtrStation | null = null;
  let bestDist = Infinity;
  for (const s of MTR_STATIONS) {
    const d = Math.sqrt((lat - s.lat) ** 2 + (lng - s.lng) ** 2);
    if (d < bestDist) { bestDist = d; best = s; }
  }
  return bestDist < 0.02 ? best : null;
}

const MTR_TRAVEL_TIMES: Record<string, Record<string, number>> = {
  'Tsim Sha Tsui': { 'Jordan': 2, 'Yau Ma Tei': 3, 'Mong Kok': 5, 'Prince Edward': 6, 'Sham Shui Po': 8, 'Cheung Sha Wan': 9, 'Lai Chi Kok': 11, 'Mei Foo': 12, 'Lai King': 14, 'Kwai Fong': 16, 'Kwai Hing': 17, 'Tai Wo Hau': 18, 'Tsuen Wan': 20, 'East Tsim Sha Tsui': 3, 'Hung Hom': 5, 'Kowloon Tong': 10, 'Austin': 2, 'Admiralty': 6, 'Wan Chai': 8, 'Causeway Bay': 10, 'Hong Kong': 4, 'Kowloon': 3 },
  'Jordan': { 'Tsim Sha Tsui': 2, 'Yau Ma Tei': 2, 'Mong Kok': 3, 'Prince Edward': 5, 'East Tsim Sha Tsui': 4, 'Austin': 3, 'Kowloon': 2, 'Hong Kong': 5, 'Admiralty': 7 },
  'Yau Ma Tei': { 'Tsim Sha Tsui': 3, 'Jordan': 2, 'Mong Kok': 2, 'Prince Edward': 3, 'East Tsim Sha Tsui': 5, 'Austin': 4, 'Mong Kok East': 4, 'Kowloon': 2 },
  'Mong Kok': { 'Tsim Sha Tsui': 5, 'Jordan': 3, 'Yau Ma Tei': 2, 'Prince Edward': 2, 'Sham Shui Po': 3, 'Kowloon Tong': 6, 'Mong Kok East': 2, 'Lok Fu': 5, 'Kowloon Bay': 8 },
  'Prince Edward': { 'Tsim Sha Tsui': 6, 'Mong Kok': 2, 'Sham Shui Po': 2, 'Kowloon Tong': 5, 'Lok Fu': 6, 'Diamond Hill': 8, 'Mong Kok East': 4 },
  'Sham Shui Po': { 'Cheung Sha Wan': 2, 'Lai Chi Kok': 3, 'Mei Foo': 5, 'Prince Edward': 2, 'Mong Kok': 3, 'Nam Cheong': 2 },
  'Lai King': { 'Mei Foo': 2, 'Kwai Fong': 2, 'Kwai Hing': 3, 'Tai Wo Hau': 4, 'Tsuen Wan': 5, 'Nam Cheong': 3, 'Tsing Yi': 4 },
  'Tsuen Wan': { 'Tai Wo Hau': 2, 'Kwai Hing': 3, 'Kwai Fong': 4, 'Lai King': 5, 'Mei Foo': 7, 'Tsuen Wan West': 3 },
  'East Tsim Sha Tsui': { 'Tsim Sha Tsui': 3, 'Hung Hom': 2, 'Austin': 3, 'Ho Man Tin': 4, 'Kai Tak': 8 },
  'Hung Hom': { 'East Tsim Sha Tsui': 2, 'Ho Man Tin': 3, 'Kowloon Tong': 5, 'Tsim Sha Tsui': 5, 'Austin': 3, 'Exhibition Centre': 4, 'Admiralty': 6 },
  'Ho Man Tin': { 'Hung Hom': 3, 'To Kwa Wan': 2, 'Kai Tak': 3, 'Kowloon Tong': 4, 'Diamond Hill': 5 },
  'Kai Tak': { 'Ho Man Tin': 3, 'To Kwa Wan': 2, 'Diamond Hill': 3, 'Kowloon Bay': 5 },
  'Diamond Hill': { 'Kai Tak': 3, 'Kowloon Tong': 4, 'Choi Hung': 2, 'Wong Tai Sin': 2, 'Ngau Chi Wan': 3, 'Ho Man Tin': 5, 'Sha Tin': 8, 'Tai Wai': 6 },
  'Tuen Mun': { 'Siu Hong': 2, 'Tin Shui Wai': 6, 'Long Ping': 8, 'Yuen Long': 10, 'Kam Sheung Road': 13, 'Tsuen Wan West': 18, 'Nam Cheong': 25, 'Austin': 28, 'Hung Hom': 32 },
  'Yuen Long': { 'Long Ping': 2, 'Tin Shui Wai': 4, 'Siu Hong': 8, 'Tuen Mun': 10, 'Kam Sheung Road': 3, 'Tsuen Wan West': 10 },
  'Tsuen Wan West': { 'Kam Sheung Road': 5, 'Yuen Long': 10, 'Nam Cheong': 7, 'Austin': 10, 'Hung Hom': 12, 'Tsuen Wan': 3 },
  'Nam Cheong': { 'Mei Foo': 2, 'Lai King': 3, 'Olympic': 3, 'Kowloon': 5, 'Tsuen Wan West': 7, 'Austin': 4, 'Sham Shui Po': 2 },
  'Kowloon Tong': { 'Mong Kok': 6, 'Prince Edward': 5, 'Lok Fu': 3, 'Diamond Hill': 5, 'Ho Man Tin': 4, 'Tai Wai': 4, 'Sha Tin': 7, 'Mong Kok East': 3, 'Hung Hom': 5, 'Exhibition Centre': 8, 'Admiralty': 10 },
  'Tai Wai': { 'Kowloon Tong': 4, 'Sha Tin': 3, 'Diamond Hill': 6, 'Fo Tan': 5, 'University': 8 },
  'Sha Tin': { 'Tai Wai': 3, 'Fo Tan': 3, 'Kowloon Tong': 7, 'University': 5, 'Tai Po Market': 10, 'Fanling': 15, 'Sheung Shui': 16 },
  'University': { 'Sha Tin': 5, 'Fo Tan': 3, 'Tai Po Market': 5, 'Tai Wai': 8 },
  'Tai Po Market': { 'University': 5, 'Fanling': 7, 'Sheung Shui': 8, 'Sha Tin': 10 },
  'Fanling': { 'Sheung Shui': 2, 'Tai Po Market': 7, 'Sha Tin': 15, 'Kowloon Tong': 22 },
  'Exhibition Centre': { 'Admiralty': 2, 'Hung Hom': 4, 'Kowloon Tong': 8, 'Mong Kok East': 6 },
  'Admiralty': { 'Wan Chai': 2, 'Causeway Bay': 4, 'Tin Hau': 6, 'Fortress Hill': 7, 'North Point': 9, 'Hong Kong': 3, 'Tsim Sha Tsui': 6, 'Exhibition Centre': 2, 'Ocean Park': 5 },
  'Wan Chai': { 'Admiralty': 2, 'Causeway Bay': 2, 'Tin Hau': 4, 'Fortress Hill': 5, 'North Point': 7, 'Tsim Sha Tsui': 8 },
  'Causeway Bay': { 'Wan Chai': 2, 'Tin Hau': 2, 'Admiralty': 4, 'Fortress Hill': 3, 'North Point': 5, 'Tsim Sha Tsui': 10 },
  'North Point': { 'Fortress Hill': 2, 'Tin Hau': 3, 'Causeway Bay': 5, 'Quarry Bay': 2, 'Tai Koo': 4, 'Sai Wan Ho': 6, 'Shau Kei Wan': 7, 'Heng Fa Chuen': 10, 'Chai Wan': 12, 'Tseung Kwan O': 10, 'Ti Keng Leng': 12 },
  'Quarry Bay': { 'North Point': 2, 'Tai Koo': 2, 'Sai Wan Ho': 4, 'Tseung Kwan O': 8, 'Yau Tong': 6 },
  'Tai Koo': { 'Quarry Bay': 2, 'Sai Wan Ho': 2, 'Shau Kei Wan': 3 },
  'Chai Wan': { 'Heng Fa Chuen': 2, 'Shau Kei Wan': 4, 'Sai Wan Ho': 5 },
  'Lok Fu': { 'Wong Tai Sin': 2, 'Kowloon Tong': 3, 'Diamond Hill': 3, 'Prince Edward': 6, 'Ngau Chi Wan': 2 },
  'Wong Tai Sin': { 'Lok Fu': 2, 'Diamond Hill': 2, 'Ngau Chi Wan': 2, 'Choi Hung': 3 },
  'Ngau Tau Kok': { 'Kwun Tong': 2, 'Kowloon Bay': 2, 'Ngau Chi Wan': 3, 'Lam Tin': 3 },
  'Kwun Tong': { 'Ngau Tau Kok': 2, 'Lam Tin': 3, 'Kowloon Bay': 3, 'Yau Tong': 5 },
  'Lam Tin': { 'Kwun Tong': 3, 'Yau Tong': 2, 'Ngau Tau Kok': 3, 'Tseung Kwan O': 6 },
  'Yau Tong': { 'Lam Tin': 2, 'Kwun Tong': 5, 'Tseung Kwan O': 4, 'Ti Keng Leng': 3, 'Quarry Bay': 6 },
  'Tseung Kwan O': { 'Ti Keng Leng': 2, 'Hang Hau': 3, 'Po Lam': 5, 'LOHAS Park': 4, 'Lam Tin': 6, 'Yau Tong': 4, 'North Point': 10, 'Quarry Bay': 8 },
  'Hang Hau': { 'Po Lam': 3, 'Tseung Kwan O': 3, 'Ti Keng Leng': 4, 'LOHAS Park': 5 },
  'Hong Kong': { 'Kowloon': 3, 'Olympic': 5, 'Nam Cheong': 7, 'Lai King': 10, 'Tsing Yi': 12, 'Sunny Bay': 18, 'Tung Chung': 22, 'Airport': 20, 'Tsim Sha Tsui': 4, 'Admiralty': 3 },
  'Kowloon': { 'Hong Kong': 3, 'Olympic': 2, 'Nam Cheong': 4, 'Austin': 2, 'Jordan': 2, 'Tsim Sha Tsui': 3 },
  'Olympic': { 'Kowloon': 2, 'Nam Cheong': 3, 'Hong Kong': 5, 'Tai Kok Tsui': 2 },
  'Tsing Yi': { 'Lai King': 4, 'Sunny Bay': 6, 'Tung Chung': 10, 'Nam Cheong': 5, 'Airport': 8, 'Tsuen Wan': 5 },
  'Ocean Park': { 'Admiralty': 5, 'Wong Chuk Hang': 2, 'Lei Tung': 4, 'South Horizons': 6 },
  'Airport': { 'Tsing Yi': 8, 'Kowloon': 15, 'Hong Kong': 18, 'AsiaWorld Expo': 2, 'Tung Chung': 5 },
  'AsiaWorld Expo': { 'Airport': 2, 'Tsing Yi': 10, 'Tung Chung': 5 },
  'Austin': { 'Tsim Sha Tsui': 2, 'East Tsim Sha Tsui': 3, 'Hung Hom': 3, 'Kowloon': 2, 'Nam Cheong': 4, 'Jordan': 3 },
};

export function estimateMtrTime(from: string, to: string): number {
  if (from === to) return 0;
  const direct = MTR_TRAVEL_TIMES[from]?.[to];
  if (direct) return direct;
  const reverse = MTR_TRAVEL_TIMES[to]?.[from];
  if (reverse) return reverse;
  const commonStations = ['Mong Kok', 'Prince Edward', 'Kowloon Tong', 'Hung Hom', 'Admiralty', 'Nam Cheong', 'North Point'];
  for (const mid of commonStations) {
    const a = MTR_TRAVEL_TIMES[from]?.[mid] || MTR_TRAVEL_TIMES[mid]?.[from];
    const b = MTR_TRAVEL_TIMES[mid]?.[to] || MTR_TRAVEL_TIMES[to]?.[mid];
    if (a && b) return a + b;
  }
  return 20;
}
