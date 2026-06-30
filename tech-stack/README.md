# Technology Stack — Inclusive Tourism Decision Platform

This document covers every technology, service, and library used across all five versions of the platform (MVP Web → Web v1 → Web v2 → App v3 → App Final). It explains **what** each technology is, **why** it was chosen, **which version** it first appears in, and **how** it contributes to scalability and real-world deployment.

---

## Why This Stack?

The fundamental design principle is **progressive infrastructure**: start local, prove the idea, then migrate to cloud without rewriting. Every technology choice serves one of three goals:

1. **Proving the concept quickly** — hackathon-safe, runnable on a laptop, zero config, no API keys needed on day one.
2. **Delivering real AI quality** — accessibility-aware planning requires semantics, reasoning, and retrieval, not just keyword matching.
3. **Scaling to production** — Google Cloud's managed services can take the same codebase from a demo running on one machine to a service handling thousands of concurrent travellers across Hong Kong.

---

## Google Technologies

### Vertex AI + Gemini
- **What it is**: Google Cloud's managed AI platform, exposing Gemini (Google's state-of-the-art LLM family) via a REST/gRPC API.
- **Why chosen**: Gemini has strong multilingual understanding (Cantonese, Traditional Chinese, English), native tool-use and function-calling, and a large context window suitable for planning across many places in a single prompt.
- **First appears in**: Web v2.
- **Role in the system**: Powers the Route Planner Agent, Place Selector Agent, and Accessibility Scoring Agent. The Planning Service sends a structured prompt with user preferences, candidate places, and accessibility constraints; Gemini returns a JSON itinerary that the backend validates and stores.
- **Scalability**: Vertex AI is a fully managed, auto-scaling endpoint. There is no infrastructure to provision; capacity scales with request volume automatically.

### Agent Development Kit (ADK)
- **What it is**: Google's framework for building, orchestrating, and deploying multi-agent AI systems on Vertex AI.
- **Why chosen**: The platform requires at least five distinct agents (route planning, place selection, accessibility scoring, merchant advisory, city insights). ADK provides a standard way to define agent roles, memory, tools, and communication patterns without building a custom orchestration layer.
- **First appears in**: Web v2.
- **Role in the system**: Defines each agent's responsibilities, the sequence of agent calls (e.g. Place Selector feeds candidates to Route Planner, which feeds to Accessibility Scorer), and handles inter-agent communication. ADK also manages retry logic and error escalation.
- **Scalability**: ADK agents run on Vertex AI infrastructure; individual agents can be scaled independently based on load.

### Vertex AI Vector Search
- **What it is**: A managed, high-performance approximate nearest neighbour (ANN) search service for dense vector embeddings.
- **Why chosen**: Semantic search over a large corpus of Hong Kong places (descriptions, accessibility reports, user reviews) cannot be done with keyword matching alone. Vector search retrieves semantically relevant candidates that a keyword search would miss (e.g. "quiet courtyard garden" matching a historic temple with benches).
- **First appears in**: Web v2 (replaces in-process SQLite vector search from Web v1).
- **Role in the system**: The RAG pipeline embeds the user query and preference context using a text-embedding model, then queries Vector Search to retrieve the top-K most relevant candidate places. These candidates are passed to the Planning Agent as context.
- **Scalability**: Vector Search is designed for billions of vectors with millisecond latency. As the place corpus grows from hundreds to millions of entries (e.g. user-submitted reports, government data), Vector Search scales without schema changes.

### AlloyDB for PostgreSQL
- **What it is**: A Google Cloud-managed, PostgreSQL-compatible database with built-in ML features including vector similarity search (pgvector-compatible) and columnar storage for analytics.
- **Why chosen**: The platform needs a relational database for core entities (places, itineraries, users, merchant profiles) and a vector store for embeddings. AlloyDB combines both in one managed service, eliminating the need to run separate Postgres + pgvector instances in production.
- **First appears in**: Web v2 (replaces SQLite from MVP/Web v1).
- **Role in the system**: Stores canonical place records (name, location, accessibility attributes, opening hours), itinerary records, and vector embeddings. AlloyDB's ML integration means the application can query `SELECT ... ORDER BY embedding <=> $1 LIMIT 10` natively.
- **Scalability**: AlloyDB is fully managed with read replicas, automatic failover, and horizontal read scaling. Storage scales independently of compute.

### BigQuery
- **What it is**: Google Cloud's serverless, highly scalable data warehouse designed for large-scale analytical queries.
- **Why chosen**: The platform needs to analyse aggregate behaviour (popular routes, bottleneck locations, accessibility gap reports, merchant footfall trends) at a scale that is not practical in a transactional database. BigQuery allows ad-hoc SQL across billions of rows with no infrastructure management.
- **First appears in**: Web v2 (analytics only).
- **Role in the system**:
  - Stores anonymised event data streamed from the backend (e.g. which itinerary stops were rejected by users, which accessibility obstacles were reported).
  - Powers the City Insights Agent: queries aggregate heatmaps, identifies recurring bottlenecks, and surfaces infrastructure recommendations for stakeholders.
  - Powers the Merchant Advisory Agent: correlates footfall patterns with merchant category and location.
- **Scalability**: BigQuery is serverless; it scales to petabytes. There is no capacity planning required.

### Google Maps Platform
- **What it is**: Google's suite of mapping, routing, and places APIs.
- **Why chosen**: Google Maps provides the highest quality routing data in Hong Kong, including real-time traffic, public transit options (MTR, buses, minibuses), walking directions, and accessibility routing hints. It also provides Places API data that can enrich the corpus.
- **APIs used**:
  - **Directions API**: computes routes between itinerary stops, including walking time, transit segments, and estimated arrival times.
  - **Places API (New)**: enriches place records with photos, reviews, opening hours, and accessibility attributes.
  - **Maps JavaScript API / Maps SDK for Android/iOS**: renders interactive maps in the web and mobile frontends.
- **First appears in**: Web v2 (replaces OpenRouteService).
- **Scalability**: Google Maps Platform is a managed, globally distributed service. Usage scales with API call volume under a pay-as-you-go model.

### Cloud Logging and Cloud Monitoring
- **What they are**: Google Cloud's managed observability stack.
- **Why chosen**: Production systems need structured logging, alerting, and performance dashboards. Cloud Logging and Monitoring integrate natively with all other GCP services (Vertex AI latency, AlloyDB query performance, backend errors, agent chain duration).
- **First appears in**: App Final.
- **Role in the system**: Centralized log ingestion, structured search, uptime monitoring, and alerting for all microservices.

---

## NVIDIA Technologies

### NVIDIA GPU (Local Inference — MVP and Web v1)
- **What it is**: Consumer or workstation NVIDIA GPU used to run llama.cpp inference with CUDA acceleration.
- **Why chosen**: For the MVP and Web v1, the architecture is intentionally local-first to allow development without cloud dependencies. llama.cpp with CUDA support can run a 7B–13B parameter model at acceptable speeds on a gaming or workstation GPU (e.g. RTX 3080, RTX 4090).
- **Role in the system**: Accelerates token generation for the Planning Agent. Without GPU acceleration, a 7B model on CPU would be too slow for interactive use. With a CUDA-enabled GPU, latency for a typical itinerary plan is in the range of a few seconds.
- **Versions**: MVP, Web v1.

### NVIDIA NIM (NVIDIA Inference Microservices) — Optional Production Path
- **What it is**: NVIDIA's containerized inference microservice platform that packages optimised LLMs (including open-source models like Llama 3, Mistral, etc.) as production-grade API endpoints with TensorRT-LLM optimisation and horizontal scaling.
- **Why relevant**: If the project moves off Vertex AI for LLM serving (e.g. to run a fine-tuned open-source model for accessibility-specific reasoning), NIM provides a drop-in REST API that is compatible with OpenAI-style API calls, meaning the AI gateway in the backend needs minimal changes to switch between Vertex AI (Gemini) and a NIM-hosted model.
- **Role in the system**: Alternative inference backend for specialised models. Not the primary path, but a credible production option that keeps the architecture vendor-flexible.
- **Scalability**: NIM is designed for multi-GPU, multi-node deployment with autoscaling.

---

## Open-Source and Third-Party Technologies

### llama.cpp
- **What it is**: A C++ inference runtime for GGUF-format quantised LLM models. Supports CPU and CUDA/Metal/Vulkan GPU acceleration.
- **Why chosen**: Enables fully local LLM inference without any API dependency. Critical for the MVP and Web v1 where the goal is a self-contained demo. Also provides a fallback path in Web v2+ when cloud services are unavailable.
- **Models used**: A 7B or 13B parameter instruction-following model (e.g. Llama 3 Instruct or Mistral Instruct) in GGUF Q4 or Q5 quantisation.
- **Role in the system**: Responds to structured planning prompts from the backend's `llmGateway` service. The backend calls llama.cpp's HTTP server endpoint (`/v1/chat/completions`), which is functionally compatible with the OpenAI Chat Completions API — so swapping to Gemini later requires changing only the endpoint URL and auth header.
- **Versions**: MVP, Web v1 (primary); Web v2, App v3, App Final (fallback / offline mode).

### SQLite
- **What it is**: A self-contained, serverless, zero-configuration relational database stored in a single file. The world's most widely deployed database engine.
- **Why chosen for MVP and Web v1**: SQLite requires no installation, no server process, and no connection configuration. It is embedded directly in the Node.js backend via the `better-sqlite3` driver. For a hackathon demo or local prototype, this means the entire backend — server, LLM, and database — runs from a single machine with one `npm start` command.
- **Migration path**: The SQL schema is written in standard SQL (no Postgres-specific types). When the project moves to Web v2, the same schema is applied to AlloyDB with minimal changes. The application-level DB abstraction layer (`src/db/index.ts`) is the only file that changes.
- **Limitations acknowledged**: SQLite does not support pgvector. In MVP, candidate places for the RAG pipeline are retrieved using a simple keyword filter + cosine similarity computed in Node.js over a small in-memory embedding array. This is sufficient for a few hundred seeded places.
- **Role in the system**: Stores places, user preferences, itineraries, and itinerary items.
- **Versions**: MVP, Web v1. Replaced by AlloyDB in Web v2.

### OpenRouteService
- **What it is**: An open-source routing engine based on OpenStreetMap data, with a free-tier hosted API.
- **Why chosen**: Provides walking routes and travel times without requiring a Google Maps API key during MVP development. Suitable for a hackathon demo.
- **Role in the system**: Computes routes between itinerary stops, returning GeoJSON polylines and estimated travel times.
- **Versions**: MVP, Web v1. Replaced by Google Maps Directions API in Web v2.

### Node.js + TypeScript (Backend)
- **What it is**: A non-blocking I/O runtime for server-side JavaScript, with TypeScript providing static typing.
- **Why chosen**: TypeScript enables safe contracts between services (e.g. the itinerary JSON schema is strongly typed end to end). Node.js is well-suited to the backend's role as an orchestrator: it awaits many I/O operations (LLM calls, DB queries, routing API calls) concurrently without blocking.
- **Role in the system**: The backend API server handles all HTTP requests from the frontend, orchestrates calls to the LLM gateway, RAG service, routing service, and database, and returns structured itinerary data.

### Next.js + React (Web Frontend)
- **What it is**: React is a UI component library; Next.js is a React framework providing server-side rendering, file-based routing, and API routes.
- **Why chosen**: Next.js enables fast initial page loads (important for an accessibility-focused product where users may be on mobile networks), provides a file-based routing pattern that is easy to reason about, and supports incremental static regeneration for place pages.
- **Role in the system**: Renders the chat interface, itinerary list, map view, and preferences panel.

### React Native or Flutter (Mobile — App v3+)
- **What it is**: React Native is a framework for building native mobile apps using React. Flutter is Google's cross-platform mobile UI framework.
- **Why relevant**: The mobile app needs to share as much logic as possible with the web app. React Native allows sharing API client code and business logic with the Next.js web app. Flutter is a strong alternative if richer animation or tighter native performance is needed.
- **Role in the system**: Provides the mobile interface for offline itinerary access, live location tracking, and wake word interaction.

---

## Architecture for Scalability and Real-World Deployment

### Separation of Concerns
Every component has a single responsibility and communicates through defined API contracts. The AI gateway is the only component that knows whether inference comes from Gemini or llama.cpp; the frontend only knows it gets an itinerary JSON. This makes it possible to swap the LLM backend (local → cloud → fine-tuned model) without touching the frontend.

### Local-to-Cloud Migration Path
The stack is designed in layers that can be swapped without full rewrites:

| MVP / Web v1 (Local) | Web v2+ (Cloud) | What stays the same |
|---|---|---|
| SQLite (`better-sqlite3`) | AlloyDB for PostgreSQL | SQL schema, query patterns |
| llama.cpp HTTP server | Vertex AI Gemini API | JSON prompt/response contract |
| OpenRouteService | Google Maps Directions API | GeoJSON route output format |
| In-process cosine similarity | Vertex AI Vector Search | Top-K candidate interface |

This means the MVP is not a throwaway prototype — it is a working, local version of the production architecture.

### Stateless Backend
The backend API server is stateless (all state lives in the database). This means multiple instances can run behind a load balancer without coordination, enabling horizontal scaling on Cloud Run or GKE.

### Event-Driven Analytics
All behavioural events (itinerary created, stop accepted/rejected, accessibility obstacle reported) are written to BigQuery asynchronously via a streaming insert or a Pub/Sub topic. The analytics pipeline never blocks the user-facing request.

### Accessibility as a First-Class Data Concern
Accessibility attributes are not optional metadata — they are required fields on the `places` schema from MVP onwards. This ensures that as the corpus grows, accessibility data is always present and queryable, and that the Planning Agent can always incorporate it into reasoning.
