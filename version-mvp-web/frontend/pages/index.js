import { useState } from 'react';
import { useRouter } from 'next/router';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function Home() {
  const router = useRouter();
  const [form, setForm] = useState({
    mobility_type: 'standard',
    needs_frequent_rest: false,
    dietary_tags: [],
    language: 'en'
  });
  const [saving, setSaving] = useState(false);

  const mobilityOptions = [
    { value: 'wheelchair', label: '♿ Wheelchair user', desc: 'Requires ramps, lifts, accessible toilets' },
    { value: 'walker', label: '🦯 Walker / mobility aid', desc: 'Can manage short gentle slopes' },
    { value: 'slow_walker', label: '🚶 Slow walker', desc: 'Needs more time, prefers flat routes' },
    { value: 'standard', label: '👤 Standard mobility', desc: 'No specific constraints' },
  ];

  const dietaryOptions = ['Halal', 'Vegetarian', 'Vegan', 'Gluten-free', 'No shellfish'];

  const toggleDiet = (tag) => {
    setForm(f => ({
      ...f,
      dietary_tags: f.dietary_tags.includes(tag)
        ? f.dietary_tags.filter(t => t !== tag)
        : [...f.dietary_tags, tag]
    }));
  };

  const handleStart = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('session_id', data.session_id);
        router.push('/plan');
      }
    } catch (err) {
      alert('Could not connect to backend. Is it running on port 3001?');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">♿🗺️</div>
          <h1 className="text-2xl font-bold text-gray-900">Inclusive Tourism HK</h1>
          <p className="text-gray-500 mt-1">Accessible itinerary planner · MVP</p>
        </div>

        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-4">Tell us about your needs</h2>

          {/* Mobility type */}
          <div className="mb-5">
            <label className="text-sm font-medium text-gray-700 block mb-2">Mobility type</label>
            <div className="grid grid-cols-1 gap-2">
              {mobilityOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setForm(f => ({ ...f, mobility_type: opt.value }))}
                  className={`text-left p-3 rounded-lg border-2 transition-colors ${
                    form.mobility_type === opt.value
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-sm">{opt.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Rest stops */}
          <div className="mb-5">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.needs_frequent_rest}
                onChange={e => setForm(f => ({ ...f, needs_frequent_rest: e.target.checked }))}
                className="w-4 h-4 accent-green-500"
              />
              <div>
                <div className="text-sm font-medium text-gray-700">I need frequent rest stops</div>
                <div className="text-xs text-gray-500">Itinerary will include rest areas every ~45 min</div>
              </div>
            </label>
          </div>

          {/* Dietary */}
          <div className="mb-6">
            <label className="text-sm font-medium text-gray-700 block mb-2">Dietary needs (optional)</label>
            <div className="flex flex-wrap gap-2">
              {dietaryOptions.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleDiet(tag)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    form.dietary_tags.includes(tag)
                      ? 'bg-green-500 text-white border-green-500'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleStart} disabled={saving} className="btn-primary w-full">
            {saving ? 'Setting up...' : 'Start Planning →'}
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Running locally · PostgreSQL + pgvector · No data sent to cloud
        </p>
      </div>
    </div>
  );
}
