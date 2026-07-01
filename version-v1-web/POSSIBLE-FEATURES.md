# Possible Features (V2+)

> Considerations after completing V1. Not planned for current iteration.

---

## Performance & Scalability

### Caching
- **Overpass/Nominatim results**: Cache place resolution results in Redis or a local cache table to avoid repeated API calls for the same queries
- **OSRM routes**: Cache walking routes (start→end coordinate pairs) — routes don't change frequently
- **LLM responses**: Cache common or repeated queries (greetings, general info) to reduce LLM latency
- **Frontend assets**: PWA service worker for offline-capable map tiles and cached place data

### Concurrency & User Count
- Request queue with priority for LLM calls (chat requests > background tasks)
- Connection pooling tuning for pg.Pool (current: default 10)
- Rate limiting middleware (express-rate-limit) per IP and per endpoint
- Background job queue for non-urgent tasks (place resolution, accessibility queries)

### Algorithm Improvements
- **Route optimization**: Replace greedy nearest-neighbor with 2-opt or Lin–Kernighan heuristic for better TSP solutions
- **Place recommendation**: Content-based or lightweight collaborative filtering instead of random alternative selection
- **Day assignment**: Constraint-based scheduling (opening hours, meal times, travel times between stops)

---

## Security

### API Key Management
- Environment-variable based API keys for LLM providers (OpenAI, Anthropic, etc.)
- Key rotation support
- `.env` files in `.gitignore` (already done for frontend `.env.local`)

### Input Validation
- Zod schemas for all request bodies
- SQL injection prevention (parameterized queries — already done via pg)
- XSS prevention (markdown rendering sanitization — `dangerouslySetInnerHTML` needs DOMPurify)

### Authentication & Authorization
- Session-based or JWT auth for multi-user support
- Rate limiting per user/session
- Admin endpoints for model management, data curation

---

## Data Quality

### Place Data
- Curated place database with verified coordinates, categories, descriptions
- Opening hours, contact info, website links
- Photo/image URLs per place
- User-submitted corrections and additions

### Accessibility Data
- More detailed accessibility information (step-free paths, accessible restrooms, audio guides)
- User-submitted accessibility reviews
- Integration with wheelchair routing (e.g., OpenSidewalks)

### Itinerary Validation
- Opening hours validation (don't plan a 9 AM visit to a museum that opens at 10)
- Realistic walking/transit times with traffic considerations
- Meal break scheduling
- Weather-aware recommendations

---

## Architecture

### Database
- Migration to PostGIS for spatial queries (radius search, nearest neighbor)
- Read replicas for high-traffic scenarios
- Connection pooling with PgBouncer

### LLM Integration
- Multiple provider support (OpenAI, Anthropic, Google, local) via unified interface
- Fallback chain (primary → secondary → local)
- Streaming responses (SSE) for real-time token-by-token output
- Token usage tracking and cost estimation

### Frontend
- State management (Zustand or Redux) for complex state
- React Query for server state caching
- Progressive Web App (offline support)
- Accessibility audit (WCAG 2.1 AA compliance)
- i18n for multi-language support (Chinese, English)

### Monitoring
- Structured logging (pino or winston)
- Error tracking (Sentry)
- Performance metrics (response times, LLM latency, API call counts)
- Health check dashboard

---

## User Experience

- User preference profiles (mobility level, dietary tags, rest frequency)
- Social sharing of itineraries
- Export to PDF/calendar
- Voice input for accessibility
- Offline mode with cached place data
- Dark mode / high contrast theme
