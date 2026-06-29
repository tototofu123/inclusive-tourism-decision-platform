# Architecture – App Final

This document describes the final, production-ready architecture for the inclusive tourism decision platform.

## High-Level View
At this stage, the platform is a fully realised multi-tenant, multi-agent system deployed on Google Cloud, serving:
- Tourists and local citizens via web and mobile apps.
- Merchants via partner portals and APIs.
- City stakeholders via analytics dashboards.

## Frontends
- **Web app**:
  - Full planning, exploration, and stakeholder views.
  - Accessible UI patterns, localisation, and responsive design.
- **Mobile app**:
  - Travel-focused experience with offline support, wake word, and location.
  - Integrated with native OS features (notifications, background services).

## Backend Services
- **API Gateway**:
  - Single entry point for public and partner APIs.
  - Handles auth, rate-limiting, and routing to microservices.

- **Planning Service**:
  - Orchestrates AI agents to produce itineraries.

- **Routing Service**:
  - Wraps Google Maps and other transit APIs.

- **Merchant Insights Service**:
  - Analyses footfall, accessibility upgrades, and revenue impact.

- **City Insights Service**:
  - Aggregates anonymised route and obstacle data into bottleneck maps.

## AI and Agents
- **Vertex AI + ADK** coordinate:
  - Route Planner Agent.
  - Place Selector Agent.
  - Accessibility Scoring Agent (evaluates ramps, toilets, resting spots, etc.).
  - Merchant Advisory Agent.
  - City Insight Agent.

Agents share a common knowledge base and work over the same data graph, but have specialised prompts and policies.

## Data Layer
- **AlloyDB**:
  - Stores transactional data: users (if accounts exist), places, itineraries, merchant profiles.

- **BigQuery**:
  - Stores large-scale analytics data: aggregated route usage, accessibility gaps, merchant performance, city-level statistics.

- **Vector Store (Vertex AI Vector Search / AlloyDB)**:
  - Hosts embeddings for place descriptions, accessibility reports, reviews, and other documents.

## External Integrations
- Government open data APIs for infrastructure (elevators, barrier-free facilities, public toilets, etc.).
- Payment or booking APIs (optional) for merchant interactions.
- Notification services for alerts (weather, disruptions).

## Non-Functional Aspects
- Monitoring and logs (Cloud Logging, Cloud Monitoring).
- CI/CD pipelines with IaC (Terraform / Cloud Deployment Manager).
- Security: auth, encryption, compliance with local data rules.

This architecture makes it possible to evolve the platform into a long-term product while staying faithful to the core hackathon idea.
