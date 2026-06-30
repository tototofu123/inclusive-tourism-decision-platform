/**
 * Planner Service
 * Orchestrates: prompt build → llama.cpp call → place lookup → response format
 */
const llmGateway = require('./llmGateway');
const placesService = require('./places');

/**
 * Build the system prompt for the planning agent.
 * Keeps it short for the 3B model — longer prompts degrade quality.
 */
function buildSystemPrompt(userProfile, lang) {
  const mobilityNote = {
    wheelchair: 'The user is a wheelchair user. Avoid stairs, steep ramps, cobblestones. Require lift/ramp access.',
    slow_walk:  'The user walks slowly and tires easily. Prefer flat routes, frequent seating, short distances.',
    normal:     'No specific mobility constraint.',
  }[userProfile.mobility] || 'No specific mobility constraint.';

  const restNote = userProfile.needsRestFrequently
    ? 'Include regular rest stops with seating every 15-20 minutes.'
    : '';

  const langNote = lang === 'zh-HK' ? 'Reply in Traditional Chinese (Hong Kong).' :
                   lang === 'zh-CN' ? 'Reply in Simplified Chinese.' : 'Reply in English.';

  return [
    'You are an inclusive tourism planning assistant for Hong Kong.',
    mobilityNote,
    restNote,
    'Return a JSON object with keys: summary (string), itinerary (array of {time, place_name, description, accessibility_tags}).',
    'Keep itinerary to 3-5 stops. Be specific about accessibility features.',
    langNote,
  ].filter(Boolean).join(' ');
}

/**
 * Main entry point.
 * @returns {{ summary, itinerary, raw_llm_response }}
 */
async function generatePlan({ message, userProfile, location, lang }) {
  const systemPrompt = buildSystemPrompt(userProfile, lang);

  // Step 1: Call local LLM
  const raw = await llmGateway.chat({
    system: systemPrompt,
    user: message,
    maxTokens: 600,
    temperature: 0.4,
  });

  // Step 2: Try to parse JSON from LLM response
  let parsed = null;
  try {
    // LLM sometimes wraps JSON in markdown fences — strip them
    const jsonStr = raw.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
    parsed = JSON.parse(jsonStr);
  } catch {
    // If parse fails, return raw text as summary — graceful degradation
    parsed = { summary: raw, itinerary: [] };
  }

  // Step 3: If location provided, enrich itinerary with real DB places
  if (location && parsed.itinerary && parsed.itinerary.length > 0) {
    try {
      const nearbyPlaces = await placesService.findNearby({
        lat: location.lat,
        lng: location.lng,
        radiusMeters: 2000,
        tags: userProfile.mobility === 'wheelchair' ? ['wheelchair'] : [],
      });
      // Attach up to 3 real places as suggestions
      parsed.suggested_places = nearbyPlaces.slice(0, 3);
    } catch {
      // DB lookup failure is non-fatal for MVP
      parsed.suggested_places = [];
    }
  }

  return { ...parsed, raw_llm_response: raw };
}

module.exports = { generatePlan };
