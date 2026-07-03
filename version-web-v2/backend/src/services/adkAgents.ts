/**
 * adkAgents.ts
 *
 * Orchestrates three ADK agents in sequence:
 *   1. PlaceSelector  — retrieves candidate places via cloudRag (Vector Search)
 *   2. RoutePlanner   — orders places + fetches directions via Google Maps
 *   3. CityInsight    — enriches each place with accessibility context
 *
 * Each agent is a structured Vertex AI call with a defined input/output schema.
 * The ADK session ties them together with shared state.
 */

import { VertexAI } from '@google-cloud/vertexai';
import { queryCandidatePlaces } from './cloudRag';
import { getDirections } from './mapsDirections';
import type { ItineraryRequest, ItineraryItem } from './cloudAiGateway';

const PROJECT = process.env.VERTEX_PROJECT_ID!;
const LOCATION = process.env.VERTEX_LOCATION || 'us-central1';
const MODEL = process.env.VERTEX_MODEL || 'gemini-2.0-flash';

let _vertex: VertexAI | null = null;
function getVertex() {
  if (_vertex) return _vertex;
  try {
    _vertex = new VertexAI({ project: PROJECT, location: LOCATION });
  } catch {
    return null;
  }
  return _vertex;
}

// ─── Agent 1: Place Selector ─────────────────────────────────────────────────
async function runPlaceSelector(
  req: ItineraryRequest
): Promise<{ placeId: string; name: string; address: string; accessibilityTags: string[] }[]> {
  // Step 1: RAG — pull top-K candidates from Vector Search / AlloyDB
  const candidates = await queryCandidatePlaces({
    query: req.userQuery,
    mobilityTags: req.userProfile.mobilityTags,
    location: req.location,
    topK: 20,
  });

  // Step 2: Gemini re-ranks and selects best fit for duration
  const vertex = getVertex();
  if (!vertex) throw new Error('Vertex AI not configured — set VERTEX_PROJECT_ID and GOOGLE_APPLICATION_CREDENTIALS');
  const model = vertex.preview.getGenerativeModel({ model: MODEL });
  const prompt = [
    `You are a Place Selector agent for accessible tourism in ${req.location}.`,
    `User mobility constraints: ${req.userProfile.mobilityTags.join(', ')}.`,
    `Trip duration: ${req.durationHours} hours.`,
    `From the candidates below, select the best ${Math.min(req.durationHours * 2, 8)} places.`,
    `Return JSON array: [{placeId, name, address, accessibilityTags}]`,
    `Candidates: ${JSON.stringify(candidates)}`,
  ].join('\n');

  const resp = await model.generateContent(prompt);
  const text = resp.response.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

// ─── Agent 2: Route Planner ──────────────────────────────────────────────────
async function runRoutePlanner(
  places: Awaited<ReturnType<typeof runPlaceSelector>>,
  req: ItineraryRequest
): Promise<ItineraryItem[]> {
  // Get walking/transit directions between consecutive places
  const withDirections = await Promise.all(
    places.map(async (p, i) => {
      const next = places[i + 1];
      const directions = next
        ? await getDirections({ origin: p.address, destination: next.address, mode: 'walking' })
        : null;
      return { ...p, directions, durationMins: 45 }; // default 45min per stop
    })
  );

  // Calculate arrival times from a 9:00 AM start
  let minutesFromStart = 0;
  return withDirections.map((p) => {
    const hours = Math.floor(minutesFromStart / 60) + 9;
    const mins = minutesFromStart % 60;
    const arrivalTime = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    minutesFromStart += p.durationMins + (p.directions?.duration_mins ?? 10);
    return { ...p, arrivalTime };
  });
}

// ─── Agent 3: City Insight ───────────────────────────────────────────────────
async function runCityInsight(items: ItineraryItem[]): Promise<ItineraryItem[]> {
  const vertex = getVertex();
  if (!vertex) throw new Error('Vertex AI not configured — set VERTEX_PROJECT_ID and GOOGLE_APPLICATION_CREDENTIALS');
  const model = vertex.preview.getGenerativeModel({ model: MODEL });
  const prompt = [
    'You are a City Insight agent. Enrich each place with practical accessibility notes.',
    'Add a "notes" field (1 sentence) per place. Return the same JSON array with notes added.',
    JSON.stringify(items),
  ].join('\n');

  const resp = await model.generateContent(prompt);
  const text = resp.response.candidates?.[0]?.content?.parts?.[0]?.text ?? JSON.stringify(items);
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

// ─── Main ADK pipeline ───────────────────────────────────────────────────────
export async function runAdkPipeline(req: ItineraryRequest): Promise<ItineraryItem[]> {
  console.log('  [adk] PlaceSelector start');
  const places = await runPlaceSelector(req);
  console.log(`  [adk] PlaceSelector → ${places.length} places`);

  console.log('  [adk] RoutePlanner start');
  const routed = await runRoutePlanner(places, req);
  console.log('  [adk] RoutePlanner done');

  console.log('  [adk] CityInsight start');
  const enriched = await runCityInsight(routed);
  console.log('  [adk] CityInsight done');

  return enriched;
}
