import { Router, Request, Response } from 'express';
import { planTrip } from '../services/llmGateway';
import { resolveStops } from '../services/placeResolver';
import { getRoute } from '../services/routingService';
import { saveItinerary, saveItineraryItem } from '../db/client';

const router = Router();

router.post('/plan', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'Please provide a trip description' });
      return;
    }

    const llmPlan = await planTrip(text.trim());
    const places = await resolveStops(llmPlan.stops);
    const itineraryId = await saveItinerary(text.trim(), 'Kowloon');

    const stops: Array<{ label: string; placeId: number; startTime: string; endTime: string }> = [];
    let hour = 9;

    for (let i = 0; i < places.length; i++) {
      const p = places[i];
      const st = `${String(hour).padStart(2, '0')}:00`;
      hour += Math.ceil(p.duration / 60);
      const et = `${String(hour).padStart(2, '0')}:00`;

      let route = null;
      let dist = 0;
      if (i > 0) {
        const prev = places[i - 1];
        route = await getRoute(prev.lat, prev.lng, p.lat, p.lng);
        dist = route.distance_meters;
      }

      await saveItineraryItem({
        itinerary_id: itineraryId, place_id: p.placeId, stop_index: i, label: p.label,
        start_time: st, end_time: et, road_distance_meters: dist, duration_minutes: p.duration,
        route_geometry: route?.geometry,
      });
      stops.push({ label: p.label, placeId: p.placeId, startTime: st, endTime: et });
    }

    res.json({
      itineraryId,
      itinerary: { stops },
      places: places.map(p => ({ id: p.placeId, name: p.label, lat: p.lat, lng: p.lng })),
    });
  } catch (err) {
    console.error('Plan error:', err);
    res.status(500).json({ error: 'Failed to create itinerary. Please try a simpler description.' });
  }
});

export default router;
