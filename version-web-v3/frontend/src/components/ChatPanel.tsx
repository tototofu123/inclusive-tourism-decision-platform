import { RefObject } from 'react';

interface ChatMsg {
  type: 'user' | 'bot';
  text?: string;
  thinking: string[];
  done?: boolean;
  places?: any[];
  itineraryId?: number;
  fakeUntil?: number;
}

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

export default function ChatPanel({
  msgs, loading, input, setInput, send,
  collapsedThinking, setCollapsedThinking, msgEnd,
  detail, currentItineraryId, fetchDetail, setTab, setCurrentPlaces, setDayFilter,
  confirmItinerary,
}: {
  msgs: ChatMsg[]; loading: boolean; input: string; setInput: (v: string) => void;
  send: (text: string) => Promise<void>;
  collapsedThinking: Set<number>; setCollapsedThinking: React.Dispatch<React.SetStateAction<Set<number>>>;
  msgEnd: RefObject<HTMLDivElement | null>; detail?: any; currentItineraryId?: number;
  fetchDetail: (id: number) => void; setTab: (tab: 'chat' | 'map' | 'itinerary') => void;
  setCurrentPlaces: (v: any[]) => void; setDayFilter: (v: number | null) => void;
  confirmItinerary: (id: number) => void;
}) {
  return (
    <>
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
              {m.type === 'user' && <div className="bubble">{m.text}</div>}
              {m.done && (
                <>
                  <div className="bubble typewriter" dangerouslySetInnerHTML={{ __html: md(m.text || '') }} />
                  {m.text?.startsWith('Error:') && (
                    <button onClick={() => {
                      const userMsg = msgs.slice(0, i).filter(m => m.type === 'user').pop();
                      if (userMsg?.text) send(userMsg.text);
                    }}
                    className="btn-retry">
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
                      {m.itineraryId && (
                        <button className="action-btn primary" onClick={() => { confirmItinerary(m.itineraryId!); setTab('itinerary'); }}>
                          Use Itinerary #{m.itineraryId}
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
    </>
  );
}
