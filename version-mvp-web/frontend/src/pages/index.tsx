import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';

const MapView = dynamic(() => import('../components/MapView'), { ssr: false });
const API = process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:4000';

type Tab = 'chat' | 'map' | 'itinerary' | 'places';
type Intent = 'question' | 'find_places' | 'create_itinerary' | 'add_to_itinerary' | 'modify_itinerary';

interface ChatMsg {
  type: 'user' | 'bot';
  text?: string;
  thinking: string[];
  done?: boolean;
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

function genTitle(intent?: Intent, days?: number, placeCount?: number): string {
  if (intent === 'create_itinerary') return days ? `Plan ${days}d trip` : 'Plan trip';
  if (intent === 'add_to_itinerary') return 'Add to itinerary';
  if (intent === 'modify_itinerary') return 'Modify itinerary';
  if (intent === 'find_places') return `Find places${placeCount ? ` (${placeCount})` : ''}`;
  return 'Ask a question';
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
  const [placesLoading, setPlacesLoading] = useState(true);
  const [placesView, setPlacesView] = useState<'map' | 'list'>('map');
  const msgEnd = useRef<HTMLDivElement>(null);
  const itinSwitcher = useRef<HTMLDivElement>(null);
  const sessRef = useRef<HTMLDivElement>(null);
  const [collapsedThinking, setCollapsedThinking] = useState<Set<number>>(new Set());

  useEffect(() => { if (tab === 'chat') msgEnd.current?.scrollIntoView() }, [msgs, tab]);

  const fetchSessions = useCallback(() => {
    fetch(`${API}/sessions`).then(r => r.json()).then(setSessions).catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`${API}/itineraries`).then(r => r.json()).then(d => setItineraries(d)).catch(() => {});
    fetchSessions();
    fetch(`${API}/places`).then(r => r.json()).then(d => { setStoredPlaces(d.places || []); setPlacesTotal(d.total || 0); }).catch(() => {}).finally(() => setPlacesLoading(false));
  }, [fetchSessions]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (itinSwitcher.current && !itinSwitcher.current.contains(e.target as Node)) setShowItinSwitch(false);
      if (sessRef.current && !sessRef.current.contains(e.target as Node)) setShowSessions(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function fetchDetail(id: number) {
    setDetailLoading(true);
    setDetail(null);
    const timer = setTimeout(() => setDetailLoading(false), 15000);
    fetch(`${API}/itinerary/${id}`).then(r => r.json()).then(d => { clearTimeout(timer); setDetail(d); setDetailLoading(false); }).catch(() => { clearTimeout(timer); setDetailLoading(false); });
  }

  function loadSession(sid: number) {
    fetch(`${API}/sessions/${sid}`).then(r => r.json()).then(data => {
      setSessionId(sid);
      const loaded: ChatMsg[] = data.messages.map((m: any) => {
        if (m.role === 'user') return { type: 'user' as const, text: m.content, thinking: [] };
        return {
          type: 'bot' as const, text: m.content, intent: m.intent,
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
    }).catch(() => {});
  }

  async function send(text: string) {
    if (!text.trim() || loading) return;
    setInput('');
    const userMsg = { type: 'user' as const, text: text.trim(), thinking: [] };
    const botMsg = { type: 'bot' as const, thinking: [] as string[], done: false };
    setMsgs(x => [...x, userMsg, botMsg]);
    setLoading(true);

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

      // 2. Poll for status updates every 400ms
      let done = false;
      while (!done) {
        await new Promise(r => setTimeout(r, 400));
        const statusRes = await fetch(`${API}/chat/status/${processId}`);
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
                intent: result.intent,
                places,
                itineraryId: result.itinerary?.id,
              };
            }
            return copy;
          });

          if (result.allItineraries) setItineraries(result.allItineraries);
          if (result.itinerary?.id) fetchDetail(result.itinerary.id);

          if (!sessionTitle) {
            const days = result.itinerary?.stops?.length ? Math.max(...result.itinerary.stops.map((s: any) => s.day || 1)) : 0;
            setSessionTitle(genTitle(result.intent, days, places.length));
          }

          fetch(`${API}/places`).then(r => r.json()).then(d => { setStoredPlaces(d.places || []); setPlacesTotal(d.total || 0); }).catch(() => {});
          fetchSessions();
        }
      }
    } catch (e) {
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
    }).catch(() => {});
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
  function walkTime(m: number): string {
    const min = Math.round(m / 80);
    if (min >= 60) return `${Math.floor(min / 60)}h ${min % 60}m`;
    return `${min} min`;
  }

  function daysFromItems(items: ItineraryDetail['items']): number[] {
    const days = new Set(items.map(i => i.day_number || 1));
    return Array.from(days).sort((a, b) => a - b);
  }

  const hasNoItinerary = !currentItineraryId && currentPlaces.length === 0;

  const mapMarkers = tab === 'map' && dayFilter !== null
    ? currentPlaces.filter(p => p.day === undefined || p.day === dayFilter)
    : currentPlaces;

  return (
    <div className="app">
      <div className="header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1>{sessionTitle || 'Inclusive Tourism'}</h1>
          {sessionTitle && <div className="subtitle">Kowloon Explorer Agent</div>}
        </div>

        {tab === 'chat' && (
          <>
            <div ref={sessRef} style={{ position: 'relative' }}>
              <button onClick={() => setShowSessions(x => !x)}
                style={{ background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.4)', color: 'white', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: '.85rem', whiteSpace: 'nowrap' }}>
                Sessions ▾
              </button>
              {showSessions && (
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, width: 240, maxHeight: 300, overflow: 'auto', background: 'white', border: '1px solid #e0e0e0', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,.15)', zIndex: 999 }}>
                  {sessions.length === 0 && <div style={{ padding: 12, color: '#888', fontSize: '.85rem' }}>No past sessions</div>}
                  {sessions.map(s => (
                    <div key={s.id} onClick={() => loadSession(s.id)} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '.85rem', borderBottom: '1px solid #f0f0f0' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                      <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</div>
                      <div style={{ color: '#888', fontSize: '.75rem' }}>{s.msg_count} msgs · {new Date(s.updated_at).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={newSession} style={{ background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.4)', color: 'white', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: '.85rem', whiteSpace: 'nowrap' }}>
              New
            </button>
          </>
        )}

        {tab === 'itinerary' && (
          <div ref={itinSwitcher} style={{ position: 'relative' }}>
            <button onClick={() => setShowItinSwitch(x => !x)} style={{ background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.4)', color: 'white', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: '.85rem', whiteSpace: 'nowrap' }}>
              {currentItineraryId ? `Iten #${currentItineraryId} ▾` : 'Itineraries ▾'}
            </button>
            {showItinSwitch && (
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, width: 240, maxHeight: 300, overflow: 'auto', background: 'white', border: '1px solid #e0e0e0', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,.15)', zIndex: 999 }}>
                {itineraries.length === 0 && <div style={{ padding: 12, color: '#888', fontSize: '.85rem' }}>No itineraries</div>}
                {itineraries.map(i => (
                  <div key={i.id} onClick={() => switchItinerary(i.id)} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '.85rem', background: i.id === currentItineraryId ? '#f0f4ff' : '', borderBottom: '1px solid #f0f0f0' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')} onMouseLeave={e => (e.currentTarget.style.background = i.id === currentItineraryId ? '#f0f4ff' : '')}>
                    <div style={{ fontWeight: 500 }}>Itinerary #{i.id}</div>
                    <div style={{ color: '#888', fontSize: '.75rem' }}>{i.user_text?.slice(0, 40) || 'No description'} · {i.stop_count} stops</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'places' && (
          <button onClick={() => setPlacesView(x => x === 'map' ? 'list' : 'map')}
            style={{ background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.4)', color: 'white', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: '.85rem', whiteSpace: 'nowrap' }}>
            {placesView === 'map' ? 'List View' : 'Map View'}
          </button>
        )}
      </div>

      <div className="content">
        {/* Chat Tab */}
        <div className={`tab-content chat-tab ${tab === 'chat' ? 'active' : ''}`}>
          <div className="messages">
            {msgs.length === 0 && (
              <div className="welcome">
                <h2>Explore Kowloon</h2>
                <p>I'm your AI travel agent for Kowloon, Hong Kong. I can help you plan itineraries, find places, and answer questions about accessibility and attractions.</p>
              </div>
            )}
            {msgs.map((m, i) => {
              const thinkCollapsed = collapsedThinking.has(i);
              return (
              <div key={i} className={`msg ${m.type}`}>
                {m.intent && <div className={`intent-badge ${m.intent}`}>{m.intent.replace('_', ' ')}</div>}

                {/* Thinking box - always above, collapsible when done */}
                {m.done && m.thinking.length > 0 && (
                  <div className="think-toggle" onClick={() => setCollapsedThinking(x => {
                    const c = new Set(x);
                    if (c.has(i)) c.delete(i); else c.add(i);
                    return c;
                  })}>
                    {thinkCollapsed ? '▸ Show thinking' : '▾ Hide thinking'}
                  </div>
                )}
                {!m.done && m.thinking.length > 0 && (
                  <div className="thinking-content">
                    {m.thinking.map((s, j) => <div key={j}>{s}</div>)}
                    <div className="thinking-pulse" />
                  </div>
                )}
                {m.done && !thinkCollapsed && m.thinking.length > 0 && (
                  <div className="thinking-content">
                    {m.thinking.map((s, j) => <div key={j}>{s}</div>)}
                  </div>
                )}

                {/* Content area */}
                {!m.done && m.thinking.length === 0 && (
                  <div className="bubble"><span className="loading-dots">Thinking</span></div>
                )}
                {m.done && (
                  <>
                    <div className="bubble">{m.text}</div>
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

        {/* Map Tab - MapView always mounted, never remounts */}
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
          <div className="map-full" style={{ position: 'relative' }}>
            {hasNoItinerary && (
              <div className="welcome-overlay">
                <h2>No itinerary open</h2>
                <p>Open an itinerary from the Itinerary tab or start a new chat to plan one.</p>
              </div>
            )}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <h2>Itinerary #{detail.itinerary.id}</h2>
                  <button onClick={() => { const pts = detail.items.map(i => ({ name: i.place_name, lat: i.lat, lng: i.lng, category: i.category, day: i.day_number || 1 })); setCurrentPlaces(pts); setDayFilter(null); setTab('map'); }} style={{ background: '#0070f3', border: 'none', color: 'white', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: '.85rem' }}>
                    Show on Map
                  </button>
                </div>
                <div className="detail-meta">{detail.items.length} stops · {new Date(detail.itinerary.created_at).toLocaleString()}</div>
                {detail.itinerary.user_text && <div className="detail-prompt">"{detail.itinerary.user_text}"</div>}
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

        {/* Places Tab */}
        <div className={`tab-content map-tab ${tab === 'places' ? 'active' : ''}`} style={{ display: tab === 'places' ? 'flex' : 'none' }}>
          <div className="map-day-filters" style={{ justifyContent: 'center', color: '#555', fontSize: '.9rem' }}>
            All Saved Places ({placesTotal})
          </div>
          {placesView === 'map' ? (
            <div className="map-full" style={{ position: 'relative' }}>
              {placesLoading && <div className="welcome-overlay"><p>Loading places...</p></div>}
              {!placesLoading && storedPlaces.length === 0 && <div className="welcome-overlay"><h2>No places saved</h2></div>}
              <MapView
                markers={storedPlaces.map((p: any, i: number) => ({ lat: p.lat, lng: p.lng, label: `${i+1}. ${p.name}${p.category ? ` (${p.category})` : ''}`, category: p.category, day: 1 }))}
                routes={[]}
              />
            </div>
          ) : (
            <div className="itinerary-tab" style={{ flex: 1, overflow: 'auto', padding: 12 }}>
              {placesLoading && <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>Loading places...</div>}
              {!placesLoading && storedPlaces.length === 0 && <div className="welcome"><h2>No places saved</h2></div>}
              {storedPlaces.map((p: any) => (
                <div key={p.id} style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                  <div style={{ fontWeight: 500, fontSize: '.9rem' }}>{p.name}</div>
                  <div style={{ fontSize: '.8rem', color: '#888', marginTop: 2 }}>{p.category || 'uncategorized'} · {p.lat?.toFixed(4)}, {p.lng?.toFixed(4)}</div>
                  {p.description && <div style={{ fontSize: '.82rem', color: '#444', marginTop: 6, lineHeight: 1.4 }}>{p.description}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'chat' ? 'active' : ''}`} onClick={() => setTab('chat')}>Chat</button>
        <button className={`tab ${tab === 'map' ? 'active' : ''}`} onClick={() => setTab('map')}>Map</button>
        <button className={`tab ${tab === 'itinerary' ? 'active' : ''}`} onClick={() => { if (!detail && currentItineraryId) fetchDetail(currentItineraryId); setTab('itinerary'); }}>Itinerary</button>
        <button className={`tab ${tab === 'places' ? 'active' : ''}`} onClick={() => { setPlacesView('map'); setTab('places'); }}>Places</button>
      </div>
    </div>
  );
}
