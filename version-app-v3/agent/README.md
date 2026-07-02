# Agent – App v3

This document describes agents used in App v3.

## On-Device Helper (Optional)
- Lightweight LLM (small model) for:
  - Local paraphrasing.
  - Simple Q&A when offline.

## Backend Agents
- Same cloud agents as Web v2, now serving both web and mobile.

Wake-word detection is handled by native mobile modules, not by LLM.
