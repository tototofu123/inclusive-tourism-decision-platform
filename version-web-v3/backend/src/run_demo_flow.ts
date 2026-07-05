import { query } from './db/client';

const API = 'http://localhost:4000';

const STEPS = [
  'hi what can you do',
  'i am a family of four i have two kids and i cant walk that much',
  'i plan on a four day trip',
  'i have enough budget around 3000 hkd per day including transport and food and hotel fee',
  'any other recommendations?',
  'ok lets go with this hotel, what facilities does it include',
  'i want to go to some spots that cna view good scenery, also i want one day is excploring the local culture in hong kong, and one day is like go to amusement park',
  'i will arrive at hong kong airport at atound 12 noon from malaysia',
  'and last day i will have a 5pm flight back to singapore',
  'any thing i need to prepare before going to hong kong?',
  'where can i see the full itinerary?'
];

async function run() {
  console.log('=== STARTING DEMONSTRATION FLOW SIMULATION ===');
  
  // 1. Create a new session
  const sessRes = await fetch(`${API}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Demo Flow Session Correct' }),
  });
  const session = await sessRes.json();
  const sessionId = session.id;
  console.log(`Created Session ID: ${sessionId}`);

  let currentItineraryId: number | null = null;

  // 2. Loop and send messages
  for (let i = 0; i < STEPS.length; i++) {
    const text = STEPS[i];
    console.log(`\n[Step ${i + 1}/${STEPS.length}] User: "${text}"`);

    // Check if we need to mock "Use Itinerary" action for Step 6/7
    if (i === 6 && currentItineraryId) {
      console.log(`Simulating 'Use Itinerary' click for Itinerary #${currentItineraryId}...`);
      await fetch(`${API}/itinerary/${currentItineraryId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
    }

    const startRes = await fetch(`${API}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, itineraryId: currentItineraryId, sessionId }),
    });

    if (!startRes.ok) {
      console.error(`Chat failed: ${startRes.statusText}`);
      continue;
    }

    const startData = await startRes.json();
    const processId = startData.processId;

    // Poll status
    let done = false;
    let lastResponse = '';
    while (!done) {
      await new Promise(r => setTimeout(r, 500));
      const statusRes = await fetch(`${API}/chat/status/${processId}`);
      if (!statusRes.ok) {
        console.error('Failed to get status');
        break;
      }
      const status = await statusRes.json();
      done = status.done;
      lastResponse = status.response || '';
      if (status.itinerary?.id) {
        currentItineraryId = status.itinerary.id;
      }
      if (status.thinking && status.thinking.length > 0) {
        process.stdout.write('.');
      }
    }
    console.log('\nBot response received.');
  }

  console.log('\n=== DEMONSTRATION FLOW COMPLETED ===');
  console.log(`To see this conversation in the app:`);
  console.log(`1. Open http://localhost:3000 in your browser.`);
  console.log(`2. Click the 'Sessions' button in the top header.`);
  console.log(`3. Select 'Demo Flow Session Correct' (Session #${sessionId}).`);
  process.exit(0);
}

run().catch(e => {
  console.error('Flow failed:', e);
  process.exit(1);
});
