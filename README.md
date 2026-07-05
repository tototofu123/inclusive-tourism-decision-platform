# Inclusive Tourism Decision Platform

Private hackathon project for an AI-powered decision intelligence platform that helps tourists with special physical needs plan accessible, safe, and enjoyable itineraries in Hong Kong.

## Active Version
- `version-web-v3/` — **Current web application** (Next.js + TypeScript backend)
  - Local LLM inference via llama.cpp (Qwythos, Ornith, Gemma4)
  - 482 Google Places with accessibility data
  - Dynamic model selection (Gemini, Custom, Local GGUF)
  - Itinerary planning with map visualization
  - "Use Itinerary" pinning for persistent trip plans

## Legacy Versions (Archived)
- `version-mvp-web/` — Early MVP web prototype
- `version-web-v2/` — Previous web iteration
- `version-web-v1-readme-plan/` — Planning docs

## Getting Started
```bash
# Backend (port 4000)
cd version-web-v3/backend && npx tsx src/index.ts

# Frontend (port 3000)
cd version-web-v3/frontend && npx next dev

# Local LLM (port 8081)
llama-server.exe -m Qwythos-9B-Claude-Mythos-5-1M-Q4_K_M.gguf --port 8081 -ngl 999 -c 8192 --host 0.0.0.0
```

## Demo Flow
1. Select model from dropdown (12 options: 5 Gemini, 4 Custom, 3 Local)
2. New session → "hi what can you do"
3. "family of four, two kids, limited walking, 4-day trip, 3000 HKD/day"
4. Request scenery, culture day, amusement park day
5. Arrival HKIA 12pm from Malaysia, departure 5pm to Singapore
6. "where can I see full itinerary?" → Use Itinerary button pins plan
7. Map shows 482 spots with numeric labels, filterable by date