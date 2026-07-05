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
  costSummary?: { totalTransport: number; totalEntry: number; totalAll: number; confirmedCount?: number };
}

export default function ItineraryPanel({
  detailLoading, detail, currentItineraryId,
  confirmItinerary, unlockItinerary, setCurrentPlaces, setDayFilter, setTab,
  walkTime, fmtDist,
}: {
  detailLoading: boolean; detail?: ItineraryDetail | null; currentItineraryId?: number;
  confirmItinerary: (id: number) => void; unlockItinerary: (id: number) => void;
  setCurrentPlaces: (v: any[]) => void; setDayFilter: (v: number | null) => void; setTab: (tab: 'chat' | 'map' | 'itinerary') => void;
  walkTime: (m: number, mobility?: string) => string; fmtDist: (m: number) => string;
}) {
  if (detailLoading) {
    return <div className="detail-loading"><div className="spinner" /><p>Loading itinerary…</p></div>;
  }

  if (!detailLoading && !detail && currentItineraryId) {
    return <div className="detail-loading"><p>Loading itinerary…</p></div>;
  }

  if (!detailLoading && !detail && !currentItineraryId) {
    return <div className="welcome"><h2>No itinerary active</h2><p>Ask me to plan a trip, or select one from the header.</p></div>;
  }

  if (!detail) return null;

  const days = [...new Set<number>(detail.items.map(i => i.day_number || 1))].sort();
  const scores: number[] = detail.items.map(i => i.accessibility_score).filter((s): s is number => s != null && s > 0);
  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  const scoreColor = avgScore != null ? (avgScore >= 4 ? '#27ae60' : avgScore >= 2 ? '#e67e22' : '#e74c3c') : '#888';
  const scoreLabel = avgScore != null ? (avgScore >= 4 ? 'Good' : avgScore >= 2 ? 'Limited' : 'Poor') : '';

  const showOnMap = () => {
    const pts = detail.items.map(i => ({ name: i.place_name, lat: i.lat, lng: i.lng, category: i.category, day: i.day_number || 1 }));
    setCurrentPlaces(pts); setDayFilter(null); setTab('map');
  };

  return (
    <div className="detail-view">
      <div className="detail-header">
        <div className="detail-hdr-row">
          <h2>
            Itinerary #{detail.itinerary.id}
            {detail.costSummary?.confirmedCount && detail.costSummary.confirmedCount > 0 ? (
              <span className="pinned-badge" style={{ marginLeft: '10px', fontSize: '0.8rem', background: '#27ae60', color: 'white', padding: '3px 10px', borderRadius: '12px', verticalAlign: 'middle', fontWeight: 'normal' }}>📌 Active & Pinned</span>
            ) : null}
          </h2>
          <button className="itin-header-showmap" onClick={showOnMap}>Show on Map</button>
        </div>
        <div className="detail-meta">{detail.items.length} stops · {new Date(detail.itinerary.created_at).toLocaleString()}</div>
        {detail.itinerary.user_text && <div className="detail-prompt">"{detail.itinerary.user_text}"</div>}
        {detail.costSummary && (
          <div className="detail-cost">Transport: HK${detail.costSummary.totalTransport} · Entry: HK${detail.costSummary.totalEntry} · Total: <strong>HK${detail.costSummary.totalAll}</strong></div>
        )}
        {avgScore != null && (
          <div className="detail-access" style={{ color: scoreColor }}>♿ Accessibility: {avgScore.toFixed(1)}/5 ({scoreLabel})</div>
        )}
        <div className="itin-header-actions">
          <button className="btn-confirm" onClick={() => confirmItinerary(detail.itinerary.id)}>✓ Confirm All</button>
          <button className="btn-unlock" onClick={() => unlockItinerary(detail.itinerary.id)}>Unlock</button>
        </div>
      </div>
      {days.map(day => {
        const dayItems = detail.items.filter(i => (i.day_number || 1) === day);
        const dayDist = dayItems.reduce((s, i) => s + (i.road_distance_meters || 0), 0);
        return (
          <div key={day} className="day-group">
            <div className="day-header">
              <span className="day-title">Day {day}</span>
              <span className="day-meta">{dayItems.length} stops · ~{walkTime(dayDist)} walking</span>
            </div>
            {dayItems.map((item, i) => (
              <div key={item.id} className="stop-card"
                onClick={() => { setCurrentPlaces([{ name: item.place_name, lat: item.lat, lng: item.lng, category: item.category, day: item.day_number || 1 }]); setDayFilter(null); setTab('map'); }}>
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
                    <span className={`access-badge-lvl ${item.accessibility_score >= 4 ? 'access-good' : item.accessibility_score >= 2 ? 'access-warn' : 'access-poor'}`}>
                      ♿ {item.accessibility_score}/5
                    </span>
                  )}
                  {item.accessibility_tags != null && item.accessibility_tags.length > 0 && (
                    <span className="access-tags">{(item.accessibility_tags as string[]).slice(0, 3).join(', ')}</span>
                  )}
                  {item.confirmed && <span className="confirmed-badge">✓ Confirmed</span>}
                  {(item.entry_cost || item.transport_cost) && (
                    <div className="stop-cost">
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
  );
}
