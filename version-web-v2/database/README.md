# Database — Web v2

## Migration: SQLite → AlloyDB for PostgreSQL

The schema is identical. SQLite types map 1:1 to PostgreSQL. The only additions are:
- `embedding` column (vector type, 768 dims) on `places`
- `usage_events` table for BigQuery streaming insert buffer
- `pgvector` extension

## Schema

```sql
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Places table
CREATE TABLE IF NOT EXISTS places (
  place_id          TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  address           TEXT,
  city              TEXT,
  lat               FLOAT,
  lng               FLOAT,
  accessibility_tags TEXT[],           -- e.g. {"wheelchair","elevator","braille"}
  embedding         vector(768),        -- Vertex AI text-embedding-004 output
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- Vector search index (cosine similarity)
CREATE INDEX IF NOT EXISTS places_embedding_idx
  ON places USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- User profiles
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id           TEXT PRIMARY KEY,
  mobility_tags     TEXT[],
  dietary_tags      TEXT[],
  language          TEXT DEFAULT 'en',
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- Itinerary history
CREATE TABLE IF NOT EXISTS itineraries (
  id                SERIAL PRIMARY KEY,
  user_id           TEXT REFERENCES user_profiles(user_id),
  query             TEXT,
  location          TEXT,
  result_json       JSONB,
  source            TEXT CHECK (source IN ('cloud','local')),
  latency_ms        INT,
  created_at        TIMESTAMPTZ DEFAULT now()
);
```

## Seeding

Seed data lives in `seed.sql`. It contains ~50 hand-verified accessible places in Hong Kong with pre-computed embeddings (run `scripts/embed_seed.ts` to regenerate).

## Local Development

For local dev without AlloyDB, set `VERTEX_AI_ENABLED=false`. The backend uses the SQLite fallback from v1 and never touches this schema.

## AlloyDB Connection

Use Cloud SQL Auth Proxy for local testing against a real AlloyDB instance:

```bash
./cloud-sql-proxy PROJECT:REGION:INSTANCE --port 5432
```

Then set:
```
ALLOYDB_CONNECTION_STRING=postgresql://user:password@localhost:5432/inclusive_tourism
```
