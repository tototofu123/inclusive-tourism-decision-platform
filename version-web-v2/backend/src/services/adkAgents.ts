import { chatCompletion } from './apiClient';
import { queryCandidatePlaces } from './cloudRag';
import { getDirections } from './mapsDirections';
import type { ItineraryRequest, ItineraryItem } from './cloudAiGateway';

const MODEL = process.env.VERTEX_MODEL || 'Qwythos-9B-Claude-Mythos-5-1M-Q4_K_M.gguf';

interface RawPlace {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  accessibilityTags: string[];
}

async function runPlaceSelector(req: ItineraryRequest): Promise<RawPlace[]> {
  const candidates = await queryCandidatePlaces({
    query: req.userQuery,
    mobilityTags: req.userProfile.mobilityTags,
    location: req.location,
    topK: 20,
  });

  const prompt = [
    `You are a Place Selector agent for accessible tourism in ${req.location}.`,
    `User mobility constraints: ${req.userProfile.mobilityTags.join(', ')}.`,
    `Trip duration: ${req.durationHours} hours.`,
    `From the candidates below, select the best ${Math.min(req.durationHours * 2, 8)} places.`,
    `Return a JSON array of objects with fields: placeId, name, address. No markdown, no code fences.`,
    `Candidates: ${JSON.stringify(candidates.map(c => ({ placeId: c.placeId, name: c.name, address: c.address })))}`,
  ].join('\n');

  const resp = await chatCompletion([
    { role: 'system', content: 'You are a helpful travel planning assistant. Return only valid JSON.' },
    { role: 'user', content: prompt },
  ]);

  let selected: any[];
  try {
    selected = JSON.parse(resp.content.replace(/```json|```/g, '').trim());
  } catch {
    selected = candidates.slice(0, Math.min(req.durationHours * 2, 8));
  }

  return selected.map((s: any) => {
    const match = candidates.find(c => c.placeId === s.placeId || c.name === s.name);
    return match || { placeId: s.placeId || '0', name: s.name || 'Unknown', address: s.address || '', lat: 0, lng: 0, accessibilityTags: [] };
  });
}

async function runRoutePlanner(places: RawPlace[], req: ItineraryRequest): Promise<ItineraryItem[]> {
  const withDirections = await Promise.all(
    places.map(async (p, i) => {
      const next = places[i + 1];
      const directions = next
        ? await getDirections({
            origin: p.name, destination: next.name, mode: 'walking',
            originLat: p.lat, originLng: p.lng,
            destLat: next.lat, destLng: next.lng,
          })
        : null;
      return { ...p, directions, durationMins: 45 };
    })
  );

  let minutesFromStart = 0;
  return withDirections.map((p) => {
    const hours = Math.floor(minutesFromStart / 60) + 9;
    const mins = minutesFromStart % 60;
    const arrivalTime = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    minutesFromStart += p.durationMins + (p.directions?.duration_mins ?? 10);
    return {
      placeId: p.placeId,
      name: p.name,
      address: p.address,
      accessibilityTags: p.accessibilityTags,
      arrivalTime,
      durationMins: p.durationMins,
      directions: p.directions || undefined,
    };
  });
}

async function runCityInsight(items: ItineraryItem[]): Promise<ItineraryItem[]> {
  const prompt = [
    'You are a City Insight agent. Enrich each place with practical accessibility notes.',
    'Add a "notes" field (1 sentence per place) describing accessibility features.',
    `User mobility constraints are available.`,
    'Return the same JSON array with a "notes" field added to each object. No markdown, no code fences.',
    JSON.stringify(items.map(i => ({ placeId: i.placeId, name: i.name, address: i.address, arrivalTime: i.arrivalTime, durationMins: i.durationMins }))),
  ].join('\n');

  const resp = await chatCompletion([
    { role: 'system', content: 'You are a helpful travel planning assistant. Return only valid JSON.' },
    { role: 'user', content: prompt },
  ]);

  try {
    const enriched = JSON.parse(resp.content.replace(/```json|```/g, '').trim());
    return items.map((item, i) => ({ ...item, notes: enriched[i]?.notes || '' }));
  } catch {
    return items;
  }
}

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
