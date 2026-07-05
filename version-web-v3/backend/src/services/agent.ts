import { ChatResponse } from '../types';
import { query } from '../db/client';
import { executeTool } from './tools';
import { chatCompletion } from './apiClient';
import { sanitizeInput, detectPromptInjection, detectOffTopic } from './guard';
import { getGlobalPreferences, formatGlobalPreferences } from './globalPreferencesService';

function getHKTime(): { datetime: string; weekday: string; hour: number; dateStr: string } {
  const now = new Date();
  const opts = { timeZone: 'Asia/Hong_Kong', hour12: false } as const;
  const hkStr = now.toLocaleString('en-HK', opts);
  const hkDate = new Date(hkStr);
  return {
    datetime: hkStr,
    weekday: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][hkDate.getDay()],
    hour: hkDate.getHours(),
    dateStr: hkDate.toISOString().split('T')[0],
  };
}

function getWeather(hour: number): string {
  if (hour < 6) return 'night, cool ~23°C';
  if (hour < 9) return 'sunrise, mild ~25°C';
  if (hour < 12) return 'morning, warm ~28°C';
  if (hour < 15) return 'afternoon, hot ~32°C';
  if (hour < 18) return 'late afternoon, warm ~30°C';
  if (hour < 21) return 'evening, mild ~26°C';
  return 'night, cool ~23°C';
}

const SYSTEM_PROMPT_BASE = `You are an HK accessibility travel assistant. Cover Kowloon, HK Island, New Territories.

ACCESSIBILITY FIRST: Always filter for user mobility needs. Call check_accessibility before recommending.

Tools (use native function calling):
- search_places: find places (category/region/budget)
- check_accessibility: verify wheelchair access, step-free entry, accessible toilets
- create_itinerary: build multi-day trip with stops
- get_itinerary / list_itineraries / edit_itinerary / delete_itinerary: manage trips
- route_distance: walking distance between points
- find_transport: accessible MTR/bus between locations
- get_travel_time: travel time by walking or transit
- get_place_alternatives: find similar places if inaccessible
- optimize_route: reorder stops to minimize walking
- get_bus_eta: real-time HK bus arrival for Citybus/KMB routes. Provide route + stop name to check ETA.
- set_preferences: save mobility status, interests, budget, home base. Call this FIRST when user shares personal info.
- web_search: search for real-time info like hotel facilities, weather, events, operating hours, accessibility details, travel tips, food reviews, or any current info not in our DB.

RULES:
1. If user says mobility status → call set_preferences immediately
2. For mobility needs (wheelchair, cane, elderly, with_kids, pregnant, slow, etc.) → search_places → check_accessibility → only recommend confirmed accessible
3. For itineraries → use route_distance to keep walks short, find_transport for MTR with elevators
4. Be concise. Respond in English. Only discuss HK tourism.
5. NEVER delete a confirmed/pinned itinerary. If the user asks to delete a pinned itinerary, explain that it's pinned and they can unpin it first.
6. When user says "use itinerary" or "pin this" or "fix it", confirm the itinerary — this saves it as the user's active plan so future edits build on it. Use set_preferences to save confirmed_itinerary_id.`;

export async function processChat(
  text: string,
  itineraryId?: number,
  onThink?: (step: string) => void,
  sessionId?: number,
): Promise<ChatResponse> {
  const thinkingSteps: string[] = [];
  const emit = (msg: string) => {
    thinkingSteps.push(msg);
    if (onThink) onThink(msg);
  };

  const safeText = sanitizeInput(text);
  const injectionBlock = detectPromptInjection(safeText);
  if (injectionBlock) {
    emit('Checking message...');
    return { thinking: ['Checking message...', 'Done!'], response: injectionBlock };
  }
  const offTopicBlock = detectOffTopic(safeText);
  if (offTopicBlock) {
    emit('Checking message...');
    return { thinking: ['Checking message...', 'Done!'], response: offTopicBlock };
  }
  text = safeText;

  const itinRef = text.match(/#(\d+)\b|itinerary\s*(?:#\s*)?(\d+)/i);
  if (itinRef) {
    const parsed = parseInt(itinRef[1] || itinRef[2]);
    if (!isNaN(parsed)) {
      itineraryId = parsed;
      emit(`Using itinerary #${parsed}`);
    }
  }

  emit('Loading preferences...');

  const hkTime = getHKTime();
  const weather = getWeather(hkTime.hour);

  const prefs = await getGlobalPreferences();
  const prefsStr = formatGlobalPreferences(prefs);

  let systemPrompt = SYSTEM_PROMPT_BASE;
  const ctx: string[] = [];
  ctx.push(`Time: ${hkTime.weekday} ${hkTime.hour}:00, ${hkTime.dateStr}. Weather: ${weather}.`);
  if (prefsStr) ctx.push(prefsStr);
  if (prefs.mobility && prefs.mobility !== 'none') {
    ctx.push(`User mobility: ${prefs.mobility}. Filter ALL results for this.`);
  }
  systemPrompt += `\n\nContext:\n${ctx.join(' ')}`;

  emit('Loading history...');

  const messages: any[] = [{ role: 'system', content: systemPrompt }];

  if (sessionId) {
    try {
      const hist = await query(
        'SELECT DISTINCT ON (role, content) role, content FROM session_messages WHERE session_id=$1 ORDER BY role, content, created_at LIMIT 20',
        [sessionId],
      );
      for (const row of hist.rows) {
        const role = row.role === 'assistant' ? 'assistant' : 'user';
        const content = (row.content || '').trim();
        if (content) messages.push({ role, content });
      }
    } catch { /* non-fatal */ }
  }

  messages.push({ role: 'user', content: text });

  try {
    const result = await agentLoop(messages, itineraryId, emit);
    result.thinking = [...thinkingSteps, 'Done!'];
    return result;
  } catch (err) {
    const errorMsg = (err as Error).message || '';
    console.error('LLM error:', errorMsg);

    if (errorMsg.includes('fetch') || errorMsg.includes('abort') || errorMsg.includes('connect')) {
      return {
        thinking: ['LLM connection unavailable', 'Done!'],
        response: "I'm your inclusive Hong Kong travel assistant. My AI service is temporarily unavailable — please ensure the LLM is running and try again.",
      };
    }

    return {
      thinking: ['Done!'],
      response: "I'm your inclusive Hong Kong travel assistant. I can help find accessible places, plan wheelchair-friendly itineraries, and check venue accessibility across Hong Kong.",
    };
  }
}

async function agentLoop(
  messages: any[],
  itineraryId?: number,
  emit?: (msg: string) => void,
): Promise<ChatResponse> {
  const e = (msg: string) => { if (emit) emit(msg); };
  const MAX_LOOPS = 5;
  let lastResult: Awaited<ReturnType<typeof executeTool>> | null = null;
  let accumulatedPlaces: any[] = [];
  let accumulatedItinerary: any = null;
  let loopCount = 0;

  do {
    const response = await chatCompletion(messages, undefined, { temperature: 0.1, maxTokens: 4096 });

    const toolCalls: Array<{ name: string; args: any; toolCallId?: string }> = [];
    if (response.toolCalls?.length) {
      for (const tc of response.toolCalls) {
        toolCalls.push({ name: tc.name, args: tc.args, toolCallId: tc.id });
      }
    }

    if (!toolCalls.length) {
      const content = (response.content || '').trim();
      if (content) {
        const places = accumulatedPlaces.length ? accumulatedPlaces : undefined;
        const itinerary = accumulatedItinerary?.id ? accumulatedItinerary : undefined;
        return {
          thinking: ['Done!'],
          response: content,
          places,
          itinerary,
        };
      }
      throw new Error('Empty LLM response');
    }

    const messagesWithDoc: any[] = [...messages];
    messagesWithDoc.push({
      role: 'assistant',
      content: response.content || null,
      tool_calls: response.toolCalls?.map(tc => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: JSON.stringify(tc.args) },
      })),
    });

    for (const tc of toolCalls) {
      if ((tc.name === 'edit_itinerary' || tc.name === 'get_itinerary' || tc.name === 'delete_itinerary')
        && !tc.args.itinerary_id && itineraryId) {
        tc.args.itinerary_id = itineraryId;
      }

      e(`Running: ${tc.name}...`);
      try {
        const result = await executeTool(tc.name, tc.args, e);
        lastResult = result;
        if (result.places?.length) accumulatedPlaces = result.places;
        if (result.itinerary?.id) accumulatedItinerary = result.itinerary;
        messagesWithDoc.push({
          role: 'tool',
          content: JSON.stringify({ response: result.response, places: result.places, itinerary: result.itinerary }),
          tool_call_id: tc.toolCallId || `call_${tc.name}_${Date.now()}`,
          name: tc.name,
        });
      } catch (toolErr) {
        const errMsg = `Tool ${tc.name} failed: ${(toolErr as Error).message}`;
        console.error(errMsg);
        messagesWithDoc.push({
          role: 'tool',
          content: JSON.stringify({ error: errMsg }),
          tool_call_id: tc.toolCallId || `call_${tc.name}_${Date.now()}`,
          name: tc.name,
        });
      }
    }

    if (++loopCount >= MAX_LOOPS) break;

    if (loopCount >= 3) {
      // Force stop after 3 loops — generate text response with what we have
      const toolNames = toolCalls.map(t => t.name).join(', ');
      messagesWithDoc.push({
        role: 'user',
        content: `You called: ${toolNames}. You have the data you need. Now STOP calling tools and give the user a final answer. Use the information you already collected.`,
      });
    } else {
      e(`Thinking (step ${loopCount})...`);
      messagesWithDoc.push({
        role: 'user',
        content: 'Review the tool results above. If you still need to perform other actions (such as creating an itinerary, searching for places, or checking accessibility) to fully satisfy the user\'s original request, make those tool calls now. Otherwise, provide a helpful natural-language response.',
      });
    }

    messages = messagesWithDoc;
  } while (true);

  const th = lastResult?.thinking || [];
  const finalResp = lastResult?.response || '';

  if (!finalResp || (finalResp.length < 10 && /^done\.?$/i.test(finalResp.trim()))) {
    const places = lastResult?.places?.length ? lastResult.places : accumulatedPlaces.length ? accumulatedPlaces : undefined;
    const itinerary = lastResult?.itinerary?.id ? lastResult.itinerary : accumulatedItinerary?.id ? accumulatedItinerary : undefined;
    if (places?.length) {
      const names = places.map((p: any) => p.name).join(', ');
      return {
        thinking: [...th, 'Done!'],
        response: `I found ${places.length} place(s): ${names}. You can see them on the map.`,
        places,
        itinerary,
      };
    }
    if (itinerary?.id) {
      return {
        thinking: [...th, 'Done!'],
        response: `Your itinerary #${itinerary.id} is ready with ${itinerary.stops.length} stops. Check the Itinerary tab for the full plan.`,
        itinerary,
        places,
      };
    }
    return { thinking: [...th, 'Done!'], response: 'How can I help plan your accessible Hong Kong trip?' };
  }

  const all = lastResult?.itinerary?.id
    ? (await query('SELECT id, user_text, created_at FROM itineraries ORDER BY created_at DESC LIMIT 20')).rows
    : undefined;

  return {
    thinking: [...th, 'Done!'],
    response: finalResp,
    places: lastResult?.places?.length ? lastResult.places : accumulatedPlaces.length ? accumulatedPlaces : undefined,
    itinerary: lastResult?.itinerary?.id ? lastResult.itinerary : accumulatedItinerary?.id ? accumulatedItinerary : undefined,
    allItineraries: all?.map((r: any) => ({ id: r.id, user_text: r.user_text, created_at: r.created_at, stop_count: 0 })),
  };
}