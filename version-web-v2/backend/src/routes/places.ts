import { Router } from 'express';
import { Pool } from 'pg';

export const placesRouter = Router();

let _pool: Pool | null = null;
function getPool() {
  if (!_pool) _pool = new Pool({ connectionString: process.env.ALLOYDB_CONNECTION_STRING });
  return _pool;
};

placesRouter.get('/', async (req, res) => {
  const { location, tags } = req.query;
  try {
    if (process.env.VERTEX_AI_ENABLED === 'true') {
      const tagArr = tags ? String(tags).split(',') : [];
      const pool = getPool();
      const { rows } = await pool.query(
        `SELECT place_id, name, address, accessibility_tags, city
         FROM places
         WHERE ($1::text IS NULL OR city = $1)
           AND ($2::text[] = '{}' OR accessibility_tags && $2)
         ORDER BY name LIMIT 50`,
        [location || null, tagArr]
      );
      res.json(rows);
    } else {
      // Local fallback: return static seed data
      res.json([{ placeId: 'local-001', name: 'Local Fallback Place', address: String(location || 'Unknown'), accessibilityTags: [] }]);
    }
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
