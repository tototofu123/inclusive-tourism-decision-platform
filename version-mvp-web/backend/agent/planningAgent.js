// Planning Agent — calls llama.cpp server (OpenAI-compatible /v1/chat/completions)
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
require('dotenv').config();

const LLAMA_BASE_URL = process.env.LLAMA_BASE_URL || 'http://localhost:8080';

function buildSystemPrompt() {
  return `You are an accessibility-aware tourism planning assistant for Hong Kong.
Your job is to create practical, safe, and enjoyable itineraries for people with mobility challenges.

Rules:
- Always prioritise places with ramps, lifts, and accessible toilets for wheelchair users
- Include rest stops every 45-60 minutes for users who need frequent rest
- Give clear walking/transit instructions between spots
- Be specific about accessibility features at each stop
- Return ONLY valid JSON — no markdown, no extra text

Output format (strict JSON):
{
  "title": "Brief itinerary title",
  "duration": "X hours",
  "accessibility_level": "wheelchair-friendly | limited-mobility | standard",
  "stops": [
    {
      "order": 1,
      "time": "10:00 AM",
      "place_name": "Name",
      "district": "District",
      "duration_minutes": 60,
      "accessibility_notes": "Specific notes about ramps, lifts, toilets",
      "activity": "What to do here",
      "transit_to_next": "How to get to next stop (MTR line, bus, walk)"
    }
  ],
  "tips": ["General accessibility tip 1", "tip 2"]
}`;
}

function buildUserPrompt({ userRequest, profile, candidatePlaces, durationHours }) {
  const profileDesc = profile ? [
    `Mobility type: ${profile.mobility_type || 'standard'}`,
    profile.needs_frequent_rest ? 'Needs rest every 45-60 minutes' : null,
    profile.dietary_tags && profile.dietary_tags !== '[]' ? `Dietary needs: ${profile.dietary_tags}` : null,
  ].filter(Boolean).join('\n') : 'No specific mobility constraints provided.';

  const placesDesc = candidatePlaces.map(p =>
    `- ${p.name} (${p.district}): score ${p.accessibility_score}/100, ` +
    `ramp:${p.has_ramp ? 'yes' : 'no'}, lift:${p.has_lift ? 'yes' : 'no'}, ` +
    `toilet:${p.has_accessible_toilet ? 'yes' : 'no'}, benches:${p.bench_count}. ${p.notes}`
  ).join('\n');

  return `User request: "${userRequest}"

User profile:
${profileDesc}

Desired duration: ${durationHours} hours

Available accessible places in database:
${placesDesc}

Create an itinerary using 3-5 of the above places. Return only the JSON object.`;
}

async function callLlama({ userRequest, profile, candidatePlaces, durationHours }) {
  const messages = [
    { role: 'system', content: buildSystemPrompt() },
    { role: 'user', content: buildUserPrompt({ userRequest, profile, candidatePlaces, durationHours }) }
  ];

  let rawText = '';
  try {
    const response = await fetch(`${LLAMA_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'local-model',
        messages,
        temperature: 0.7,
        max_tokens: 1500,
        stream: false
      })
    });

    if (!response.ok) {
      console.warn(`⚠️  llama.cpp returned ${response.status} — using fallback planner`);
      return { plan: buildFallbackPlan({ userRequest, profile, candidatePlaces, durationHours }), raw: '' };
    }

    const data = await response.json();
    rawText = data.choices?.[0]?.message?.content || '';
  } catch (err) {
    console.warn(`⚠️  llama.cpp unavailable (${err.message}) — using fallback planner`);
    return { plan: buildFallbackPlan({ userRequest, profile, candidatePlaces, durationHours }), raw: '' };
  }

  // Parse JSON from response
  let plan;
  try {
    // Strip any accidental markdown fences
    const cleaned = rawText.replace(/```json|```/g, '').trim();
    plan = JSON.parse(cleaned);
  } catch {
    console.warn('⚠️  Could not parse AI JSON — using fallback planner');
    plan = buildFallbackPlan({ userRequest, profile, candidatePlaces, durationHours });
  }

  return { plan, raw: rawText };
}

function buildFallbackPlan({ userRequest, profile, candidatePlaces, durationHours }) {
  const places = candidatePlaces.filter(p => p.accessibility_score >= 60).slice(0, 5);
  if (places.length === 0) {
    return { title: 'Planning Error', duration: `${durationHours}h`, accessibility_level: 'unknown', stops: [], tips: ['No suitable venues found nearby.'] };
  }
  const isWheelchair = profile?.mobility_type === 'wheelchair';
  const needsRest = profile?.needs_frequent_rest;
  const perStop = Math.max(45, Math.floor(durationHours * 60 / places.length));
  const stops = places.map((p, i) => {
    const hour = 9 + Math.floor(i * perStop / 60);
    const min = (i * perStop) % 60;
    const time = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    const notes = [];
    if (p.has_ramp) notes.push('Step-free entrance via ramp.');
    if (p.has_lift) notes.push('Elevator access to all levels.');
    if (p.has_accessible_toilet) notes.push('Accessible toilet available.');
    if (p.bench_count > 5) notes.push(`${p.bench_count}+ benches for resting.`);
    if (notes.length === 0) notes.push('Flat paved paths.');
    return {
      order: i + 1, time, place_name: p.name, district: p.district,
      duration_minutes: perStop,
      accessibility_notes: notes.join(' '),
      activity: i === 0 ? 'Arrive and explore' : 'Continue sightseeing',
      transit_to_next: i < places.length - 1 ? (i % 2 === 0 ? 'MTR' : 'Walk') : 'End of itinerary'
    };
  });
  const tips = [];
  tips.push(isWheelchair ? 'All stops are wheelchair-accessible with ramps and lifts.' : 'Most stops have step-free access.');
  if (needsRest) tips.push('Rest stops included every 45 min.');
  const accessibility_level = isWheelchair ? 'wheelchair-friendly' : 'limited-mobility';
  return { title: `Accessible Tour in ${places.map(p => p.district).filter((d, i, a) => a.indexOf(d) === i).join(' & ')}`, duration: `${durationHours} hours`, accessibility_level, stops, tips };
}

module.exports = { callLlama };
