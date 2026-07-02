# Database – Web v1

This document describes DB changes for Web v1.

## Embeddings
- `places_embeddings` table becomes actively used.
- Batch job or script to generate embeddings for all seeded places.

## Preferences Storage (Optional)
- `user_sessions`
  - `id`
  - `preferences_json`

Storing preferences is optional; they can also remain purely client-side if desired.
