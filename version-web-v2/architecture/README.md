# Architecture – Web v2

This document describes the Web v2 architecture.

## Components
- Web frontend (unchanged structurally).
- Backend API with AI gateway and cloud RAG services.
- Google Cloud:
  - Vertex AI + Gemini.
  - Vector Search or AlloyDB.
  - BigQuery.
  - ADK agents.
- Google Maps API for routing.
- PostgreSQL/AlloyDB for storage.

## Data Flow
Same overall shape as Web v1, but planning and RAG are handled in Google Cloud, with local fallback.

Web v2 is the "cloud-first" web version.
