export interface ChatResponse {
  thinking: string[];
  response: string;
  sessionTitle?: string;
  places?: Place[];
  itinerary?: {
    id: number;
    stops: Array<{ label: string; placeId: number; startTime: string; endTime: string; lat: number; lng: number; day?: number; distance?: number }>;
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
  day_number?: number;
  transport_cost?: number;
  entry_cost?: number;
  transport_mode?: string;
  confirmed?: boolean;
  confirmed_at?: string;
}

export interface LLMStop {
  label: string;
  category: string;
  approx_duration_minutes: number;
  notes?: string;
  day?: number;
}

export interface LLMResponse {
  stops: LLMStop[];
  total_duration_minutes: number;
  days?: number;
  focus_areas?: string[];
  ordering_hint?: string;
}
