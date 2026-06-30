import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
const MapView = dynamic(() => import('../../components/MapView'), { ssr: false });

export default function ItineraryPage() {
  const { query } = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!query.id) return;
    setLoading(true);
    fetch(`/api/itinerary/${query.id}`).then(r => { if (!r.ok) throw Error('Not found'); return r.json(); }).then(d => { setData(d); setLoading(false); }).catch(e => { setError(e.message); setLoading(false); });
  }, [query.id]);

  if (loading) return <div className="itinerary-page"><div className="loading">Loading...</div></div>;
  if (error) return <div className="itinerary-page"><div className="error">{error}</div><a href="/" className="back-link">← Back</a></div>;
  if (!data) return null;

  const items = data.items || [];
  const markers = items.map((i: any) => ({ lat: i.lat, lng: i.lng, label: `${i.stop_index+1}. ${i.place_name}`, category: i.category }));
  const routes: any[] = [];
  for (let i = 1; i < items.length; i++) {
    const prev = items[i-1], curr = items[i];
    routes.push({ from: [prev.lat, prev.lng] as [number, number], to: [curr.lat, curr.lng] as [number, number], geometry: curr.route_geometry_json, distance: curr.road_distance_meters });
  }

  return (
    <div className="itinerary-page">
      <a href="/" className="back-link">← Plan another trip</a>
      <div className="itinerary-header">
        <h1>Your Kowloon Itinerary</h1>
        <div className="meta">{items.length} stops &middot; {new Date(data.itinerary.created_at).toLocaleString()}</div>
      </div>
      <div className="itinerary-content">
        <div className="stops-list">
          {items.map((item: any, i: number) => (
            <div key={item.id} className="stop-card">
              <div className="stop-header"><span className="stop-name">{i+1}. {item.place_name}</span><span className="stop-time">{item.start_time||'?'} - {item.end_time||'?'}</span></div>
              {item.category && <div className="stop-detail">Category: {item.category}</div>}
              {item.description && <div className="stop-detail">{item.description}</div>}
              {item.duration_minutes > 0 && <div className="stop-detail">Duration: ~{item.duration_minutes} min</div>}
              {i > 0 && item.road_distance_meters > 0 && <div className="stop-distance">From previous: {item.road_distance_meters >= 1000 ? `${(item.road_distance_meters/1000).toFixed(1)} km` : `${item.road_distance_meters} m`}</div>}
            </div>
          ))}
        </div>
        <div className="map-container"><MapView markers={markers} routes={routes} /></div>
      </div>
    </div>
  );
}
