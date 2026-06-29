# Guide – Web v2

This document describes what Web v2 adds on top of Web v1.

## Goal
Migrate the AI and RAG layers from local infrastructure to Google Cloud while keeping a local fallback.

## Scope
- Introduce Vertex AI + Gemini for planning.
- Use Vertex AI Vector Search or AlloyDB for embeddings.
- Store behavioural analytics in BigQuery.
- Start using Google Maps API for routing.
- Keep llama.cpp as a fallback for when cloud is unavailable.

Web v2 is the first version that fully aligns with the hackathon's Google Cloud focus.
