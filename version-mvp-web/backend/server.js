require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/places', require('./routes/places'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/itinerary', require('./routes/itinerary'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', version: 'mvp-web' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 MVP Backend running at http://localhost:${PORT}`);
  console.log(`   llama.cpp endpoint: ${process.env.LLAMA_BASE_URL || 'http://localhost:8080'}`);
  console.log(`   DB: ${process.env.DB_PATH || './db/mvp.sqlite'}\n`);
});
