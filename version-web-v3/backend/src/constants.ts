// Hong Kong bounding box (all regions)
export const HK_BBOX = '22.15,113.80,22.55,114.40';
export const HK_BBOX_ARRAY = [22.15, 113.80, 22.55, 114.40] as const;

// Kowloon bounding box (for Overpass queries)
export const KOWLOON_BBOX = '22.29,114.15,22.34,114.20';

// Kowloon center
export const KOWLOON_CENTER = { lat: 22.319, lng: 114.170 };

// Route filter areas
export const HK_REGION = {
  kowloon: { minLat: 22.28, maxLat: 22.34, minLng: 114.14, maxLng: 114.22 },
  hong_kong_island: { minLat: 22.24, maxLat: 22.30, minLng: 114.12, maxLng: 114.22 },
};
