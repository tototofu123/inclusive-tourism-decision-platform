'use client';
import { useEffect, useState } from 'react';

/**
 * Leaflet map showing itinerary stops + suggested places.
 * Lazy-loaded because Leaflet needs window — cannot SSR.
 */
export default function PlacesMap({ itinerary = [], suggestedPlaces = [] }) {
  const [MapComponent, setMapComponent] = useState(null);

  useEffect(() => {
    // Dynamically import to avoid SSR issues with Leaflet
    import('./LeafletMap').then(mod => {
      setMapComponent(() => mod.default);
    });
  }, []);

  if (!MapComponent) {
    return (
      <div className="h-80 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center text-sm text-gray-400">
        Loading map...
      </div>
    );
  }

  return (
    <div className="h-80 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
      <MapComponent itinerary={itinerary} suggestedPlaces={suggestedPlaces} />
    </div>
  );
}
