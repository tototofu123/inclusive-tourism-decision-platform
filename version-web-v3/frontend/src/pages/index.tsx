import { useState, useEffect, useRef, useCallback } from 'react';
import Header from '../components/Header';
import ChatPanel from '../components/ChatPanel';
import MapPanel from '../components/MapPanel';
import ItineraryPanel from '../components/ItineraryPanel';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

type Tab = 'chat' | 'map' | 'itinerary';
interface ChatMsg {
  type: 'user' | 'bot';
  text?: string;
  thinking: string[];
  done?: boolean;
  places?: any[];
  itineraryId?: number;
  fakeUntil?: number;
}

interface ItinerarySummary { id: number; user_text: string; created_at: string; stop_count: number }
interface SessionSummary { id: number; title: string; display_title?: string; created_at: string; updated_at: string; msg_count: number }

interface ItineraryDetail {
  itinerary: { id: number; user_text: string; created_at: string };
  items: Array<{
    id: number; stop_index: number; place_name: string; label?: string;
    start_time: string; end_time: string; duration_minutes: number;
    road_distance_meters: number; lat: number; lng: number; category: string;
    day_number: number; description?: string;
    confirmed?: boolean; entry_cost?: number; transport_cost?: number; transport_mode?: string;
    route_geometry_json?: { type: string; coordinates: number[][] };
    accessibility_score?: number; accessibility_tags?: string[];
  }>;
  costSummary?: { totalTransport: number; totalEntry: number; totalAll: number };
}

export default function Home() {
  const [tab, setTab] = useState<Tab>('chat');
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPlaces, setCurrentPlaces] = useState<any[]>([]);
  const [currentItineraryId, setCurrentItineraryId] = useState<number | undefined>();
  const [itineraries, setItineraries] = useState<ItinerarySummary[]>([]);
  const [sessionId, setSessionId] = useState<number | undefined>();
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [showSessions, setShowSessions] = useState(false);
  const [showItinSwitch, setShowItinSwitch] = useState(false);
  const [storedPlaces, setStoredPlaces] = useState<any[]>([]);
  const [placesTotal, setPlacesTotal] = useState(0);
  const [detail, setDetail] = useState<ItineraryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [dayFilter, setDayFilter] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [mapRoutes, setMapRoutes] = useState<{ from: [number,number]; to: [number,number]; geometry?: any; distance: number }[]>([]);
  const msgEnd = useRef<HTMLDivElement>(null);
  const itinSwitcher = useRef<HTMLDivElement>(null);
  const sessRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const detailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [collapsedThinking, setCollapsedThinking] = useState<Set<number>>(new Set());
  const [models, setModels] = useState<string[]>([]);
  const [currentModel, setCurrentModel] = useState('');
  const [showModels, setShowModels] = useState(false);
  const [modelSwitching, setModelSwitching] = useState(false);
  const modelRef = useRef<HTMLDivElement>(null);
  const [showPrefs, setShowPrefs] = useState(false);
  const [prefs, setPrefs] = useState({ mobility: '', interests: '', budget_level: '', budget_min_hkd: '', budget_max_hkd: '', home_base: '' });
  const prefsRef = useRef<HTMLDivElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    provider: 'gemini',
    model: 'gemini-2.0-flash-001',
    customApiUrl: '',
    customApiKey: '',
  });
  const settingsRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState('');

  useEffect(() => { if (tab === 'chat') msgEnd.current?.scrollIntoView() }, [msgs, tab]);

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(''), 3000); return () => clearTimeout(t); } }, [toast]);

  useEffect(() => {
    if (sessionId) localStorage.setItem('v3_session_id', String(sessionId));
  }, [sessionId]);

  const fetchSessions = useCallback(() => {
    fetch(`${API}/sessions`).then(r => r.json()).then(setSessions).catch((e) => { console.error('Failed to fetch sessions:', e); });
  }, []);

  useEffect(() => {
    const savedSessionId = localStorage.getItem('v3_session_id');
    if (savedSessionId) {
      const sid = parseInt(savedSessionId);
      if (!isNaN(sid)) loadSession(sid);
    }
    fetch(`${API}/itineraries`).then(r => r.json()).then(d => setItineraries(d)).catch(e => { console.error('Failed to load itineraries:', e); setToast('Failed to load itineraries'); });
    fetchSessions();
    fetch(`${API}/places`).then(r => r.json()).then(d => { setStoredPlaces(d.places || []); setPlacesTotal(d.total || 0); }).catch(e => { console.error('Failed to load places:', e); setToast('Failed to load places'); });
    fetch(`${API}/models`).then(r => r.json()).then(d => { setModels(d.models || []); setCurrentModel(d.current || ''); }).catch(e => { console.error('Failed to load models:', e); });
    fetch(`${API}/settings`).then(r => r.json()).then(d => setSettings(d)).catch(e => { console.error('Failed to load settings:', e); });
  }, [fetchSessions]);

  function loadPrefs() {
    fetch(`${API}/preferences`).then(r => r.json()).then(d => {
      if (d.mobility || d.interests?.length || d.budget_level || d.home_base) {
        setPrefs({
          mobility: d.mobility || '',
          interests: (d.interests || []).join(', '),
          budget_level: d.budget_level || '',
          budget_min_hkd: d.budget_min_hkd != null ? String(d.budget_min_hkd) : '',
          budget_max_hkd: d.budget_max_hkd != null ? String(d.budget_max_hkd) : '',
          home_base: d.home_base || '',
        });
      }
    }).catch(e => { console.error('Failed to load preferences:', e); });
  }

  useEffect(() => { loadPrefs(); }, []);

  useEffect(() => {
    return () => {
      if (detailTimerRef.current) clearTimeout(detailTimerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  useEffect(() => {
    if (!detail) { setMapRoutes([]); return; }
    const routes: { from: [number,number]; to: [number,number]; geometry?: any; distance: number }[] = [];
    for (let i = 1; i < detail.items.length; i++) {
      const prev = detail.items[i-1], cur = detail.items[i];
      if (prev.lat && prev.lng && cur.lat && cur.lng) {
        routes.push({
          from: [prev.lat, prev.lng],
          to: [cur.lat, cur.lng],
          geometry: cur.route_geometry_json,
          distance: cur.road_distance_meters || 0,
        });
      }
    }
    setMapRoutes(routes);
  }, [detail]);

  async function savePrefs() {
    const data: any = {
      mobility: prefs.mobility,
      interests: prefs.interests.split(',').map(s => s.trim()).filter(Boolean),
      budget_level: prefs.budget_level,
      home_base: prefs.home_base,
    };
    if (prefs.budget_min_hkd) data.budget_min_hkd = Number(prefs.budget_min_hkd);
    if (prefs.budget_max_hkd) data.budget_max_hkd = Number(prefs.budget_max_hkd);
    await fetch(`${API}/preferences`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    setShowPrefs(false);
  }

  async function saveSettings() {
    await fetch(`${API}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    setShowSettings(false);
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (itinSwitcher.current && !itinSwitcher.current.contains(e.target as Node)) setShowItinSwitch(false);
      if (sessRef.current && !sessRef.current.contains(e.target as Node)) setShowSessions(false);
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) setShowModels(false);
      if (prefsRef.current && !prefsRef.current.contains(e.target as Node)) setShowPrefs(false);
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setShowSettings(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function fetchDetail(id: number) {
    setDetailLoading(true);
    setDetail(null);
    if (detailTimerRef.current) clearTimeout(detailTimerRef.current);
    detailTimerRef.current = setTimeout(() => setDetailLoading(false), 15000);
    fetch(`${API}/itinerary/${id}`).then(r => r.json()).then(d => {
      if (detailTimerRef.current) clearTimeout(detailTimerRef.current);
      setDetail(d);
      setDetailLoading(false);
    }).catch(e => {
      if (detailTimerRef.current) clearTimeout(detailTimerRef.current);
      setDetailLoading(false);
      console.error('Failed to load detail:', e);
    });
  }

  function loadSession(sid: number) {
    fetch(`${API}/sessions/${sid}`).then(r => r.json()).then(data => {
      setSessionId(sid);
      if (data.session) setSessionTitle(data.session.display_title || data.session.title || '');
      const loaded: ChatMsg[] = data.messages.map((m: any) => {
        if (m.role === 'user') return { type: 'user' as const, text: m.content, thinking: [] };
        return {
          type: 'bot' as const, text: m.content,
          thinking: m.thinking ? JSON.parse(m.thinking) : [],
          done: true,
          places: m.places_json, itineraryId: m.itinerary_id,
        };
      });
      setMsgs(loaded);
      const lastBot = loaded.filter(m => m.type === 'bot').reverse();
      const lastItin = lastBot.find(m => m.itineraryId);
      const lastPlaces = lastBot.find(m => m.places?.length);
      if (lastItin?.itineraryId) { setCurrentItineraryId(lastItin.itineraryId); fetchDetail(lastItin.itineraryId); }
      if (lastPlaces?.places) setCurrentPlaces(lastPlaces.places);
      setShowSessions(false);
      setShowItinSwitch(false);
      setTab('chat');
    }).catch(e => { console.error('Failed to load session:', e); setToast('Failed to load session'); });
  }

  async function send(text: string) {
    if (!text.trim() || loading) return;
    setInput('');
    const userMsg = { type: 'user' as const, text: text.trim(), thinking: [] };
    const botMsg = { type: 'bot' as const, thinking: [] as string[], done: false, fakeUntil: Date.now() + 2500 };
    setMsgs(x => [...x, userMsg, botMsg]);
    setLoading(true);

    if (abortRef.current) abortRef.current.abort();
    const abortController = new AbortController();
    abortRef.current = abortController;
    const { signal } = abortController;

    let sid = sessionId;
    if (!sid) {
      const r = await fetch(`${API}/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const d = await r.json();
      sid = d.id;
      setSessionId(sid);
    }

    let processId: string | null = null;
    try {
      // 1. Start processing — returns processId immediately
      const startRes = await fetch(`${API}/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), itineraryId: currentItineraryId ?? null, sessionId: sid }),
      });
      if (!startRes.ok) {
        const errBody = await startRes.text().catch(() => '');
        throw new Error(errBody || `HTTP ${startRes.status}`);
      }
      const startData = await startRes.json();
      processId = startData.processId;
      if (!processId) throw new Error('No processId returned');

      // 2. Poll for status updates every 200ms
      let done = false;
      while (!done) {
        await new Promise(r => setTimeout(r, 200));
        const statusRes = await fetch(`${API}/chat/status/${processId}`, { signal });
        if (!statusRes.ok) {
          done = true;
          throw new Error('Status endpoint failed');
        }
        const status = await statusRes.json();

        // Update thinking steps in real-time
        if (status.thinking?.length) {
          setMsgs(x => {
            const copy = [...x];
            const idx = copy.length - 1;
            if (idx >= 0 && copy[idx].type === 'bot') {
              copy[idx] = { ...copy[idx], thinking: [...status.thinking] };
            }
            return copy;
          });
        }

        if (status.done) {
          done = true;
          const result = status.result;
          const error = status.error;

          if (error) throw new Error(error);
          if (!result) throw new Error('No result returned');

          const places = result.places || [];
          setCurrentPlaces(places);
          if (result.itinerary?.id) setCurrentItineraryId(result.itinerary.id);

          setMsgs(x => {
            const copy = [...x];
            const idx = copy.length - 1;
            if (idx >= 0 && copy[idx].type === 'bot') {
              copy[idx] = {
                ...copy[idx],
                text: result.response,
                thinking: status.thinking || [],
                done: true,
              
                places,
                itineraryId: result.itinerary?.id,
              };
            }
            return copy;
          });

          if (result.allItineraries) setItineraries(result.allItineraries);
          if (result.itinerary?.id) fetchDetail(result.itinerary.id);

          if (result.sessionTitle && !sessionTitle) {
            setSessionTitle(result.sessionTitle);
          }

          fetch(`${API}/places`).then(r => r.json()).then(d => { setStoredPlaces(d.places || []); setPlacesTotal(d.total || 0); }).catch(e => console.error('Refresh places failed:', e));
          fetchSessions();
        }
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      const errMsg = (e as Error).message;
      setMsgs(x => {
        const copy = [...x];
        const idx = copy.length - 1;
        if (idx >= 0 && copy[idx].type === 'bot') {
          copy[idx] = { ...copy[idx], text: `Error: ${errMsg}`, thinking: ['Error'], done: true };
        }
        return copy;
      });
    } finally { setLoading(false); }
  }

  function switchItinerary(id: number) {
    setCurrentItineraryId(id);
    setShowItinSwitch(false);
    fetchDetail(id);
    fetch(`${API}/itinerary/${id}`).then(r => r.json()).then(d => {
      const pts = d.items.map((i: any) => ({ name: i.place_name, lat: i.lat, lng: i.lng, category: i.category, day: i.day_number || 1 }));
      setCurrentPlaces(pts);
    }).catch(e => console.error('Switch itinerary fetch failed:', e));
  }

  async function confirmItinerary(id: number) {
    await fetch(`${API}/itinerary/${id}/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId }) });
    fetchDetail(id);
  }

  async function unlockItinerary(id: number) {
    await fetch(`${API}/itinerary/${id}/unlock`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId }) });
    fetchDetail(id);
  }

  async function switchModel(model: string) {
    setModelSwitching(true);
    setShowModels(false);
    try {
      const res = await fetch(`${API}/models/switch`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model }),
      });
      const d = await res.json();
      if (d.status === 'switching') {
        setCurrentModel(model);
        // Poll until server is back
        for (let i = 0; i < 60; i++) {
          await new Promise(r => setTimeout(r, 2000));
          try {
            const h = await fetch(`${API}/health`);
            if (h.ok) { setModelSwitching(false); break; }
          } catch { /* still down */ }
        }
      }
    } catch { setModelSwitching(false); }
  }

  function newSession() {
    setSessionId(undefined);
    setSessionTitle('');
    setMsgs([]);
    setCurrentPlaces([]);
    setCurrentItineraryId(undefined);
    setShowItinSwitch(false);
    setShowSessions(false);
    setDetail(null);
    setDayFilter(null);
  }

  function fmtDist(m: number): string {
    if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
    return `${m} m`;
  }
  function walkTime(m: number, mobility?: string): string {
    const speedMap: Record<string, number> = { wheelchair: 40, cane: 48, slow: 32, elderly: 36, with_kids: 40, pregnant: 40, hearing_impaired: 72, visually_impaired: 56, other_needs: 48 };
    const speed = (mobility && speedMap[mobility]) || 80;
    const min = Math.round(m / speed);
    if (min >= 60) return `${Math.floor(min / 60)}h ${min % 60}m`;
    return `${min} min`;
  }

  const hasNoItinerary = !currentItineraryId && currentPlaces.length === 0;

  return (
    <div className="app">
      {toast && <div role="alert" style={{ position: 'fixed', top: 8, left: '50%', transform: 'translateX(-50%)', background: '#e74c3c', color: 'white', padding: '8px 16px', borderRadius: 8, fontSize: '.85rem', zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,.3)' }}>{toast}</div>}

      <Header
        tab={tab}
        sessionTitle={sessionTitle}
        prefs={prefs}
        showSessions={showSessions} sessions={sessions} loadSession={loadSession} newSession={newSession} setShowSessions={setShowSessions} sessRef={sessRef}
        showPrefs={showPrefs} setShowPrefs={setShowPrefs} setPrefs={setPrefs} savePrefs={savePrefs} prefsRef={prefsRef}
        showSettings={showSettings} setShowSettings={setShowSettings} settings={settings} setSettings={setSettings} saveSettings={saveSettings} settingsRef={settingsRef}
        showModels={showModels} models={models} currentModel={currentModel} modelSwitching={modelSwitching} switchModel={switchModel} setShowModels={setShowModels} modelRef={modelRef}
        showItinSwitch={showItinSwitch} itineraries={itineraries} currentItineraryId={currentItineraryId} switchItinerary={switchItinerary} setShowItinSwitch={setShowItinSwitch} itinSwitcher={itinSwitcher}
      />

      <div className="content">
        <div className={`tab-content chat-tab ${tab === 'chat' ? 'active' : ''}`}>
          <ChatPanel
            msgs={msgs} loading={loading} input={input} setInput={setInput} send={send}
            collapsedThinking={collapsedThinking} setCollapsedThinking={setCollapsedThinking} msgEnd={msgEnd}
            detail={detail} currentItineraryId={currentItineraryId} fetchDetail={fetchDetail}
            setTab={setTab} setCurrentPlaces={setCurrentPlaces} setDayFilter={setDayFilter}
          />
        </div>

        <div className={`tab-content map-tab ${tab === 'map' ? 'active' : ''}`}>
          <MapPanel
            tab={tab} categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter}
            dayFilter={dayFilter} setDayFilter={setDayFilter}
            detail={detail} hasNoItinerary={hasNoItinerary}
            storedPlaces={storedPlaces} currentPlaces={currentPlaces} mapRoutes={mapRoutes}
          />
        </div>

        <div className={`tab-content itinerary-tab ${tab === 'itinerary' ? 'active' : ''}`}>
          <ItineraryPanel
            detailLoading={detailLoading} detail={detail} currentItineraryId={currentItineraryId}
            confirmItinerary={confirmItinerary} unlockItinerary={unlockItinerary}
            setCurrentPlaces={setCurrentPlaces} setDayFilter={setDayFilter} setTab={setTab}
            walkTime={walkTime} fmtDist={fmtDist}
          />
        </div>
      </div>

      <div className="tabs">
        <button aria-label="Chat tab" className={`tab ${tab === 'chat' ? 'active' : ''}`} onClick={() => setTab('chat')}>Chat</button>
        <button aria-label="Map tab" className={`tab ${tab === 'map' ? 'active' : ''}`} onClick={() => setTab('map')}>Map</button>
        <button aria-label="Itinerary tab" className={`tab ${tab === 'itinerary' ? 'active' : ''}`} onClick={() => { if (!detail && currentItineraryId) fetchDetail(currentItineraryId); setTab('itinerary'); }}>Itinerary</button>
      </div>
    </div>
  );
}
