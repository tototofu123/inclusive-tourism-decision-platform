CREATE TABLE IF NOT EXISTS places (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    category TEXT,
    description TEXT,
    source_api TEXT DEFAULT 'osm',
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT places_name_lng_lat_key UNIQUE (name, lat, lng)
);

CREATE TABLE IF NOT EXISTS itineraries (
    id SERIAL PRIMARY KEY,
    session_id TEXT,
    user_text TEXT,
    region TEXT DEFAULT 'Kowloon',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS itinerary_items (
    id SERIAL PRIMARY KEY,
    itinerary_id INTEGER REFERENCES itineraries(id) ON DELETE CASCADE,
    place_id INTEGER REFERENCES places(id),
    stop_index INTEGER NOT NULL,
    label TEXT,
    start_time TEXT,
    end_time TEXT,
    road_distance_meters INTEGER DEFAULT 0,
    duration_minutes INTEGER DEFAULT 60,
    route_geometry_json JSONB
);
