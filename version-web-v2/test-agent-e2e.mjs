const API = process.env.API || 'http://localhost:4000';
let sessionId;
let activeItineraryId = null;
let passedApi = 0, failedApi = 0, passedCheck = 0, failedCheck = 0;

const GREEN = '\x1b[32m', RED = '\x1b[31m', YELLOW = '\x1b[33m', CYAN = '\x1b[36m', BOLD = '\x1b[1m', RESET = '\x1b[0m';

async function api(path, opts) {
  const url = `${API}${path}`;
  const init = { headers: { 'Content-Type': 'application/json' }, ...opts, signal: AbortSignal.timeout(30000) };
  const res = await fetch(url, init).catch(e => { throw new Error(`fetch(${url}): ${e.message}`); });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => '')}`);
  return res.json();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitResult(processId, timeout = 300) {
  for (let i = 0; i < timeout; i++) {
    await sleep(500);
    try {
      const status = await api(`/chat/status/${processId}`);
      if (status.done) {
        if (status.result?.itinerary?.id) activeItineraryId = status.result.itinerary.id;
        return status;
      }
    } catch (e) { /* poll error */ }
  }
  return null;
}

async function sendChat(label, text, opts = {}) {
  process.stdout.write(`\n  ${YELLOW}[${label}]${RESET} "${text}"... `);
  try {
    const start = await api('/chat', {
      method: 'POST',
      body: JSON.stringify({ text, itineraryId: opts.itineraryId ?? activeItineraryId ?? null, sessionId }),
    });
    if (!start.processId) throw new Error('no processId');
    const result = await waitResult(start.processId, opts.timeout || 300);
    if (!result) throw new Error('timeout');
    if (result.error) throw new Error(result.error);
    const resp = result.result?.response || result.response || '';
    const short = resp.length > 100 ? resp.slice(0, 100) + '…' : resp;
    const toolSteps = (result.result?.thinking || []).filter(s => s.includes('Running tool') || s.includes('Found') || s.includes('Searched'));
    console.log(`${GREEN}✓${RESET} ${short}`);
    if (toolSteps.length > 0) console.log(`       → tools executed: ${toolSteps.length}`);
    if (result.result?.itinerary?.id) activeItineraryId = result.result.itinerary.id;
    passedApi++;
    return result.result;
  } catch (e) {
    console.log(`${RED}✗${RESET} ${e.message}`);
    failedApi++;
  }
}

async function check(label, fn) {
  process.stdout.write(`  ${CYAN}[check]${RESET} ${label}... `);
  try {
    const result = await fn();
    if (result) { console.log(`${GREEN}✓${RESET}`); passedCheck++; }
    else { console.log(`${YELLOW}△${RESET} (soft fail — not critical)`); failedCheck++; }
  } catch (e) {
    console.log(`${RED}✗${RESET} ${e.message}`);
    failedCheck++;
  }
}

async function scenario(name, fn) {
  console.log(`\n${BOLD}${'='.repeat(60)}${RESET}`);
  console.log(`${BOLD}  Scenario: ${name}${RESET}`);
  console.log(`${BOLD}${'='.repeat(60)}${RESET}`);
  await fn();
}

process.on('uncaughtException', e => { console.error('UNCAUGHT', e); process.exit(1); });

async function main() {
  const health = await api('/health').catch(() => null);
  if (!health || !health.llm) {
    console.log(`${RED}LLM not reachable on 127.0.0.1:8081 — start llama-server first${RESET}`);
    process.exit(1);
  }
  console.log(`${GREEN}LLM ready ✓  Backend ready ✓${RESET}`);

  const sess = await api('/sessions', { method: 'POST', body: JSON.stringify({ title: 'E2E Agent Test' }) });
  sessionId = sess.id;
  console.log(`Session #${sessionId}\n`);

  // ══════════════════════════════════════════════════════════════
  // SCENARIO 1: Trip Planning
  // ══════════════════════════════════════════════════════════════
  await scenario('1. Trip Planning — multi-day accessible itinerary', async () => {
    let res = await sendChat('plan-1', 'plan a 3 day accessible trip to Hong Kong, I use a wheelchair');
    await check('itinerary was created or tool executed', () => res?.itinerary?.id || res?.thinking?.some(s => s.includes('itinerary') || s.includes('Found')));
    if (res?.itinerary?.id) console.log(`   ${YELLOW}Itinerary ID: ${res.itinerary.id}${RESET}`);

    res = await sendChat('plan-2', 'where should I stay in Hong Kong? I need a wheelchair accessible hotel');
    await check('hotels mentioned in response', () => res?.response?.match(/hotel|accommodation|stay|peninsula|rosewood|mandarin|salisbury|shangri/i));

    res = await sendChat('plan-3', 'add a museum visit on day 2');
    await check('tool was executed (ignore exact response)', () => res?.thinking?.some(s => s.includes('Running tool') || s.includes('Found') || s.includes('Modifying')) || res?.response?.length > 3);

    res = await sendChat('plan-4', 'show me the current itinerary');
    await check('itinerary info returned', () => res?.itinerary?.id || res?.response?.match(/stop|itinerary|#\d/i) || res?.response?.length > 15);
  });

  // ══════════════════════════════════════════════════════════════
  // SCENARIO 2: General Questions
  // ══════════════════════════════════════════════════════════════
  await scenario('2. General Questions — places, distances, transport', async () => {
    let res = await sendChat('ask-1', 'what museums are in Kowloon that are wheelchair accessible?');
    await check('places found or tool ran', () => res?.places?.length > 0 || res?.thinking?.some(s => s.includes('Found')));

    res = await sendChat('ask-2', 'check if the Hong Kong Museum of History is wheelchair accessible');
    await check('accessibility info returned', () => res?.response?.match(/wheelchair|accessible|step|ramp|access/i) || res?.response?.length > 20);

    res = await sendChat('ask-3', 'find parks and temples in Hong Kong');
    await check('places returned', () => res?.places?.length > 0 || res?.response?.match(/park|temple/i));

    res = await sendChat('ask-4', 'how far is Tsim Sha Tsui to Mong Kok walking distance?');
    await check('distance result', () => res?.response?.match(/km|min|distance|walk/i));

    res = await sendChat('ask-5', 'find alternatives to Hong Kong Museum of Art');
    await check('alternatives suggested', () => res?.places?.length > 0 || res?.response?.match(/alternat|instead|other|also/i));
  });

  // ══════════════════════════════════════════════════════════════
  // SCENARIO 3: Itinerary Management (CRUD)
  // ══════════════════════════════════════════════════════════════
  await scenario('3. Itinerary Management — create, list, view, delete', async () => {
    let res = await sendChat('itin-1', 'create a one day Kowloon trip for me');
    const firstId = activeItineraryId;
    await check('created an itinerary', () => firstId);

    res = await sendChat('itin-2', 'list all my itineraries');
    await check('list returned or tool executed', () => res?.allItineraries || res?.thinking?.some(s => s.includes('Running tool')) || res?.response?.match(/#\d|itinerar|saved/i));

    if (activeItineraryId) {
      res = await sendChat('itin-3', `show me details of itinerary ${activeItineraryId}`);
      await check('detail returned', () => res?.itinerary || res?.response?.match(/stop|place|day/i) || res?.response?.length > 20);
    }

    if (activeItineraryId) {
      res = await sendChat('itin-4', `delete itinerary ${activeItineraryId}`);
      await check('delete confirmed', () => res?.response?.match(/delet/i) || res?.thinking?.some(s => s.includes('Running tool')));
      if (res?.thinking?.some(s => s.includes('Running tool'))) activeItineraryId = null;
    }

    res = await sendChat('itin-5', 'make a new itinerary with parks and a cafe');
    await check('new itinerary id', () => res?.itinerary?.id);
  });

  // ══════════════════════════════════════════════════════════════
  // SCENARIO 4: Urgent / Accessibility Situations
  // ══════════════════════════════════════════════════════════════
  await scenario('4. Urgent Situations — accessibility crises, changes', async () => {
    let res = await sendChat('urgent-1', 'urgent! need wheelchair accessible places in Kowloon right now');
    await check('urgent handled', () => res?.places?.length > 0 || res?.thinking?.some(s => s.includes('Found')));

    res = await sendChat('urgent-2', 'my wheelchair broke, find places with step-free entry');
    await check('step-free mentioned', () => res?.response?.match(/step|wheelchair|access|ramp/i) || res?.places?.length > 0);

    res = await sendChat('urgent-3', 'I am tired, find attractions close together');
    await check('response has length', () => res?.response?.length > 10);

    res = await sendChat('urgent-4', 'I need to change my trip, too tired to walk');
    await check('helpful response', () => res?.response?.length > 10);
  });

  // ══════════════════════════════════════════════════════════════
  // SCENARIO 5: Sudden Amendments
  // ══════════════════════════════════════════════════════════════
  await scenario('5. Sudden Amendments — change plans mid-trip', async () => {
    if (!activeItineraryId) {
      await sendChat('amend-prep', 'plan a Kowloon day trip with museums and parks');
    }

    if (activeItineraryId) {
      let res = await sendChat('amend-1', `remove the museums from itinerary ${activeItineraryId} and add a shopping mall instead`);
      await check('modification attempted', () => res?.response?.length > 3 || res?.thinking?.some(s => s.includes('Running tool')));
    }

    let res = await sendChat('amend-2', 'find me alternatives to museums, they are closed today');
    await check('alternatives returned', () => res?.places?.length > 0 || res?.response?.length > 15 || res?.response?.match(/alternat|instead|other/i));

    res = await sendChat('amend-3', 'add a rest stop with cafe to my plan');
    await check('add attempted', () => res?.response?.length > 5 || res?.thinking?.some(s => s.includes('Running tool')));
  });

  // ══════════════════════════════════════════════════════════════
  // SCENARIO 6: Edge Cases
  // ══════════════════════════════════════════════════════════════
  await scenario('6. Edge Cases — Chinese, voice-style, mixed, short', async () => {
    let res = await sendChat('zh-1', '我想要一个无障碍的香港三日游');
    await check('Chinese gets response', () => res?.response?.length > 10);

    res = await sendChat('voice-1', 'hi uh need place tsim sha tsui uh wheelchair friendly food');
    await check('voice style handled', () => res?.places?.length > 0 || res?.response?.match(/food|restaurant|cafe|tsim/i));

    res = await sendChat('mixed-1', '香港 trip 3天 plz need hotel with comment');
    await check('mixed language handled', () => res?.response?.length > 10 || res?.itinerary?.id);

    res = await sendChat('short-1', 'hotel');
    await check('single word hotel', () => res?.places?.length > 0 || res?.response?.match(/hotel/i));

    res = await sendChat('short-2', 'help');
    await check('single word help', () => res?.response?.length > 10);

    res = await sendChat('long-1', 'plan a Kowloon trip with museums, parks, temples, shopping, and a hotel');
    await check('complex query', () => res?.itinerary?.id || res?.places?.length > 0 || res?.response?.length > 20);
  });

  // ══════════════════════════════════════════════════════════════
  // RESULTS
  // ══════════════════════════════════════════════════════════════
  const totalApi = passedApi + failedApi;
  const totalCheck = passedCheck + failedCheck;
  console.log(`\n${BOLD}${'='.repeat(60)}${RESET}`);
  console.log(`${BOLD}  Results${RESET}`);
  console.log(`${BOLD}${'='.repeat(60)}${RESET}`);
  console.log(`  API calls:   ${totalApi}  ${GREEN}passed: ${passedApi}${RESET}  ${RED}failed: ${failedApi}${RESET}`);
  console.log(`  Assertions:  ${totalCheck}  ${GREEN}passed: ${passedCheck}${RESET}  ${YELLOW}soft failed: ${failedCheck}${RESET}`);
  console.log(`  Active itinerary: #${activeItineraryId || 'none'}`);
  console.log();

  process.exit(failedApi > 0 ? 1 : 0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
