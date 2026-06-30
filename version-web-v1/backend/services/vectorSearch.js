const pg = require('../db/pg');

async function searchSimilar(text, { limit = 8, minScore = 60, mobilityType, district } = {}) {
  let embedding = null;
  try {
    const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
    const baseUrl = process.env.LLAMA_BASE_URL || 'http://localhost:8080';
    const resp = await fetch(`${baseUrl}/v1/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'local-model', input: text })
    });
    if (resp.ok) {
      const data = await resp.json();
      embedding = data.data?.[0]?.embedding;
    }
  } catch { /* fallback */ }

  if (embedding) {
    let sql = `SELECT *, (embedding <=> $1::vector) AS distance FROM places WHERE accessibility_score >= $2 AND embedding IS NOT NULL`;
    const params = [`[${embedding.join(',')}]`, minScore];
    let idx = 3;
    if (district) { sql += ` AND district = $${idx++}`; params.push(district); }
    if (mobilityType === 'wheelchair') {
      sql += ' AND has_ramp = true AND has_accessible_toilet = true';
    }
    sql += ' ORDER BY distance ASC LIMIT $' + idx;
    params.push(limit);
    const rows = await pg.all(sql, params);
    rows.forEach(r => r.similarity = Math.round((1 - r.distance) * 100));
    return rows;
  }

  // Fallback: text-based with keyword matching — each keyword gets its own $N
  const keywords = text.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  let sql = 'SELECT * FROM places WHERE accessibility_score >= $1';
  const params = [minScore];
  let idx = 2;

  if (district) { sql += ` AND district = $${idx++}`; params.push(district); }
  if (mobilityType === 'wheelchair') {
    sql += ' AND has_ramp = true AND has_accessible_toilet = true';
  }

  if (keywords.length) {
    const kwClauses = keywords.map(kw => {
      const i = idx++;
      params.push(`%${kw}%`);
      return `(LOWER(name) LIKE $${i} OR LOWER(notes) LIKE $${i} OR LOWER(category) LIKE $${i})`;
    });
    sql += ` AND (${kwClauses.join(' OR ')})`;
  }

  sql += ' ORDER BY accessibility_score DESC LIMIT $' + idx;
  params.push(limit);
  return await pg.all(sql, params);
}

module.exports = { searchSimilar };
