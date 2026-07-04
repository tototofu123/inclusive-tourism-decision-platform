// Hong Kong bounding box (all regions)
export const HK_BBOX = '22.15,113.80,22.55,114.40';
export const HK_BBOX_ARRAY = [22.15, 113.80, 22.55, 114.40] as const;

// Kowloon bounding box (for Overpass queries)
export const KOWLOON_BBOX = '22.29,114.15,22.34,114.20';

// Kowloon center
export const KOWLOON_CENTER = { lat: 22.319, lng: 114.170 };

// Hong Kong Island center
export const HK_ISLAND_CENTER = { lat: 22.28, lng: 114.16 };

// New Territories center
export const NEW_TERRITORIES_CENTER = { lat: 22.38, lng: 114.18 };

// Lantau / outlying islands center
export const LANTAU_CENTER = { lat: 22.30, lng: 113.95 };

// Pipeline search center (Google Places API, 25km radius covers most of HK)
export const HK_PIPELINE_CENTER = { lat: 22.3193, lng: 114.1694 };

// Route filter areas
export const HK_REGION = {
  kowloon: { minLat: 22.28, maxLat: 22.34, minLng: 114.14, maxLng: 114.22 },
  hong_kong_island: { minLat: 22.24, maxLat: 22.30, minLng: 114.12, maxLng: 114.22 },
};
