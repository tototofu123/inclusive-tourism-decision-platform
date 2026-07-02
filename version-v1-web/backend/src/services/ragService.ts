import { query } from '../db/client';

let _pipeline: any = null;

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function getExtractor(): Promise<any> {
  if (!_pipeline) {
    const { pipeline } = await import('@xenova/transformers') as any;
    _pipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      quantized: true,
    });
  }
  return _pipeline;
}

export async function embedText(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const result = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(result.data) as number[];
}

export async function getCachedEmbedding(text: string): Promise<number[] | null> {
  try {
    const rows = await query(
      `SELECT embedding FROM places WHERE LOWER(name || ' ' || COALESCE(description, '')) LIKE $1 AND embedding IS NOT NULL LIMIT 1`,
      [`%${text.toLowerCase()}%`]
    );
    if (rows.rows.length > 0 && rows.rows[0].embedding) {
      return rows.rows[0].embedding as number[];
    }
  } catch { /* ignore */ }
  return null;
}

export async function searchBySemantic(queryText: string, topK = 5): Promise<any[]> {
  const queryVec = await embedText(queryText);

  const rows = await query(
    `SELECT id, name, lat, lng, description, category, region, accessibility_score, accessibility_tags, embedding
     FROM places WHERE embedding IS NOT NULL`
  );

  const scored = rows.rows
    .map((p: any) => ({
      ...p,
      similarity: cosineSimilarity(queryVec, p.embedding as number[]),
    }))
    .sort((a: any, b: any) => b.similarity - a.similarity)
    .slice(0, topK);

  return scored;
}
