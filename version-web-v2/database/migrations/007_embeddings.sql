-- Add embedding column for vector search
-- Uses JSONB so it works without pgvector extension (cosine similarity in Node.js)

ALTER TABLE places ADD COLUMN IF NOT EXISTS embedding JSONB;
CREATE INDEX IF NOT EXISTS idx_places_embedding ON places USING gin (embedding);
