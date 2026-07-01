/**
 * Places Service
 * Queries the PostgreSQL database for nearby accessible places.
 * Schema: see database/migrate.js
 */
const { getPool } = require('../database/pool');

/**
 * Find places within radius using lat/lng bounding box (MVP - no PostGIS).
 * Approximation: 1 degree lat ≈ 111km, 1 degree lng ≈ 85km at HK latitude.
 */
async function findNearby({ lat, lng, radiusMeters = 1500, tags = [] }) {
  const pool = getPool();

  // Rough bounding box
  const latDelta = radiusMeters / 111000;
  const lngDelta = radiusMeters / 85000;

  let query;
  let params;

  if (tags.length === 0) {
    query = `
      SELECT id, name, category, lat, lng, accessibility_tags, address, description
      FROM places
      WHERE lat BETWEEN $1 AND $2
        AND lng BETWEEN $3 AND $4
      ORDER BY
        ABS(lat - $5) + ABS(lng - $6)
      LIMIT 20
    `;
    params = [lat - latDelta, lat + latDelta, lng - lngDelta, lng + lngDelta, lat, lng];
  } else {
    // Filter: all requested tags must appear in accessibility_tags array
    query = `
      SELECT id, name, category, lat, lng, accessibility_tags, address, description
      FROM places
      WHERE lat BETWEEN $1 AND $2
        AND lng BETWEEN $3 AND $4
        AND accessibility_tags @> $7::text[]
      ORDER BY
        ABS(lat - $5) + ABS(lng - $6)
      LIMIT 20
    `;
    params = [lat - latDelta, lat + latDelta, lng - lngDelta, lng + lngDelta, lat, lng, tags];
  }

  const result = await pool.query(query, params);
  return result.rows;
}

async function getById(id) {
  const pool = getPool();
  const result = await pool.query(
    'SELECT * FROM places WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

module.exports = { findNearby, getById };
