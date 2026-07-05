import { useRef, useEffect, useState, useCallback } from 'react';
import { useJsApiLoader, GoogleMap, Marker, InfoWindow, Polyline } from '@react-google-maps/api';

if (typeof window !== 'undefined') {
  const originalWarn = console.warn;
  console.warn = (...args) => {
    if (args[0] && typeof args[0] === 'string' && (args[0].includes('google.maps.Marker') || args[0].includes('deprecated'))) {
      return;
    }
    originalWarn(...args);
  };
}

const CONTAINER_STYLE = { height: '100%', width: '100%' };
const KOWLOON_CENTER = { lat: 22.31, lng: 114.17 };

const COLORS: Record<string, string> = {
  museum: '#e74c3c', cafe: '#e67e22', restaurant: '#e67e22', park: '#27ae60',
  temple: '#9b59b6', shopping_mall: '#3498db', viewpoint: '#f39c12',
  market: '#d35400', art_gallery: '#1abc9c', historic_site: '#8e44ad',
  restroom: '#7f8c8d', toilet: '#7f8c8d', hotel: '#2c3e50', attraction: '#16a085',
  transit: '#95a5a6', bus_stop: '#95a5a6', bus: '#95a5a6', mtr: '#95a5a6',
  landmark: '#34495e', beach: '#27ae60', amusement_park: '#e84393',
  library: '#1abc9c', entertainment: '#fd79a8', hospital: '#e74c3c', transport_hub: '#636e72',
};

const LEGEND_ITEMS = [
  { label: 'Museum', color: '#e74c3c' },
  { label: 'Cafe', color: '#e67e22' },
  { label: 'Restaurant', color: '#e67e22' },
  { label: 'Park/Beach', color: '#27ae60' },
  { label: 'Temple', color: '#9b59b6' },
  { label: 'Shopping', color: '#3498db' },
  { label: 'Viewpoint', color: '#f39c12' },
  { label: 'Market', color: '#d35400' },
  { label: 'Art Gallery', color: '#1abc9c' },
  { label: 'Historic Site', color: '#8e44ad' },
  { label: 'Hotel', color: '#2c3e50' },
  { label: 'Attraction', color: '#16a085' },
  { label: 'Restroom/Toilet', color: '#7f8c8d' },
  { label: 'Transit/Bus', color: '#95a5a6' },
  { label: 'Entertainment', color: '#fd79a8' },
  { label: 'Hospital', color: '#e74c3c' },
  { label: 'Transport Hub', color: '#636e72' },
  { label: 'Amusement Park', color: '#e84393' },
];

const API_KEY = process.env.NEXT_PUBLIC_MAPS_API_KEY || '';
const MAP_ID = process.env.NEXT_PUBLIC_MAPS_MAP_ID || '';

export default function GoogleMapView({
  markers, routes, className, accessibilityScores, accessibilityTags, onLoadError,
}: {
  markers: { lat: number; lng: number; label: string; category?: string; day?: number; type?: 'itinerary' | 'saved' }[];
  routes: { from: [number, number]; to: [number, number]; geometry?: any; distance: number }[];
  className?: string;
  accessibilityScores?: Map<string, number>;
  accessibilityTags?: Map<string, string[]>;
  onLoadError?: (err: any) => void;
}) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [zoom, setZoom] = useState(13);
  const mapRef = useRef<google.maps.Map | null>(null);
  const userInteracted = useRef(false);
  const prevKey = useRef('');
  const fitRequested = useRef(false);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: API_KEY,
    mapIds: MAP_ID ? [MAP_ID] : undefined,
  });

  useEffect(() => {
    if (loadError && onLoadError) {
      onLoadError(loadError);
    }
  }, [loadError, onLoadError]);

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    map.addListener('zoom_changed', () => {
      userInteracted.current = true;
      setZoom(map.getZoom() || 13);
    });
    map.addListener('dragend', () => { userInteracted.current = true; });
  }, []);

  // Fit bounds when markers change
  const newKey = markers.map(m => `${m.lat},${m.lng}`).join('|');
  const markersChanged = newKey !== prevKey.current;
  prevKey.current = newKey;

  useEffect(() => {
    const map = mapRef.current;
    if (!map || markers.length === 0) return;
    if (!userInteracted.current || markersChanged) {
      fitRequested.current = true;
      const bounds = new google.maps.LatLngBounds();
      let hasBounds = false;
      markers.forEach(m => {
        if (m.lat && m.lng) { bounds.extend({ lat: m.lat, lng: m.lng }); hasBounds = true; }
      });
      if (hasBounds) {
        map.fitBounds(bounds, 80);
        const listener = map.addListener('bounds_changed', () => {
          if (map.getZoom() && map.getZoom()! > 16) map.setZoom(16);
          google.maps.event.removeListener(listener);
        });
      }
    }
  }, [markers, markersChanged]);

  if (loadError) {
    return <div className={className} style={{ ...CONTAINER_STYLE, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e74c3c' }}>Failed to load Google Maps — check API key</div>;
  }

  if (!isLoaded) {
    return <div className={className} style={{ ...CONTAINER_STYLE, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>Loading map…</div>;
  }

  const zoomLevel = zoom || 13;

  const itinMarkers: typeof markers = [];
  const savedMarkers: typeof markers = [];
  markers.forEach(m => {
    if (m.type === 'saved') savedMarkers.push(m);
    else itinMarkers.push(m);
  });

  const allVisible = [...itinMarkers, ...savedMarkers];

  let itinCounter = 0;
  let savedCounter = 0;

  return (
    <div className={className} style={{ position: 'relative', ...CONTAINER_STYLE }}>
      <GoogleMap
        mapContainerStyle={CONTAINER_STYLE}
        center={KOWLOON_CENTER}
        zoom={13}
        onLoad={onLoad}
        options={{
          mapId: MAP_ID || undefined,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          zoomControl: true,
          styles: [
            { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
          ],
        }}
      >
        {allVisible.map((m, idx) => {
          if (!m.lat || !m.lng) return null;
          const key = `${m.lat},${m.lng}`;
          const isItin = m.type !== 'saved';
          const color = COLORS[m.category || ''] || '#0070f3';

          if (isItin) {
            itinCounter++;
            const tags = accessibilityTags?.get(key);
            return (
              <Marker
                key={`m-${idx}`}
                position={{ lat: m.lat, lng: m.lng }}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 18,
                  fillColor: color,
                  fillOpacity: 1,
                  strokeColor: '#fff',
                  strokeWeight: 3,
                  labelOrigin: new google.maps.Point(0, 0),
                }}
                label={{ text: String(itinCounter), color: '#fff', fontSize: '13px', fontWeight: 'bold' }}
                onClick={() => setSelectedIdx(idx)}
              >
                {selectedIdx === idx && (
                  <InfoWindow position={{ lat: m.lat, lng: m.lng }} onCloseClick={() => setSelectedIdx(null)}>
                    <div style={{ fontSize: '13px', lineHeight: 1.5 }}>
                      <b>{m.label}</b>
                      {m.day && <div style={{ color: '#0070f3', fontSize: '11px' }}>Day {m.day}</div>}
                      {tags?.length ? <div style={{ fontSize: '11px', color: '#555' }}>♿ {tags.slice(0, 3).join(' · ')}</div> : null}
                    </div>
                  </InfoWindow>
                )}
              </Marker>
            );
          }

          savedCounter++;
          return (
            <Marker
              key={`s-${idx}`}
              position={{ lat: m.lat, lng: m.lng }}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 15,
                fillColor: color,
                fillOpacity: 0.85,
                strokeColor: '#fff',
                strokeWeight: 3,
                labelOrigin: new google.maps.Point(0, 0),
              }}
              label={{ text: String(savedCounter), color: '#fff', fontSize: '11px', fontWeight: 'bold' }}
              title={m.label}
              onClick={() => setSelectedIdx(idx)}
            >
              {selectedIdx === idx && (
                <InfoWindow position={{ lat: m.lat, lng: m.lng }} onCloseClick={() => setSelectedIdx(null)}>
                  <div style={{ fontSize: '13px', lineHeight: 1.5 }}>
                    <b>{m.label}</b>
                    <div style={{ fontSize: '11px', color: '#666' }}>{(m.category || '').replace(/_/g, ' ')}</div>
                  </div>
                </InfoWindow>
              )}
            </Marker>
          );
        })}

        {routes.map((r, idx) => {
          if (r.geometry?.coordinates?.length) {
            const path = r.geometry.coordinates.map((c: number[]) => ({ lat: c[1], lng: c[0] }));
            return <Polyline key={`r-${idx}`} path={path} options={{ strokeColor: '#0070f3', strokeWeight: 3, strokeOpacity: 0.7 }} />;
          }
          return (
            <Polyline
              key={`r-${idx}`}
              path={[{ lat: r.from[0], lng: r.from[1] }, { lat: r.to[0], lng: r.to[1] }]}
              options={{ strokeColor: '#0070f3', strokeWeight: 2, strokeOpacity: 0.4 }}
            />
          );
        })}
      </GoogleMap>

      <div style={{
        position: 'absolute', bottom: 12, right: 12, background: 'white',
        padding: '8px 12px', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,.2)',
        fontSize: 12, lineHeight: 1.7, zIndex: 1000, maxHeight: 260, overflowY: 'auto',
      }}>
        <div style={{ fontWeight: 700, marginBottom: 2, fontSize: 13 }}>Legend</div>
        {LEGEND_ITEMS.map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: item.color, flexShrink: 0 }} />
            {item.label}
          </div>
        ))}
        <div style={{ marginTop: 4, fontSize: 10, color: '#888' }}>
          {itinMarkers.length > 0 ? `${itinMarkers.length} itinerary + ` : ''}{savedMarkers.length} places &bull; zoom for details
        </div>
      </div>
    </div>
  );
}
