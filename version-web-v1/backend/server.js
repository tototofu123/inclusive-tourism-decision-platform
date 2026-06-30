require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/places', require('./routes/places'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/itinerary', require('./routes/itinerary'));

app.get('/health', (req, res) => res.json({ status: 'ok', version: 'web-v1' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 Web v1 Backend running at http://localhost:${PORT}`);
  console.log(`   llama.cpp: ${process.env.LLAMA_BASE_URL || 'http://localhost:8080'}`);
  console.log(`   PostgreSQL: ${process.env.PG_HOST}:${process.env.PG_PORT}/${process.env.PG_DATABASE}`);
});
