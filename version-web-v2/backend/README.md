# Backend – Web v2

This document describes backend changes for Web v2.

## AI Gateway
- New `cloudAiGateway` service that:
  - Calls Vertex AI / ADK.
  - Handles timeouts and fallbacks.

## RAG
- New `cloudRag` service to query Vector Search / AlloyDB.

Backend now orchestrates between local and cloud engines.
