'use client';
import { useState } from 'react';

const MOBILITY_OPTIONS = [
  { value: 'normal',      label: '🚶 No mobility constraint' },
  { value: 'slow_walk',   label: '🦯 Slow walker / tired easily' },
  { value: 'wheelchair',  label: '♿ Wheelchair user' },
];

const LANG_OPTIONS = [
  { value: 'en',    label: 'English' },
  { value: 'zh-HK', label: '繁體中文' },
  { value: 'zh-CN', label: '简体中文' },
];

export default function PlannerForm({ onSubmit, loading }) {
  const [message, setMessage] = useState('');
  const [mobility, setMobility] = useState('normal');
  const [needsRest, setNeedsRest] = useState(false);
  const [lang, setLang] = useState('en');

  // Use browser geolocation for location
  const [location, setLocation] = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);

  function getLocation() {
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoLoading(false);
      },
      () => {
        // Default to TST if denied
        setLocation({ lat: 22.2996, lng: 114.1717 });
        setGeoLoading(false);
      }
    );
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!message.trim()) return;
    onSubmit({
      message: message.trim(),
      userProfile: { mobility, needsRestFrequently: needsRest },
      location,
      lang,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5"
    >
      {/* Message */}
      <div>
        <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
          What would you like to do today?
        </label>
        <textarea
          id="message"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="e.g. Half-day sightseeing near Tsim Sha Tsui, I need somewhere to sit often and avoid steep hills."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          maxLength={1000}
          required
        />
        <p className="text-xs text-gray-400 mt-1">{message.length}/1000</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Mobility */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mobility</label>
          <select
            value={mobility}
            onChange={(e) => setMobility(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {MOBILITY_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Language */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {LANG_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Your location</label>
          <button
            type="button"
            onClick={getLocation}
            disabled={geoLoading}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
          >
            {geoLoading ? 'Getting...' : location ? `📍 ${location.lat.toFixed(3)}, ${location.lng.toFixed(3)}` : '📍 Use my location'}
          </button>
        </div>
      </div>

      {/* Rest toggle */}
      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
        <input
          type="checkbox"
          checked={needsRest}
          onChange={(e) => setNeedsRest(e.target.checked)}
          className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
        />
        I need frequent rest stops (every 15–20 mins)
      </label>

      <button
        type="submit"
        disabled={loading || !message.trim()}
        className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold rounded-lg px-4 py-3 text-sm transition-colors"
      >
        {loading ? 'Planning your day...' : 'Plan My Accessible Day →'}
      </button>
    </form>
  );
}
