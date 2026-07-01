const API = process.env.API || 'http://localhost:4000';
let sessionId;
let passed = 0, failed = 0;

async function api(path, opts) {
  const url = `${API}${path}`;
  const init = { headers: { 'Content-Type': 'application/json' }, ...opts, signal: AbortSignal.timeout(15000) };
  const res = await fetch(url, init).catch(e => { throw new Error(`fetch(${url}): ${e.message}`); });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => '')}`);
  return res.json();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitResult(processId, timeout = 120) {
  for (let i = 0; i < timeout; i++) {
    await sleep(500);
    try {
      const status = await api(`/chat/status/${processId}`);
      if (status.done) return status;
    } catch (e) { /* poll error */ }
  }
  return null;
}

async function testTool(name, text, itinId) {
  process.stdout.write(`  [${name}] "${text}"... `);
  try {
    const start = await api('/chat', {
      method: 'POST',
      body: JSON.stringify({ text, itineraryId: itinId ?? null, sessionId }),
    });
    if (!start.processId) throw new Error('no processId');
    const result = await waitResult(start.processId, 300);
    if (!result) throw new Error('timeout');
    if (result.error) throw new Error(result.error);
    const resp = result.result?.response || result.response;
    if (!resp) throw new Error('empty response');
    const short = resp.length > 80 ? resp.slice(0, 80) + '…' : resp;
    console.log(`✓ ${short}`);
    passed++;
    return result.result;
  } catch (e) {
    console.log(`✗ ${e.message}`);
    failed++;
  }
}

async function testNoTool(name, text) {
  process.stdout.write(`  [no-tool] "${text}"... `);
  try {
    const start = await api('/chat', {
      method: 'POST',
      body: JSON.stringify({ text, itineraryId: null, sessionId }),
    });
    if (!start.processId) throw new Error('no processId');
    const result = await waitResult(start.processId, 200);
    if (!result) throw new Error('timeout');
    if (result.error) throw new Error(result.error);
    const resp = result.result?.response || result.response;
    if (!resp) throw new Error('empty response');
    const short = resp.length > 80 ? resp.slice(0, 80) + '…' : resp;
    console.log(`✓ ${short}`);
    passed++;
  } catch (e) {
    console.log(`✗ ${e.message}`);
    failed++;
  }
}

async function main() {
  console.log('=== Tool Calling Tests ===\n');

  // Create session
  try {
    const s = await api('/sessions', { method: 'POST', body: '{}' });
    sessionId = s.id;
    console.log(`Session #${sessionId} created ✓\n`);
    passed++;
  } catch (e) {
    console.log(`FAILED to create session: ${e.message}`);
    failed++;
    return;
  }

  console.log('── No tool call ──');
  await testNoTool('greeting', 'hello, what can you help me with?');
  await testNoTool('kowloon', 'tell me about kowloon');

  console.log('\n── Single tool calls ──');
  await testTool('search_places', 'find museums in kowloon');
  await testTool('create_itinerary', 'plan a 1 day trip to visit museums and parks');
  await testTool('list_itineraries', 'what itineraries do i have');
  await testTool('check_accessibility', 'is the museum of art accessible');
  await testTool('route_distance', 'how far is it from tsim sha tsui to mong kok walking');

  console.log('\n── Get / Edit itinerary ──');
  await testTool('get_itinerary', 'show me itinerary 1', 1);
  await testTool('edit_itinerary', 'remove the last stop from itinerary 1', 1);

  console.log('\n── Transport ──');
  await testTool('find_transport', 'how do i get from tsim sha tsui to diamond hill');
  await testTool('get_travel_time', 'travel time from tst to mong kok walking');

  console.log('\n── Delete / alternatives ──');
  await testTool('delete_itinerary', 'delete itinerary 99', 99);
  await testTool('get_place_alternatives', 'what else can i do instead of the art museum');

  console.log(`\n=== Results: ${passed} passed, ${failed} failed, ${passed + failed} total ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
