# Files Needed — Web v2

All files and credentials required before v2 can run in cloud mode.

## GCP Setup Checklist

### 1. Project & APIs
- [ ] GCP project created
- [ ] Enable: Vertex AI API, AlloyDB API, Maps Directions API, BigQuery API, Cloud SQL Admin API
- [ ] Create service account with roles: `Vertex AI User`, `BigQuery Data Editor`, `Cloud SQL Client`
- [ ] Download service account JSON → set `GOOGLE_APPLICATION_CREDENTIALS`

### 2. Vertex AI Vector Search
- [ ] Create an Index (768 dims, cosine distance, `text-embedding-004`)
- [ ] Create an Index Endpoint and deploy the Index
- [ ] Note `VERTEX_VECTOR_INDEX_ENDPOINT` and `VERTEX_DEPLOYED_INDEX_ID`
- [ ] Run `scripts/embed_seed.ts` to generate embeddings for seed places
- [ ] Upload embeddings JSON to the index via `gcloud ai indexes upsert-datapoints`

### 3. AlloyDB
- [ ] Create AlloyDB cluster + primary instance (PostgreSQL 15)
- [ ] Create database: `inclusive_tourism`
- [ ] Run `version-web-v2/database/schema.sql`
- [ ] Run `version-web-v2/database/seed.sql` (after generating embeddings)
- [ ] Set `ALLOYDB_CONNECTION_STRING`

### 4. Google Maps
- [ ] Enable Directions API in GCP Console
- [ ] Create API key (restrict to Directions API)
- [ ] Set `MAPS_API_KEY`

### 5. BigQuery
- [ ] Create dataset: `inclusive_tourism`
- [ ] Create table: `usage_events` with schema:
  - `event STRING, source STRING, latency_ms INT64, mobility_tags STRING, location STRING, ts TIMESTAMP`
- [ ] Set `BIGQUERY_ENABLED=true`, `BIGQUERY_DATASET`, `BIGQUERY_TABLE`

### 6. Local .env
- [ ] Copy `backend/.env.example` → `backend/.env`
- [ ] Copy `backend/.env.gcp` → fill real values for production

## Local-Only Run (no GCP needed)

```bash
# Set in backend/.env:
VERTEX_AI_ENABLED=false

# Start backend
cd version-web-v2/backend && npm run dev

# Start frontend
cd version-web-v2/frontend && npm run dev
```

All AI calls fall through to llama.cpp + SQLite. Zero GCP credentials required.
