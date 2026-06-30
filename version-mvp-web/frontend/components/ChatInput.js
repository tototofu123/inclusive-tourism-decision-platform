import { useState } from 'react';

export default function ChatInput({ onSubmit, loading }) {
  const [value, setValue] = useState('');

  const examples = [
    'Plan a half-day accessible morning in Tsim Sha Tsui',
    'Wheelchair-friendly 3-hour route near Admiralty',
    'Easy walking tour with frequent rest stops in Central',
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!value.trim() || loading) return;
    onSubmit(value.trim());
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. Plan an accessible half-day in Tsim Sha Tsui..."
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm
                     focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
          disabled={loading}
        />
        <button type="submit" disabled={loading || !value.trim()} className="btn-primary">
          {loading ? '⏳ Planning...' : 'Plan →'}
        </button>
      </form>

      {/* Example prompts */}
      <div className="flex flex-wrap gap-2 mt-3">
        {examples.map((ex) => (
          <button
            key={ex}
            onClick={() => setValue(ex)}
            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-full transition-colors"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
