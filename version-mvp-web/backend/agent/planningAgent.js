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
    const err = await response.text();
    throw new Error(`llama.cpp server error: ${response.status} — ${err}`);
  }

  const data = await response.json();
  const rawText = data.choices?.[0]?.message?.content || '';

  // Parse JSON from response
  let plan;
  try {
    // Strip any accidental markdown fences
    const cleaned = rawText.replace(/```json|```/g, '').trim();
    plan = JSON.parse(cleaned);
  } catch {
    // Fallback: return raw text wrapped in a basic structure
    console.warn('⚠️  Could not parse AI JSON — returning raw response');
    plan = {
      title: 'Generated Itinerary',
      duration: `${durationHours} hours`,
      accessibility_level: 'unknown',
      stops: [],
      raw_text: rawText,
      parse_error: true
    };
  }

  return { plan, raw: rawText };
}

module.exports = { callLlama };
