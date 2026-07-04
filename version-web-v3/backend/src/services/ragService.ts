import { query } from '../db/client';

export async function searchBySemantic(queryText: string, topK = 5): Promise<any[]> {
  try {
    const words = queryText.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    if (words.length === 0) return [];
    const rows = await query(
      `SELECT id, name, lat, lng, description, category, region, accessibility_score, accessibility_tags,
        ts_rank(to_tsvector('english', COALESCE(name,'') || ' ' || COALESCE(description,'')), plainto_tsquery('english', $1)) AS rank
       FROM places
       WHERE to_tsvector('english', COALESCE(name,'') || ' ' || COALESCE(description,'')) @@ plainto_tsquery('english', $1)
       ORDER BY rank DESC LIMIT $2`,
      [queryText, topK]
    );
    return rows.rows.map(r => ({ ...r, similarity: r.rank || 0 }));
  } catch {
    try {
      const likePattern = queryText.toLowerCase().split(/\s+/).filter(t => t.length > 2).map(t => `%${t}%`);
      if (likePattern.length === 0) return [];
      const conditions = likePattern.map((_, i) => `(LOWER(name) LIKE $${i + 1} OR LOWER(COALESCE(description,'')) LIKE $${i + 1})`).join(' AND ');
      const rows = await query(
        `SELECT id, name, lat, lng, description, category, region, accessibility_score, accessibility_tags
         FROM places WHERE ${conditions} LIMIT $${likePattern.length + 1}`,
        [...likePattern, topK]
      );
      return rows.rows;
    } catch {
      return [];
    }
  }
}
