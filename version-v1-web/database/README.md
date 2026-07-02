# Database – V1

This document describes the PostgreSQL schema and usage for V1.

## Tables

### `places`
- `id` (primary key)
- `name` (text)
- `lat` (float)
- `lng` (float)
- `description` (text, nullable)
- `source_api` (text, e.g. "osm", "seed")
- `raw_metadata_json` (jsonb)

### `itineraries`
- `id` (primary key)
- `created_at` (timestamp)
- `region` (text, e.g. "Kowloon")

### `itinerary_items`
- `id` (primary key)
- `itinerary_id` (foreign key → `itineraries.id`)
- `place_id` (foreign key → `places.id`)
- `start_time` (timestamp or relative offset)
- `end_time` (timestamp or relative offset)
- `road_distance_meters` (integer)
- `route_geometry_json` (jsonb, holds polyline or coordinates sequence)

### Optional: `places_embeddings`
- `place_id` (foreign key → `places.id`)
- `embedding_vector` (vector type via pgvector)

## Migrations
- Initial migration creates the three main tables.
- Optional second migration adds the embeddings table.

## Usage Patterns
- MVP mostly writes and reads complete itineraries.
- Later versions will query `places_embeddings` for RAG.

This schema is intentionally simple but supports the core MVP and later RAG expansion.
