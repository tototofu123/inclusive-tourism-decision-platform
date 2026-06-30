'use client';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useEffect } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet default marker icons in Next.js / webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const GREEN_ICON = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

// Default HK centre
const HK_CENTRE = [22.3193, 114.1694];

function AutoBounds({ markers }) {
  const map = useMap();
  useEffect(() => {
    if (markers.length > 0) {
      const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng]));
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [markers, map]);
  return null;
}

export default function LeafletMap({ itinerary, suggestedPlaces }) {
  // Build marker list — itinerary stops get green, suggested places get blue
  const allMarkers = [
    ...itinerary
      .filter(s => s.lat && s.lng)
      .map((s, i) => ({ lat: s.lat, lng: s.lng, label: `${i + 1}. ${s.place_name}`, desc: s.description, green: true })),
    ...suggestedPlaces
      .filter(p => p.lat && p.lng)
      .map(p => ({ lat: p.lat, lng: p.lng, label: p.name, desc: p.address, green: false })),
  ];

  return (
    <MapContainer
      center={HK_CENTRE}
      zoom={12}
      scrollWheelZoom
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {allMarkers.map((m, i) => (
        <Marker
          key={i}
          position={[m.lat, m.lng]}
          icon={m.green ? GREEN_ICON : new L.Icon.Default()}
        >
          <Popup>
            <strong>{m.label}</strong>
            {m.desc && <><br /><span className="text-xs text-gray-600">{m.desc}</span></>}
          </Popup>
        </Marker>
      ))}
      {allMarkers.length > 0 && <AutoBounds markers={allMarkers} />}
    </MapContainer>
  );
}
