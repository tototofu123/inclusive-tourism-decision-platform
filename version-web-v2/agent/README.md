# Agent – Web v2

This document defines the agent behaviour for Web v2.

## Cloud Agents
Web v2 introduces a multi-agent setup using Google Cloud's Agent Development Kit (ADK):

- **Route Planner Agent**
  - Uses Vertex AI + Maps data to propose optimal sequences.

- **Place Selector Agent**
  - Uses Vector Search / AlloyDB to pick places from the corpus.

- **City Insight Agent**
  - Optionally surfaces patterns for stakeholders.

## AI Gateway
- Backend calls a single AI gateway endpoint that:
  - Decides whether to use cloud agents or fall back to local llama.cpp.
  - Aggregates responses into a unified itinerary JSON.

This version formalises the agent concept and moves most intelligence into the cloud.
