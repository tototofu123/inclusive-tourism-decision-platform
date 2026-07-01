import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const COLORS: Record<string, string> = {
  museum: '#e74c3c', cafe: '#e67e22', restaurant: '#e67e22', park: '#27ae60',
  temple: '#9b59b6', shopping_mall: '#3498db', viewpoint: '#f39c12',
  market: '#d35400', art_gallery: '#1abc9c', historic_site: '#8e44ad',
};

const KOWLOON_CENTER: [number, number] = [22.31, 114.17];

export default function MapView({
  markers, routes, className,
}: {
  markers: { lat: number; lng: number; label: string; category?: string; day?: number }[];
  routes: { from: [number, number]; to: [number, number]; geometry?: any; distance: number }[];
  className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayer = useRef<L.LayerGroup | null>(null);
  const routeLayer = useRef<L.LayerGroup | null>(null);
  const userInteracted = useRef(false);
  const markersKey = useRef('');

  useEffect(() => {
    if (!el.current || mapRef.current) return;
    const map = L.map(el.current, { center: KOWLOON_CENTER, zoom: 13 });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);
    map.on('moveend', () => { userInteracted.current = true; });
    map.on('zoomend', () => { userInteracted.current = true; });
    mapRef.current = map;
    markerLayer.current = L.layerGroup().addTo(map);
    routeLayer.current = L.layerGroup().addTo(map);
    setTimeout(() => map.invalidateSize(), 100);
    return () => { map.remove(); mapRef.current = null; markerLayer.current = null; routeLayer.current = null; userInteracted.current = false; };
  }, []);

  useEffect(() => {
    const ml = markerLayer.current, rl = routeLayer.current, map = mapRef.current;
    if (!ml || !rl || !map) return;
    map.invalidateSize();
    ml.clearLayers();
    rl.clearLayers();

    const newKey = markers.map(m => `${m.lat},${m.lng}`).join('|');
    const markersChanged = newKey !== markersKey.current;
    markersKey.current = newKey;

    if (markers.length === 0 && routes.length === 0) {
      if (!userInteracted.current) map.setView(KOWLOON_CENTER, 13);
      return;
    }

    const bounds = L.latLngBounds([]);

    markers.forEach((m, idx) => {
      if (m.lat === undefined || m.lng === undefined) return;
      const color = COLORS[m.category || ''] || '#0070f3';
      const icon = L.divIcon({
        className: '',
        html: `<div style="background:${color};color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,.3)">${idx + 1}</div>`,
        iconSize: [28, 28], iconAnchor: [14, 14],
      });
      const popup = m.day
        ? `<b>${m.label}</b><br/><span style="color:#0070f3;font-size:.85rem">Day ${m.day}</span>`
        : `<b>${m.label}</b>`;
      const marker = L.marker([m.lat, m.lng], { icon }).bindPopup(popup);
      ml.addLayer(marker);
      bounds.extend(marker.getLatLng());
    });

    routes.forEach(r => {
      if (r.geometry?.coordinates?.length) {
        const coords = r.geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);
        const poly = L.polyline(coords, { color: '#0070f3', weight: 3, opacity: 0.7 });
        rl.addLayer(poly);
        coords.forEach((c: [number, number]) => bounds.extend(c));
      } else {
        const poly = L.polyline([r.from, r.to], { color: '#0070f3', weight: 2, opacity: 0.4, dashArray: '8,8' });
        rl.addLayer(poly);
        bounds.extend(r.from); bounds.extend(r.to);
      }
    });

    if (bounds.isValid() && (!userInteracted.current || markersChanged)) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [markers, routes]);

  return <div ref={el} className={className} style={{ height: '100%', width: '100%' }} />;
}
