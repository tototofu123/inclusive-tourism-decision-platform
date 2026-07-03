import { searchBySemantic, embedText } from './ragService';

export interface RagQuery {
  query: string;
  mobilityTags: string[];
  location: string;
  topK: number;
}

export interface CandidatePlace {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  accessibilityTags: string[];
  score: number;
}

export async function queryCandidatePlaces(query: RagQuery): Promise<CandidatePlace[]> {
  const searchQuery = [query.query, ...query.mobilityTags, query.location].filter(Boolean).join(' ');
  const results = await searchBySemantic(searchQuery, query.topK);

  return results.map((r: any) => ({
    placeId: String(r.id),
    name: r.name || '',
    address: r.address || '',
    lat: r.lat || 0,
    lng: r.lng || 0,
    accessibilityTags: r.accessibility_tags || [],
    score: r.similarity || 0,
  }));
}
