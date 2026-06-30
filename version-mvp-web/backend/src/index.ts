process.on('uncaughtException', e => console.error('UNCAUGHT', e));
process.on('unhandledRejection', (e: any) => console.error('UNHANDLED', e));

import express from 'express';
import cors from 'cors';
import planRouter from './routes/plan';
import itineraryRouter from './routes/itinerary';
import chatRouter from './routes/chat';
import sessionsRouter from './routes/sessions';
import placesRouter from './routes/places';

const app = express();
const PORT = parseInt(process.env.PORT || '4000');

app.use(cors({ origin: true }));
app.use(express.json());
app.use(planRouter);
app.use(itineraryRouter);
app.use(chatRouter);
app.use(sessionsRouter);
app.use(placesRouter);
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => console.log(`MVP Backend on http://localhost:${PORT}`));
