# Web v2 Version

This folder contains specifications for the second web iteration.

## Guide
- Migrate AI and RAG to Google Cloud (Vertex AI, Vector Search, BigQuery, ADK).
- Introduce Google Maps API for routing.

## Agent
- Cloud-based agents orchestrated via ADK.

## Flow
- Backend AI gateway decides between Vertex AI (primary) and local LLM (fallback).

## Files Needed
- Cloud integration configs.
- Updated AI gateway service.

## Architecture
- Web UI → Backend → Google Cloud AI/RAG + Maps → DB.
