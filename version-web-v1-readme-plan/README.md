# Web v1 Version

This folder contains specifications for the first web iteration.

## Guide
- Build on web MVP and add preference profiles and stronger RAG over local place metadata.

## Agent
- Planning agent now aware of user preferences and RAG context.

## Flow
- User optionally sets preferences (walking speed, categories, etc.).
- Chat flow same as MVP but backend enriches candidate places via RAG.

## Files Needed
- Preference UI components.
- RAG query and embedding pipeline.

## Architecture
- Same stack as MVP, plus preference store and pgvector-backed RAG.
