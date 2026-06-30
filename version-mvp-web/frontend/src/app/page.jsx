'use client';
import { useState } from 'react';
import PlannerForm from '../components/PlannerForm';
import ItineraryView from '../components/ItineraryView';
import PlacesMap from '../components/PlacesMap';

export default function Home() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handlePlan(formData) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">
          Plan Your Accessible Day in Hong Kong
        </h1>
        <p className="text-gray-500 max-w-xl mx-auto">
          Tell us what you'd like to do and your accessibility needs —
          our AI will build a step-by-step itinerary just for you.
        </p>
      </div>

      {/* Planner form */}
      <PlannerForm onSubmit={handlePlan} loading={loading} />

      {/* Error */}
      {error && (
        <div role="alert" className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ItineraryView result={result} />
          <PlacesMap
            itinerary={result.itinerary}
            suggestedPlaces={result.suggested_places || []}
          />
        </div>
      )}
    </div>
  );
}
