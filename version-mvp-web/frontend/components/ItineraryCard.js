// Renders a single stop in the itinerary
export default function ItineraryCard({ stop, isLast }) {
  return (
    <div className="relative pl-8">
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-3 top-8 bottom-0 w-0.5 bg-green-200" />
      )}

      {/* Timeline dot */}
      <div className="absolute left-1.5 top-1.5 w-3 h-3 rounded-full bg-green-500 ring-2 ring-white" />

      <div className="card mb-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <span className="text-xs font-semibold text-green-600 uppercase tracking-wide">
              Stop {stop.order} · {stop.time}
            </span>
            <h3 className="font-semibold text-gray-900 text-lg leading-tight mt-0.5">
              {stop.place_name}
            </h3>
            <p className="text-sm text-gray-500">{stop.district} · {stop.duration_minutes} min</p>
          </div>
          <span className="text-2xl flex-shrink-0">
            {stop.order === 1 ? '🚀' : stop.duration_minutes >= 60 ? '🏛️' : '☕'}
          </span>
        </div>

        {stop.activity && (
          <p className="text-sm text-gray-700 mb-2">{stop.activity}</p>
        )}

        {stop.accessibility_notes && (
          <div className="bg-green-50 rounded-lg p-3 mb-2">
            <p className="text-xs font-medium text-green-700 mb-1">♿ Accessibility</p>
            <p className="text-xs text-green-600">{stop.accessibility_notes}</p>
          </div>
        )}

        {stop.transit_to_next && !isLast && (
          <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
            <span>🚇</span>
            <span>{stop.transit_to_next}</span>
          </div>
        )}
      </div>
    </div>
  );
}
