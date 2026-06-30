'use client';

const TAG_LABELS = {
  wheelchair:       { label: 'Wheelchair',      bg: 'bg-blue-100   text-blue-700'   },
  bench:            { label: 'Seating',          bg: 'bg-green-100  text-green-700'  },
  lift:             { label: 'Lift',             bg: 'bg-purple-100 text-purple-700' },
  accessible_toilet:{ label: 'Accessible WC',   bg: 'bg-yellow-100 text-yellow-700' },
  flat_surface:     { label: 'Flat surface',     bg: 'bg-teal-100   text-teal-700'   },
  shaded:           { label: 'Shaded',           bg: 'bg-orange-100 text-orange-700' },
  free_entry:       { label: 'Free entry',       bg: 'bg-gray-100   text-gray-700'   },
  mobility_rental:  { label: 'Mobility rental',  bg: 'bg-pink-100   text-pink-700'   },
};

function Tag({ tag }) {
  const info = TAG_LABELS[tag] || { label: tag, bg: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${info.bg}`}>
      {info.label}
    </span>
  );
}

export default function ItineraryView({ result }) {
  const { summary, itinerary = [], suggested_places = [] } = result;

  return (
    <div className="space-y-5">
      {/* Summary */}
      {summary && (
        <div className="bg-brand-50 border border-brand-100 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-brand-700 mb-1">Today's Plan</h2>
          <p className="text-sm text-gray-700">{summary}</p>
        </div>
      )}

      {/* Itinerary */}
      {itinerary.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Itinerary</h2>
          <ol className="space-y-3">
            {itinerary.map((stop, i) => (
              <li key={i} className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </div>
                <div className="flex-1 bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="font-medium text-sm text-gray-900">{stop.place_name}</span>
                    {stop.time && (
                      <span className="text-xs text-gray-400 whitespace-nowrap">{stop.time}</span>
                    )}
                  </div>
                  {stop.description && (
                    <p className="text-xs text-gray-600 mb-2">{stop.description}</p>
                  )}
                  {stop.accessibility_tags && stop.accessibility_tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {stop.accessibility_tags.map(t => <Tag key={t} tag={t} />)}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Suggested places from DB */}
      {suggested_places.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Nearby Accessible Places</h2>
          <div className="space-y-2">
            {suggested_places.map(p => (
              <div key={p.id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                <div className="font-medium text-sm text-gray-900">{p.name}</div>
                {p.address && <div className="text-xs text-gray-500 mt-0.5">{p.address}</div>}
                {p.description && <p className="text-xs text-gray-600 mt-1">{p.description}</p>}
                {p.accessibility_tags && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {p.accessibility_tags.map(t => <Tag key={t} tag={t} />)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
