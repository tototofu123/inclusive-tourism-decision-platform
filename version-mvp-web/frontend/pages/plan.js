import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import ChatInput from '../components/ChatInput';
import ItineraryCard from '../components/ItineraryCard';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function PlanPage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const sid = localStorage.getItem('session_id');
    if (!sid) router.push('/');
    else setSessionId(sid);
  }, []);

  const handleRequest = async (userRequest) => {
    setLoading(true);
    setError(null);
    setPlan(null);

    try {
      const res = await fetch(`${API}/api/itinerary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          user_request: userRequest,
          duration_hours: 4
        })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setPlan(data.plan);
      setHistory(h => [{ request: userRequest, plan: data.plan }, ...h].slice(0, 5));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.push('/')} className="text-gray-400 hover:text-gray-600 text-lg">←</button>
        <div className="flex-1">
          <h1 className="font-semibold text-gray-900 text-sm">Plan Your Trip ♿</h1>
          <p className="text-xs text-gray-500">Powered by llama.cpp · local AI</p>
        </div>
        <div className="w-2 h-2 rounded-full bg-green-400" title="Backend connected" />
      </div>

      <div className="max-w-2xl mx-auto p-4">
        {/* Chat Input */}
        <div className="card mb-5">
          <ChatInput onSubmit={handleRequest} loading={loading} />
        </div>

        {/* Loading */}
        {loading && (
          <div className="card text-center py-10">
            <div className="text-3xl mb-3 animate-spin inline-block">⏳</div>
            <p className="text-gray-600 font-medium">Planning your accessible itinerary...</p>
            <p className="text-xs text-gray-400 mt-1">llama.cpp is thinking</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
            <p className="text-red-700 font-medium text-sm">⚠️ Error</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
            <p className="text-xs text-gray-500 mt-2">Is llama.cpp running on port 8080?</p>
          </div>
        )}

        {/* Plan Result */}
        {plan && !loading && (
          <div>
            {/* Header */}
            <div className="card mb-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🗺️</span>
                <div>
                  <h2 className="font-bold text-gray-900">{plan.title}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{plan.duration} · {plan.accessibility_level}</p>
                </div>
              </div>
            </div>

            {/* Stops */}
            {plan.parse_error ? (
              <div className="card">
                <p className="text-sm text-yellow-700 font-medium">⚠️ AI returned unstructured response:</p>
                <pre className="text-xs text-gray-600 mt-2 whitespace-pre-wrap">{plan.raw_text}</pre>
              </div>
            ) : (
              <div>
                {plan.stops?.map((stop, i) => (
                  <ItineraryCard key={i} stop={stop} isLast={i === plan.stops.length - 1} />
                ))}
              </div>
            )}

            {/* Tips */}
            {plan.tips?.length > 0 && (
              <div className="card mt-4">
                <h3 className="font-semibold text-sm text-gray-800 mb-2">💡 Accessibility Tips</h3>
                <ul className="space-y-1">
                  {plan.tips.map((tip, i) => (
                    <li key={i} className="text-sm text-gray-600 flex gap-2">
                      <span className="text-green-500 flex-shrink-0">✓</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!plan && !loading && !error && (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-3">🗺️</div>
            <p className="font-medium">Describe where you want to go</p>
            <p className="text-sm mt-1">The AI will plan an accessible route for you</p>
          </div>
        )}
      </div>
    </div>
  );
}
