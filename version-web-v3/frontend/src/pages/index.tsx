import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';

const MapView = dynamic(() => import('../components/MapView'), { ssr: false });
const API = process.env.NEXT_PUBLIC_API_URL || '/api';

// Simple markdown → HTML converter (safe: LLM output only)
function md(s: string): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n/g, '<br>');
}

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
  const [prefs, setPrefs] = useState({ mobility: '', interests: '', budget_level: '', home_base: '' });
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
        setPrefs({ mobility: d.mobility || '', interests: (d.interests || []).join(', '), budget_level: d.budget_level || '', home_base: d.home_base || '' });
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
    const data = {
      mobility: prefs.mobility,
      interests: prefs.interests.split(',').map(s => s.trim()).filter(Boolean),
      budget_level: prefs.budget_level,
      home_base: prefs.home_base,
    };
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
    const speedMap: Record<string, number> = { wheelchair: 40, cane: 48, slow: 32, hearing_impaired: 72, visually_impaired: 56 };
    const speed = (mobility && speedMap[mobility]) || 80;
    const min = Math.round(m / speed);
    if (min >= 60) return `${Math.floor(min / 60)}h ${min % 60}m`;
    return `${min} min`;
  }

  function daysFromItems(items: ItineraryDetail['items']): number[] {
    const days = new Set(items.map(i => i.day_number || 1));
    return Array.from(days).sort((a, b) => a - b);
  }

  const hasNoItinerary = !currentItineraryId && currentPlaces.length === 0;

  return (
    <div className="app">
      {toast && <div role="alert" style={{ position: 'fixed', top: 8, left: '50%', transform: 'translateX(-50%)', background: '#e74c3c', color: 'white', padding: '8px 16px', borderRadius: 8, fontSize: '.85rem', zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,.3)' }}>{toast}</div>}
      <div className="header">
        <div className="header-left">
          <h1>{sessionTitle || 'Inclusive Tourism'}</h1>
          {(prefs.mobility || prefs.interests || prefs.budget_level || prefs.home_base) && (
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {prefs.mobility && <span className="pref-badge">♿ {prefs.mobility}</span>}
              {prefs.budget_level && <span className="pref-badge">💰 {prefs.budget_level}</span>}
              {prefs.home_base && <span className="pref-badge">📍 {prefs.home_base}</span>}
              {prefs.interests && <span className="pref-badge">🏷 {prefs.interests.slice(0, 20)}{prefs.interests.length > 20 ? '…' : ''}</span>}
            </div>
          )}
        </div>

        <div className="header-buttons">
        {tab === 'chat' && (
          <>
            <div ref={sessRef} style={{ position: 'relative' }}>
              <button aria-label="Sessions" aria-expanded={showSessions} aria-haspopup="listbox" onClick={() => setShowSessions(x => !x)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowSessions(x => !x); } }} tabIndex={0} role="button"
                style={{ background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.4)', color: 'white', padding: '4px 10px', borderRadius: 5, cursor: 'pointer', fontSize: '.78rem', whiteSpace: 'nowrap' }}>
                Sessions ▾
              </button>
              {showSessions && (
                <div role="listbox" aria-label="Past sessions" style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, width: 240, maxWidth: 'calc(100vw - 20px)', maxHeight: 300, overflow: 'auto', background: 'white', border: '1px solid #e0e0e0', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,.15)', zIndex: 999 }}>
                  {sessions.length === 0 && <div style={{ padding: 12, color: '#888', fontSize: '.85rem' }}>No past sessions</div>}
                  {sessions.map(s => (
                    <div key={s.id} role="option" aria-selected={false} tabIndex={-1} onClick={() => loadSession(s.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); loadSession(s.id); } }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '.85rem', borderBottom: '1px solid #f0f0f0' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                      <div style={{ fontWeight: 500, color: '#000', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.display_title || s.title}</div>
                      <div style={{ color: '#888', fontSize: '.75rem' }}>{Math.ceil(s.msg_count / 2)} conv · {new Date(s.updated_at).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button aria-label="New session" onClick={newSession} style={{ background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.4)', color: 'white', padding: '4px 10px', borderRadius: 5, cursor: 'pointer', fontSize: '.78rem', whiteSpace: 'nowrap' }}>
              New
            </button>
            <div ref={prefsRef} style={{ position: 'relative' }}>
              <button aria-label="Preferences" aria-expanded={showPrefs} aria-haspopup="dialog" onClick={() => setShowPrefs(x => !x)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowPrefs(x => !x); } }} tabIndex={0} role="button" style={{ background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.3)', color: 'white', padding: '4px 8px', borderRadius: 5, cursor: 'pointer', fontSize: '.72rem', whiteSpace: 'nowrap' }}>
                {Object.values(prefs).some(v => v) ? '★' : ''} Prefs
              </button>
              {showPrefs && (<div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, width: 340, background: 'white', border: '1px solid #e0e0e0', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,.15)', zIndex: 999, padding: 16, maxHeight: 420, overflow: 'auto' }}>
                <div style={{ fontWeight: 600, marginBottom: 12, color: '#000' }}>My Preferences</div>

                <div style={{ fontSize: '.75rem', color: '#888', marginBottom: 4 }}>Mobility Needs</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                  {[
                    {v: 'wheelchair', l: '♿ Wheelchair'},
                    {v: 'cane', l: '🦯 Walking cane'},
                    {v: 'slow', l: '🐢 Slow walker'},
                    {v: 'hearing_impaired', l: '👂 Hearing impaired'},
                    {v: 'visually_impaired', l: '👁 Visually impaired'},
                    {v: 'none', l: 'None'},
                  ].map(({v, l}) => (
                    <button key={v} onClick={() => setPrefs(x => ({...x, mobility: v === 'none' ? '' : v}))}
                      style={{ padding: '5px 10px', border: prefs.mobility === (v === 'none' ? '' : v) ? '2px solid #1a7a5a' : '1px solid #ddd', borderRadius: 6, cursor: 'pointer', fontSize: '.75rem', background: prefs.mobility === (v === 'none' ? '' : v) ? '#e8f0fe' : 'white', fontWeight: prefs.mobility === (v === 'none' ? '' : v) ? 600 : 400 }}>
                      {l}
                    </button>
                  ))}
                </div>

                <div style={{ fontSize: '.75rem', color: '#888', marginBottom: 4 }}>Interests</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                  {['museum', 'cafe', 'park', 'temple', 'shopping_mall', 'viewpoint', 'market', 'art_gallery', 'historic_site', 'hotel'].map(cat => {
                    const selected = prefs.interests.includes(cat);
                    return (
                      <button key={cat} onClick={() => setPrefs(x => ({
                        ...x, interests: selected
                          ? x.interests.split(',').map(s => s.trim()).filter(s => s !== cat).join(', ')
                          : (x.interests + ', ' + cat).replace(/^, /, '')
                      }))}
                        style={{ padding: '3px 10px', border: selected ? '2px solid #1a7a5a' : '1px solid #ddd', borderRadius: 14, cursor: 'pointer', fontSize: '.72rem', background: selected ? '#e8f0fe' : 'white', fontWeight: selected ? 600 : 400, color: selected ? '#1a7a5a' : '#555' }}>
                        {cat.replace(/_/g, ' ')}
                      </button>
                    );
                  })}
                </div>

                <input placeholder="Other interests (comma separated)" value={prefs.interests} onChange={e => setPrefs(x => ({...x, interests: e.target.value}))} style={{ width: '100%', marginBottom: 8, padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: '.82rem', boxSizing: 'border-box' }} />
                <select value={prefs.budget_level} onChange={e => setPrefs(x => ({...x, budget_level: e.target.value}))} style={{ width: '100%', marginBottom: 8, padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: '.82rem', boxSizing: 'border-box', background: 'white' }}>
                  <option value="">Budget…</option><option value="cheap">💰 Cheap</option><option value="moderate">💰💰 Moderate</option><option value="expensive">💰💰💰 Expensive</option>
                </select>
                <input placeholder="Home base / hotel area" value={prefs.home_base} onChange={e => setPrefs(x => ({...x, home_base: e.target.value}))} style={{ width: '100%', marginBottom: 12, padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: '.82rem', boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowPrefs(false)} style={{ background: '#f5f5f5', border: '1px solid #ddd', color: '#333', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: '.82rem' }}>Cancel</button>
                  <button onClick={savePrefs} style={{ background: '#1a7a5a', border: 'none', color: 'white', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: '.82rem' }}>Save</button>
                </div>
              </div>)}
            </div>
            <div ref={settingsRef} style={{ position: 'relative' }}>
              <button aria-label="Settings" aria-expanded={showSettings} aria-haspopup="dialog" onClick={() => setShowSettings(x => !x)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowSettings(x => !x); } }} tabIndex={0} role="button"
                style={{ background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.3)', color: 'white', padding: '4px 8px', borderRadius: 5, cursor: 'pointer', fontSize: '.72rem', whiteSpace: 'nowrap' }}>
                ⚙
              </button>
              {showSettings && (
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, width: 360, background: 'white', border: '1px solid #e0e0e0', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,.15)', zIndex: 999, padding: 16, maxHeight: 440, overflow: 'auto' }}>
                  <div style={{ fontWeight: 600, marginBottom: 12, color: '#000' }}>LLM Settings</div>

                  <div style={{ fontSize: '.75rem', color: '#888', marginBottom: 4 }}>Provider</div>
                  <select value={settings.provider} onChange={e => setSettings(x => ({...x, provider: e.target.value}))}
                    style={{ width: '100%', marginBottom: 10, padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: '.82rem', background: 'white' }}>
                    <option value="gemini">Gemini API</option>
                    <option value="vertex">Vertex AI</option>
                    <option value="local">Local (llama.cpp)</option>
                    <option value="custom">Custom API</option>
                  </select>

                  <div style={{ fontSize: '.75rem', color: '#888', marginBottom: 4 }}>Model</div>
                  <input value={settings.model} onChange={e => setSettings(x => ({...x, model: e.target.value}))}
                    style={{ width: '100%', marginBottom: 10, padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: '.82rem', boxSizing: 'border-box' }}
                    placeholder="e.g. gemini-2.0-flash-001" />

                  {settings.provider === 'custom' && (
                    <>
                      <div style={{ fontSize: '.75rem', color: '#888', marginBottom: 4 }}>Custom API URL</div>
                      <input value={settings.customApiUrl} onChange={e => setSettings(x => ({...x, customApiUrl: e.target.value}))}
                        style={{ width: '100%', marginBottom: 10, padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: '.82rem', boxSizing: 'border-box' }}
                        placeholder="http://localhost:8080/v1/chat/completions" />

                      <div style={{ fontSize: '.75rem', color: '#888', marginBottom: 4 }}>Custom API Key</div>
                      <input type="password" value={settings.customApiKey} onChange={e => setSettings(x => ({...x, customApiKey: e.target.value}))}
                        style={{ width: '100%', marginBottom: 10, padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: '.82rem', boxSizing: 'border-box' }}
                        placeholder="sk-..." />
                    </>
                  )}

                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={() => setShowSettings(false)}
                      style={{ background: '#f5f5f5', border: '1px solid #ddd', color: '#333', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: '.82rem' }}>Cancel</button>
                    <button onClick={saveSettings}
                      style={{ background: '#1a7a5a', border: 'none', color: 'white', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: '.82rem' }}>Save</button>
                  </div>
                </div>
              )}
            </div>
            <div ref={modelRef} style={{ position: 'relative' }}>
              <button aria-label="Select model" aria-expanded={showModels} aria-haspopup="listbox" onClick={() => setShowModels(x => !x)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowModels(x => !x); } }} tabIndex={0} role="button" disabled={modelSwitching}
                style={{ background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.3)', color: 'white', padding: '4px 8px', borderRadius: 5, cursor: 'pointer', fontSize: '.72rem', whiteSpace: 'nowrap', opacity: modelSwitching ? .6 : 1 }}>
                {modelSwitching ? '⟳' : '⚙'} {currentModel ? currentModel.replace(/\.gguf$/, '').slice(0, 20) : 'Model'}
              </button>
              {showModels && (
                <div role="listbox" aria-label="Available models" style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, width: 280, maxWidth: 'calc(100vw - 20px)', maxHeight: 300, overflow: 'auto', background: 'white', border: '1px solid #e0e0e0', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,.15)', zIndex: 999 }}>
                  {models.length === 0 && <div style={{ padding: 12, color: '#888', fontSize: '.85rem' }}>No models found</div>}
                  {models.map(m => (
                    <div key={m} role="option" aria-selected={m === currentModel} tabIndex={-1} onClick={() => switchModel(m)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); switchModel(m); } }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '.8rem', background: m === currentModel ? '#f0f4ff' : '', borderBottom: '1px solid #f0f0f0' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')} onMouseLeave={e => (e.currentTarget.style.background = m === currentModel ? '#f0f4ff' : '')}>
                      <div style={{ fontWeight: 500, color: '#000' }}>{m.replace(/\.gguf$/, '')}</div>
                      <div style={{ color: '#888', fontSize: '.7rem' }}>{m.endsWith('.gguf') ? 'Local GGUF' : ''}</div>
                    </div>
                  ))}
                  <div style={{ padding: '8px 12px', fontSize: '.7rem', color: '#aaa', borderTop: '1px solid #f0f0f0', fontStyle: 'italic' }}>
                    Local model switching restarts llama-server
                  </div>
                </div>
              )}
            </div>

          </>
        )}

        {tab === 'itinerary' && (
          <div ref={itinSwitcher} style={{ position: 'relative' }}>
            <button aria-label="Switch itinerary" aria-expanded={showItinSwitch} aria-haspopup="listbox" onClick={() => setShowItinSwitch(x => !x)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowItinSwitch(x => !x); } }} tabIndex={0} role="button" style={{ background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.4)', color: 'white', padding: '4px 10px', borderRadius: 5, cursor: 'pointer', fontSize: '.78rem', whiteSpace: 'nowrap'}}>
              {currentItineraryId ? `Iten #${currentItineraryId} ▾` : 'Itineraries ▾'}
            </button>
            {showItinSwitch && (
              <div role="listbox" aria-label="Saved itineraries" style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, width: 240, maxWidth: 'calc(100vw - 20px)', maxHeight: 300, overflow: 'auto', background: 'white', border: '1px solid #e0e0e0', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,.15)', zIndex: 999 }}>
                {itineraries.length === 0 && <div style={{ padding: 12, color: '#888', fontSize: '.85rem' }}>No itineraries</div>}
                {itineraries.map(i => (
                  <div key={i.id} role="option" aria-selected={i.id === currentItineraryId} tabIndex={-1} onClick={() => switchItinerary(i.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); switchItinerary(i.id); } }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '.85rem', background: i.id === currentItineraryId ? '#f0f4ff' : '', borderBottom: '1px solid #f0f0f0' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')} onMouseLeave={e => (e.currentTarget.style.background = i.id === currentItineraryId ? '#f0f4ff' : '')}>
                    <div style={{ fontWeight: 500 }}>Itinerary #{i.id}</div>
                    <div style={{ color: '#888', fontSize: '.75rem' }}>{i.user_text?.slice(0, 40) || 'No description'} · {i.stop_count} stops</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}


        </div>
      </div>

      <div className="content">
        {/* Chat Tab */}
        <div className={`tab-content chat-tab ${tab === 'chat' ? 'active' : ''}`}>
          <div className="messages">
            {msgs.length === 0 && (
              <div className="welcome">
                <h2>Inclusive Hong Kong Guide</h2>
                <p>Your AI assistant for accessible travel in Hong Kong. Find wheelchair-friendly places, plan step-free routes, and discover inclusive attractions.</p>
              </div>
            )}
            {msgs.map((m, i) => {
              const thinkCollapsed = collapsedThinking.has(i);
              return (
              <div key={i} className={`msg ${m.type}`}>
                {m.type === 'bot' && !m.done && m.thinking.length > 0 && (
                  <div className="thinking-content">
                    {m.thinking.map((s, j) => <div key={j}>{s}</div>)}
                    <div className="thinking-pulse" />
                  </div>
                )}
                {m.done && m.thinking.length > 0 && (
                  <div className="think-toggle" onClick={() => setCollapsedThinking(x => {
                    const c = new Set(x);
                    if (c.has(i)) c.delete(i); else c.add(i);
                    return c;
                  })}>
                    {thinkCollapsed ? '▸ Show thinking' : '▾ Hide thinking'}
                  </div>
                )}
                {m.done && !thinkCollapsed && m.thinking.length > 0 && (
                  <div className="thinking-content">
                    {m.thinking.map((s, j) => <div key={j}>{s}</div>)}
                  </div>
                )}

                {/* Content area */}
                {m.type === 'user' && <div className="bubble">{m.text}</div>}
                {m.done && (
                  <>
                    <div className="bubble typewriter" dangerouslySetInnerHTML={{ __html: md(m.text || '') }}></div>
                    {m.text?.startsWith('Error:') && (
                      <button onClick={() => {
                        const userMsg = msgs.slice(0, i).filter(m => m.type === 'user').pop();
                        if (userMsg?.text) send(userMsg.text);
                      }}
                      style={{ marginTop: 6, padding: '4px 12px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '.75rem' }}>
                        Retry
                      </button>
                    )}
                    {m.places && m.places.length > 0 && (
                      <div className="msg-places">
                        {m.places.map((p: any, j: number) => (
                          <span key={j} className="msg-place-tag">{p.name}</span>
                        ))}
                      </div>
                    )}
                    {(m.itineraryId || (m.places && m.places.length > 0)) && (
                      <div className="msg-actions">
                        {m.itineraryId && (
                          <button className="action-btn primary" onClick={() => { if (!detail) fetchDetail(m.itineraryId!); setTab('itinerary'); }}>
                            Itinerary #{m.itineraryId} ▸
                          </button>
                        )}
                        {m.places && m.places.length > 0 && (
                          <button className="action-btn secondary" onClick={() => { setCurrentPlaces(m.places!); setDayFilter(null); setTab('map'); }}>
                            Show on Map ({m.places.length})
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
              );
            })}
            <div ref={msgEnd} />
          </div>
          <div className="chat-input">
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send(input)} placeholder="Ask me about Kowloon..." disabled={loading} />
            <button onClick={() => send(input)} disabled={loading || !input.trim()}>{loading ? '...' : 'Send'}</button>
          </div>
        </div>

        {/* Map Tab — combined itinerary + saved places */}
        <div className={`tab-content map-tab ${tab === 'map' ? 'active' : ''}`}>
          <div className="map-day-filters" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6, padding: '8px 10px', borderBottom: '1px solid #e0e0e0' }}>
            {/* Category filter row */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '.7rem', color: '#888', marginRight: 2, whiteSpace: 'nowrap' }}>Category:</span>
              {['All', 'museum', 'cafe', 'park', 'temple', 'market', 'art_gallery', 'historic_site', 'viewpoint', 'shopping_mall', 'hotel'].map(cat => (
                <button key={cat}
                  className={`map-day-btn ${categoryFilter === (cat === 'All' ? null : cat) ? 'active' : ''}`}
                  onClick={() => setCategoryFilter(cat === 'All' ? null : cat)}
                  style={{ fontSize: '.68rem', padding: '2px 7px' }}>
                  {cat === 'All' ? 'All' : cat.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
            {/* Day filter row — only when itinerary is active */}
            {detail && (() => {
              const days = daysFromItems(detail.items);
              return days.length > 0 ? (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: '.7rem', color: '#888', marginRight: 2, whiteSpace: 'nowrap' }}>Day:</span>
                  <button className={`map-day-btn ${dayFilter === null ? 'active' : ''}`} onClick={() => setDayFilter(null)}>All Days</button>
                  {days.map(d => (
                    <button key={d} className={`map-day-btn ${dayFilter === d ? 'active' : ''}`} onClick={() => setDayFilter(d)}>Day {d}</button>
                  ))}
                </div>
              ) : null;
            })()}
          </div>
          <div className="map-full" style={{ position: 'relative' }}>
            {hasNoItinerary && storedPlaces.length === 0 && (
              <div className="welcome-overlay">
                <h2>No places to show</h2>
                <p>Open an itinerary from the Itinerary tab or start a new chat to plan one.</p>
              </div>
            )}
            <MapView
              markers={(() => {
                // Itinerary places (filtered by day + category)
                const itinPlaces = (dayFilter !== null
                  ? currentPlaces.filter((p: any) => p.day === undefined || p.day === dayFilter)
                  : currentPlaces
                ).filter((p: any) => !categoryFilter || p.category === categoryFilter);
                const itinMarkers = itinPlaces.map((p: any) => ({
                  lat: p.lat, lng: p.lng, label: `${p.name}${p.day ? ` (Day ${p.day})` : ''}`,
                  category: p.category, day: p.day, type: 'itinerary' as const,
                }));

                // Saved places with density limit (max 30, evenly spaced)
                const catFiltered = categoryFilter
                  ? storedPlaces.filter((p: any) => p.category === categoryFilter)
                  : storedPlaces;
                const sampled = catFiltered.length > 30
                  ? catFiltered.filter((_: any, i: number) => i % Math.ceil(catFiltered.length / 30) === 0)
                  : catFiltered;
                const savedMarkers = sampled.map((p: any) => ({
                  lat: p.lat, lng: p.lng, label: p.name,
                  category: p.category, type: 'saved' as const,
                }));

                return [...itinMarkers, ...savedMarkers];
              })()}
              routes={mapRoutes}
            />
          </div>
        </div>

        {/* Itinerary Tab */}
        <div className={`tab-content itinerary-tab ${tab === 'itinerary' ? 'active' : ''}`}>
          {detailLoading && <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>Loading itinerary...</div>}

          {!detailLoading && detail && (
            <div className="detail-view">
              <div className="detail-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <h2>Itinerary #{detail.itinerary.id}</h2>
                  <button onClick={() => { const pts = detail.items.map(i => ({ name: i.place_name, lat: i.lat, lng: i.lng, category: i.category, day: i.day_number || 1 })); setCurrentPlaces(pts); setDayFilter(null); setTab('map'); }} style={{ background: '#1a7a5a', border: 'none', color: 'white', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: '.85rem' }}>
                    Show on Map
                  </button>
                </div>
                <div className="detail-meta">{detail.items.length} stops · {new Date(detail.itinerary.created_at).toLocaleString()}</div>
                {detail.itinerary.user_text && <div className="detail-prompt">"{detail.itinerary.user_text}"</div>}
                {(detail as any).costSummary && (
                  <div style={{ fontSize: '.82rem', color: '#555', marginTop: 4 }}>
                    Transport: HK${(detail as any).costSummary.totalTransport} · Entry: HK${(detail as any).costSummary.totalEntry} · Total: <strong>HK${(detail as any).costSummary.totalAll}</strong>
                  </div>
                )}
                {(() => {
                  const scores: number[] = detail.items.map(i => i.accessibility_score).filter((s): s is number => s != null && s > 0);
                  if (scores.length === 0) return null;
                  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
                  const color = avg >= 4 ? '#27ae60' : avg >= 2 ? '#e67e22' : '#e74c3c';
                  const label = avg >= 4 ? 'Good' : avg >= 2 ? 'Limited' : 'Poor';
                  return <div style={{ fontSize: '.82rem', color, marginTop: 2 }}>♿ Accessibility: {avg.toFixed(1)}/5 ({label})</div>;
                })()}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={() => confirmItinerary(detail.itinerary.id)} style={{ background: '#27ae60', border: 'none', color: 'white', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: '.82rem' }}>
                    ✓ Confirm All
                  </button>
                  <button onClick={() => unlockItinerary(detail.itinerary.id)} style={{ background: '#e67e22', border: 'none', color: 'white', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: '.82rem' }}>
                    Unlock
                  </button>
                </div>
              </div>
              {daysFromItems(detail.items).map(day => {
                const dayItems = detail.items.filter(i => (i.day_number || 1) === day);
                const dayDist = dayItems.reduce((s, i) => s + (i.road_distance_meters || 0), 0);
                return (
                  <div key={day} className="day-group">
                    <div className="day-header">
                      <span className="day-title">Day {day}</span>
                      <span className="day-meta">{dayItems.length} stops · ~{walkTime(dayDist)} walking</span>
                    </div>
                    {dayItems.map((item, i) => (
                      <div key={item.id} className="stop-card" style={{ cursor: 'pointer' }} onClick={() => { setCurrentPlaces([{ name: item.place_name, lat: item.lat, lng: item.lng, category: item.category, day: item.day_number || 1 }]); setDayFilter(null); setTab('map'); }}>
                        <div className="stop-left">
                          <div className="stop-num">{item.stop_index + 1}</div>
                        </div>
                        <div className="stop-body">
                          <div className="stop-name">{item.place_name}</div>
                          <div className="stop-times">{item.start_time || '?'} – {item.end_time || '?'} · ~{item.duration_minutes} min</div>
                          {item.category && <div className="stop-cat">{item.category.replace('_', ' ')}</div>}
                          {i > 0 && item.road_distance_meters > 0 && (
                            <div className="stop-walk">🚶 {fmtDist(item.road_distance_meters)} · ~{walkTime(item.road_distance_meters)} walk</div>
                          )}
                          {item.accessibility_score != null && item.accessibility_score > 0 && (
                            <span style={{ fontSize: '.7rem', padding: '1px 6px', borderRadius: 4, background: item.accessibility_score >= 4 ? '#d4edda' : item.accessibility_score >= 2 ? '#fff3cd' : '#f8d7da', color: item.accessibility_score >= 4 ? '#155724' : item.accessibility_score >= 2 ? '#856404' : '#721c24', marginRight: 4 }}>
                              ♿ {item.accessibility_score}/5
                            </span>
                          )}
                          {item.accessibility_tags != null && item.accessibility_tags.length > 0 && (() => {
                            const tags = item.accessibility_tags as string[];
                            return <span style={{ fontSize: '.68rem', color: '#888' }}>{tags.slice(0, 3).join(', ')}</span>;
                          })()}
                          {item.confirmed && <span style={{ fontSize: '.7rem', color: '#27ae60', fontWeight: 500 }}>✓ Confirmed</span>}
                          {(item.entry_cost || item.transport_cost) && (
                            <div style={{ fontSize: '.75rem', color: '#888', marginTop: 2 }}>
                              {item.entry_cost ? `HK$${item.entry_cost} entry` : ''}{item.entry_cost && item.transport_cost ? ' + ' : ''}{item.transport_cost ? `HK$${item.transport_cost} transport (${item.transport_mode || 'walking'})` : ''}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="day-total">Day {day} total: ~{dayItems.reduce((s, i) => s + i.duration_minutes, 0)} min activities · ~{walkTime(dayDist)} walking</div>
                  </div>
                );
              })}
            </div>
          )}

          {!detailLoading && !detail && currentItineraryId && (
            <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>Loading itinerary...</div>
          )}

          {!detailLoading && !detail && !currentItineraryId && (
            <div className="welcome"><h2>No itinerary active</h2><p>Ask me to plan a trip, or select one from the header.</p></div>
          )}
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
