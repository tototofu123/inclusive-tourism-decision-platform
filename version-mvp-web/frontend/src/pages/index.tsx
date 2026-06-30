import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';

const MapView = dynamic(() => import('../components/MapView'), { ssr: false });
const API = process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:4000';

type Tab = 'chat' | 'map' | 'itinerary' | 'places';
type Intent = 'question' | 'find_places' | 'create_itinerary' | 'add_to_itinerary';

interface ChatMsg {
  type: 'user' | 'bot';
  text?: string;
  thinking?: string[];
  intent?: Intent;
  places?: any[];
  itineraryId?: number;
}

interface ItinerarySummary { id: number; user_text: string; created_at: string; stop_count: number }
interface SessionSummary { id: number; title: string; created_at: string; updated_at: string; msg_count: number }

interface ItineraryDetail {
  itinerary: { id: number; user_text: string; created_at: string };
  items: Array<{
    id: number; stop_index: number; place_name: string; label?: string;
    start_time: string; end_time: string; duration_minutes: number;
    road_distance_meters: number; lat: number; lng: number; category: string;
    day_number: number; description?: string;
  }>;
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
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [showSessions, setShowSessions] = useState(false);
  const [storedPlaces, setStoredPlaces] = useState<any[]>([]);
  const [placesTotal, setPlacesTotal] = useState(0);
  const [detail, setDetail] = useState<ItineraryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [dayFilter, setDayFilter] = useState<number | null>(null);
  const msgEnd = useRef<HTMLDivElement>(null);

  useEffect(() => { msgEnd.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs]);

  useEffect(() => {
    fetch(`${API}/sessions`).then(r => r.json()).then(setSessions).catch(() => {});
    fetch(`${API}/itineraries`).then(r => r.json()).then(d => setItineraries(d)).catch(() => {});
    fetch(`${API}/places`).then(r => r.json()).then(d => { setStoredPlaces(d.places || []); setPlacesTotal(d.total || 0); }).catch(() => {});
  }, []);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    setInput('');
    setMsgs(x => [...x, { type: 'user', text: text.trim() }]);
    setLoading(true);
    setMsgs(x => [...x, { type: 'bot', text: undefined, thinking: ['Thinking...'] }]);

    try {
      let sid = sessionId;
      if (!sid) {
        const r = await fetch(`${API}/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        const d = await r.json();
        sid = d.id;
        setSessionId(sid);
        setSessions(x => [{ id: d.id, title: 'New Chat', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), msg_count: 0 }, ...x]);
      }
      const res = await fetch(`${API}/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), itineraryId: currentItineraryId, sessionId: sid }),
      });
      const data = await res.json();
      const places = data.places || [];
      if (places.length > 0) setCurrentPlaces(places);
      if (data.itinerary?.id) setCurrentItineraryId(data.itinerary.id);

      setMsgs(x => x.slice(0, -1).concat({
        type: 'bot', text: data.response, thinking: data.thinking,
        intent: data.intent, places, itineraryId: data.itinerary?.id,
      }));
      if (data.allItineraries) setItineraries(data.allItineraries);
      setSessions(x => x.map(s => s.id === sid ? { ...s, msg_count: s.msg_count + 2, title: s.msg_count === 0 ? text.trim().slice(0, 40) : s.title } : s));
      fetch(`${API}/places?limit=50`).then(r => r.json()).then(d => { setStoredPlaces(d.places || []); }).catch(() => {});
    } catch {
      setMsgs(x => x.slice(0, -1).concat({ type: 'bot', text: 'Cannot reach server. Start backend first.', thinking: ['Connection failed'] }));
    } finally { setLoading(false); }
  }

  function loadSession(sid: number) {
    fetch(`${API}/sessions/${sid}`).then(r => r.json()).then(data => {
      setSessionId(sid);
      const loaded: ChatMsg[] = data.messages.map((m: any) => {
        if (m.role === 'user') return { type: 'user' as const, text: m.content };
        return {
          type: 'bot' as const, text: m.content, intent: m.intent,
          thinking: m.thinking ? JSON.parse(m.thinking) : undefined,
          places: m.places_json, itineraryId: m.itinerary_id,
        };
      });
      setMsgs(loaded);
      setShowSessions(false);
      setTab('chat');
    }).catch(() => {});
  }

  function newSession() {
    setSessionId(undefined);
    setMsgs([]);
    setCurrentPlaces([]);
    setCurrentItineraryId(undefined);
    setShowSessions(false);
    setDetail(null);
  }

  function showItinerary(id: number) {
    setDetailLoading(true);
    setDetail(null);
    fetch(`${API}/itinerary/${id}`).then(r => r.json()).then(d => { setDetail(d); setDetailLoading(false); setTab('itinerary'); }).catch(() => setDetailLoading(false));
  }

  function fmtDist(m: number): string {
    if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
    return `${m} m`;
  }

  function daysFromItems(items: ItineraryDetail['items']): number[] {
    const days = new Set(items.map(i => i.day_number || 1));
    return Array.from(days).sort((a, b) => a - b);
  }

  const suggestions = [
    'Plan a Kowloon trip with museum and cafe',
    'Find parks in Kowloon',
    'What places are accessible in Kowloon?',
    'Add a temple to my itinerary',
    'How to get around Kowloon?',
  ];

  const mapMarkers = tab === 'map' && dayFilter !== null
    ? currentPlaces.filter(p => p.day === undefined || p.day === dayFilter)
    : currentPlaces;

  return (
    <div className="app">
      <div className="header">
        <div style={{ flex: 1 }}><h1>Inclusive Tourism</h1><div className="subtitle">Kowloon Explorer Agent</div></div>
        <button onClick={() => setShowSessions(x => !x)} style={{ background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.4)', color: 'white', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: '.85rem' }}>
          Sessions
        </button>
        {sessionId && <button onClick={newSession} style={{ background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.4)', color: 'white', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: '.85rem', marginLeft: 6 }}>New</button>}
      </div>

      {showSessions && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,.15)', zIndex: 999, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: 60 }}
          onClick={() => setShowSessions(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: 320, maxHeight: '70vh', background: 'white', border: '1px solid #e0e0e0', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,.15)', overflow: 'auto' }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid #e0e0e0', fontWeight: 600, fontSize: '.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Chat Sessions</span>
              <span onClick={() => setShowSessions(false)} style={{ cursor: 'pointer', color: '#888' }}>✕</span>
            </div>
            {sessions.length === 0 && <div style={{ padding: 20, color: '#888', textAlign: 'center', fontSize: '.85rem' }}>No sessions yet.<br/>Send a message to start one.</div>}
            {sessions.map(s => (
              <div key={s.id} onClick={() => loadSession(s.id)} style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0', cursor: 'pointer', fontSize: '.85rem' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</div>
                <div style={{ color: '#888', fontSize: '.75rem', marginTop: 2 }}>{s.msg_count} msgs · {new Date(s.updated_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="content">
        {/* Chat Tab */}
        <div className={`tab-content chat-tab ${tab === 'chat' ? 'active' : ''}`}>
          <div className="messages">
            {msgs.length === 0 && (
              <div className="welcome">
                <h2>Explore Kowloon</h2>
                <p>I'm your AI travel agent for Kowloon, Hong Kong. I can help you plan itineraries, find places, and answer questions about accessibility and attractions.</p>
                <div className="suggestions">
                  {suggestions.map((s, i) => (
                    <button key={i} onClick={() => send(s)} disabled={loading}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`msg ${m.type}`}>
                {m.intent && <div className={`intent-badge ${m.intent}`}>{m.intent.replace('_', ' ')}</div>}
                <div className="bubble">
                  {m.text || (m.type === 'bot' && !m.text ? <span className="loading-dots">Thinking</span> : m.text)}
                </div>
                {m.type === 'bot' && m.thinking && m.thinking.length > 0 && (
                  <div className="thinking-content">
                    {m.thinking.map((s, j) => <div key={j}>{s}</div>)}
                  </div>
                )}
                {m.itineraryId && (
                  <div className="view-itinerary-link" onClick={() => showItinerary(m.itineraryId!)}>
                    View itinerary details →
                  </div>
                )}
              </div>
            ))}
            <div ref={msgEnd} />
          </div>
          <div className="chat-input">
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send(input)} placeholder="Ask me about Kowloon..." disabled={loading} />
            <button onClick={() => send(input)} disabled={loading || !input.trim()}>{loading ? '...' : 'Send'}</button>
          </div>
        </div>

        {/* Map Tab */}
        <div className={`tab-content map-tab ${tab === 'map' ? 'active' : ''}`}>
          {detail && (() => {
            const days = daysFromItems(detail.items);
            return (
              <div className="map-day-filters">
                <button className={`map-day-btn ${dayFilter === null ? 'active' : ''}`} onClick={() => setDayFilter(null)}>All</button>
                {days.map(d => (
                  <button key={d} className={`map-day-btn ${dayFilter === d ? 'active' : ''}`} onClick={() => setDayFilter(d)}>Day {d}</button>
                ))}
              </div>
            );
          })()}
          <div className="map-full">
            <MapView
              markers={mapMarkers.map((p: any, i: number) => ({ lat: p.lat, lng: p.lng, label: `${i+1}. ${p.name}${p.day ? ` (Day ${p.day})` : ''}`, category: p.category, day: p.day }))}
              routes={[]}
            />
          </div>
        </div>

        {/* Itinerary Tab */}
        <div className={`tab-content itinerary-tab ${tab === 'itinerary' ? 'active' : ''}`}>
          {detailLoading && <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>Loading itinerary...</div>}

          {!detailLoading && detail && (
            <div className="detail-view">
              <div className="detail-header">
                <h2>Itinerary #{detail.itinerary.id}</h2>
                <div className="detail-meta">{detail.items.length} stops · {new Date(detail.itinerary.created_at).toLocaleString()}</div>
                {detail.itinerary.user_text && <div className="detail-prompt">"{detail.itinerary.user_text}"</div>}
                <button className="back-btn" onClick={() => setDetail(null)}>← Back to list</button>
              </div>
              {daysFromItems(detail.items).map(day => {
                const dayItems = detail.items.filter(i => (i.day_number || 1) === day);
                const dayDist = dayItems.reduce((s, i) => s + (i.road_distance_meters || 0), 0);
                return (
                  <div key={day} className="day-group">
                    <div className="day-header">
                      <span className="day-title">Day {day}</span>
                      <span className="day-meta">{dayItems.length} stops · ~{fmtDist(dayDist)} walking</span>
                    </div>
                    {dayItems.map((item, i) => (
                      <div key={item.id} className="stop-card">
                        <div className="stop-left">
                          <div className="stop-num">{item.stop_index + 1}</div>
                        </div>
                        <div className="stop-body">
                          <div className="stop-name">{item.place_name}</div>
                          <div className="stop-times">{item.start_time || '?'} – {item.end_time || '?'} · ~{item.duration_minutes} min</div>
                          {item.category && <div className="stop-cat">{item.category.replace('_', ' ')}</div>}
                          {i > 0 && item.road_distance_meters > 0 && (
                            <div className="stop-walk">🚶 {fmtDist(item.road_distance_meters)} from previous</div>
                          )}
                          <button className="stop-map-btn" onClick={() => { setCurrentPlaces([{ name: item.place_name, lat: item.lat, lng: item.lng, category: item.category, day: item.day_number || 1 }]); setTab('map'); }}>Show on map</button>
                        </div>
                      </div>
                    ))}
                    <div className="day-total">Day {day} total: ~{dayItems.reduce((s, i) => s + i.duration_minutes, 0)} min · {fmtDist(dayDist)} walking</div>
                  </div>
                );
              })}
            </div>
          )}

          {!detailLoading && !detail && (
            <>
              {itineraries.length === 0 && (
                <div className="welcome"><h2>No itineraries yet</h2><p>Ask me to plan a trip and your saved itineraries will appear here.</p></div>
              )}
              {currentItineraryId && itineraries.find(i => i.id === currentItineraryId) && (
                <div className="itin-card active" onClick={() => showItinerary(currentItineraryId!)}>
                  <div className="itin-title">Current Itinerary #{currentItineraryId}</div>
                  <div className="itin-meta">Active session</div>
                </div>
              )}
              {itineraries.map(itin => (
                <div key={itin.id} className="itin-card" onClick={() => showItinerary(itin.id)}>
                  <div className="itin-title">Itinerary #{itin.id}</div>
                  <div className="itin-preview">{itin.user_text || 'No description'}</div>
                  <div className="itin-meta">{itin.stop_count} stops · {new Date(itin.created_at).toLocaleString()}</div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Places Tab */}
        <div className={`tab-content tab-content-padded ${tab === 'places' ? 'active' : ''}`}>
          <div style={{ padding: 16 }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: 12 }}>Saved Places ({placesTotal})</h2>
            {storedPlaces.length === 0 && (
              <div className="welcome" style={{ padding: 20 }}><h2>No places saved</h2><p>Places discovered during chats are automatically saved here.</p></div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {storedPlaces.map((p: any) => (
                <div key={p.id} style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: 8, padding: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '.9rem' }}>{p.name}</div>
                    <div style={{ fontSize: '.8rem', color: '#888' }}>{p.category} · {p.lat.toFixed(4)}, {p.lng.toFixed(4)}</div>
                  </div>
                  <button onClick={() => { setCurrentPlaces([{ id: p.id, name: p.name, lat: p.lat, lng: p.lng, category: p.category }]); setTab('map'); }}
                    style={{ padding: '4px 10px', border: '1px solid #0070f3', borderRadius: 4, background: 'white', color: '#0070f3', cursor: 'pointer', fontSize: '.8rem' }}>
                    Show on Map
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Tabs */}
      <div className="tabs">
        <button className={`tab ${tab === 'chat' ? 'active' : ''}`} onClick={() => setTab('chat')}>Chat</button>
        <button className={`tab ${tab === 'map' ? 'active' : ''}`} onClick={() => setTab('map')}>Map</button>
        <button className={`tab ${tab === 'itinerary' ? 'active' : ''}`} onClick={() => setTab('itinerary')}>Itinerary</button>
        <button className={`tab ${tab === 'places' ? 'active' : ''}`} onClick={() => setTab('places')}>Places</button>
      </div>
    </div>
  );
}
