export type Intent = 'question' | 'find_places' | 'create_itinerary' | 'add_to_itinerary';

export interface ChatResponse {
  thinking: string[];
  intent: Intent;
  response: string;
  places?: Place[];
  itinerary?: {
    id: number;
    stops: Array<{ label: string; placeId: number; startTime: string; endTime: string; lat: number; lng: number }>;
  };
  allItineraries?: Array<{ id: number; user_text: string; created_at: string; stop_count: number }>;
}

export interface Place {
  id: number;
  name: string;
  lat: number;
  lng: number;
  category?: string;
  description?: string;
  source_api?: string;
}

export interface ItineraryRow {
  id: number;
  session_id?: string;
  user_text?: string;
  region?: string;
  created_at: string;
}

export interface ItineraryItemRow {
  id: number;
  itinerary_id: number;
  place_id: number;
  stop_index: number;
  label?: string;
  start_time?: string;
  end_time?: string;
  road_distance_meters?: number;
  duration_minutes?: number;
  route_geometry_json?: object;
  place_name?: string;
  lat?: number;
  lng?: number;
  category?: string;
  description?: string;
}

export interface LLMStop {
  label: string;
  category: string;
  approx_duration_minutes: number;
  notes?: string;
}

export interface LLMResponse {
  stops: LLMStop[];
  total_duration_minutes: number;
  ordering_hint?: string;
}
