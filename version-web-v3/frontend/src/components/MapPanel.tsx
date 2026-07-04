import dynamic from 'next/dynamic';

const MapView = dynamic(() => import('./MapView'), { ssr: false });

export default function MapPanel({
  tab, categoryFilter, setCategoryFilter, dayFilter, setDayFilter,
  detail, hasNoItinerary, storedPlaces, currentPlaces, mapRoutes,
}: {
  tab: string; categoryFilter: string | null; setCategoryFilter: (v: string | null) => void;
  dayFilter: number | null; setDayFilter: (v: number | null) => void;
  detail?: any; hasNoItinerary: boolean; storedPlaces: any[]; currentPlaces: any[]; mapRoutes: any[];
}) {
  const daysFromDetail = detail ? [...new Set<number>((detail.items || []).map((i: any) => i.day_number || 1))].sort() : [];

  const markers = (() => {
    const itinPlaces = (dayFilter !== null
      ? currentPlaces.filter((p: any) => p.day === undefined || p.day === dayFilter)
      : currentPlaces
    ).filter((p: any) => !categoryFilter || p.category === categoryFilter);
    const itinMarkers = itinPlaces.map((p: any) => ({
      lat: p.lat, lng: p.lng, label: `${p.name}${p.day ? ` (Day ${p.day})` : ''}`,
      category: p.category, day: p.day, type: 'itinerary' as const,
    }));

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
  })();

  return (
    <>
      <div className="map-day-filters">
        <div className="map-filter-row">
          <span className="map-filter-label">Category:</span>
          {['All', 'museum', 'cafe', 'park', 'temple', 'market', 'art_gallery', 'historic_site', 'viewpoint', 'shopping_mall', 'hotel'].map(cat => (
            <button key={cat}
              className={`map-day-btn ${categoryFilter === (cat === 'All' ? null : cat) ? 'active' : ''}`}
              onClick={() => setCategoryFilter(cat === 'All' ? null : cat)}>
              {cat === 'All' ? 'All' : cat.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
        {daysFromDetail.length > 0 && (
          <div className="map-filter-row">
            <span className="map-filter-label">Day:</span>
            <button className={`map-day-btn ${dayFilter === null ? 'active' : ''}`} onClick={() => setDayFilter(null)}>All Days</button>
            {daysFromDetail.map((d: number) => (
              <button key={d} className={`map-day-btn ${dayFilter === d ? 'active' : ''}`} onClick={() => setDayFilter(d)}>Day {d}</button>
            ))}
          </div>
        )}
      </div>
      <div className="map-full">
        {hasNoItinerary && storedPlaces.length === 0 && (
          <div className="welcome-overlay">
            <h2>No places to show</h2>
            <p>Open an itinerary from the Itinerary tab or start a new chat to plan one.</p>
          </div>
        )}
        <MapView markers={markers} routes={mapRoutes} />
      </div>
    </>
  );
}
