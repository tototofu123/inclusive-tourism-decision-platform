/**
 * cloudRag.ts
 *
 * Retrieves candidate places using semantic vector search.
 *
 * Primary:  Vertex AI Vector Search (ANN index over place embeddings)
 * Fallback: AlloyDB pgvector cosine similarity query
 *
 * Both return the same shape: { placeId, name, address, accessibilityTags, score }
 */

import { VertexAI } from '@google-cloud/vertexai';
import { Pool } from 'pg';

const PROJECT = process.env.VERTEX_PROJECT_ID!;
const LOCATION = process.env.VERTEX_LOCATION || 'us-central1';
const INDEX_ENDPOINT = process.env.VERTEX_VECTOR_INDEX_ENDPOINT!;
const DEPLOYED_INDEX_ID = process.env.VERTEX_DEPLOYED_INDEX_ID!;
const EMBED_MODEL = 'text-embedding-004';

let _pool: Pool | null = null;
function getPool() {
  if (!_pool) {
    _pool = new Pool({ connectionString: process.env.ALLOYDB_CONNECTION_STRING });
  }
  return _pool;
}

export interface RagQuery {
  query: string;
  mobilityTags: string[];
  location: string;
  topK: number;
}

export interface CandidatePlace {
  placeId: string;
  name: string;
  address: string;
  accessibilityTags: string[];
  score: number;
}

// Generate text embedding via Vertex AI
async function embedQuery(text: string): Promise<number[]> {
  const vertex = new VertexAI({ project: PROJECT, location: LOCATION });
  const model = vertex.preview.getGenerativeModel({ model: EMBED_MODEL });
  // @ts-ignore — embedContent is available but not typed in all SDK versions
  const resp = await model.embedContent({ content: { parts: [{ text }] } });
  return resp.embedding.values;
}

// Primary: Vertex AI Vector Search
async function queryVectorSearch(embedding: number[], topK: number): Promise<CandidatePlace[]> {
  // Uses Vertex AI Matching Engine REST API
  const url = `https://${INDEX_ENDPOINT}/v1/projects/${PROJECT}/locations/${LOCATION}/indexEndpoints/${DEPLOYED_INDEX_ID}:findNeighbors`;
  const body = {
    deployedIndexId: DEPLOYED_INDEX_ID,
    queries: [{ datapoint: { featureVector: embedding }, neighborCount: topK }],
  };
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GOOGLE_ACCESS_TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  const data = await resp.json() as any;
  return (data.nearestNeighbors?.[0]?.neighbors ?? []).map((n: any) => ({
    placeId: n.datapoint.datapointId,
    name: n.datapoint.restricts?.[0]?.name ?? '',
    address: '',
    accessibilityTags: [],
    score: n.distance,
  }));
}

// Fallback: AlloyDB pgvector
async function queryAlloyDb(
  embedding: number[],
  mobilityTags: string[],
  location: string,
  topK: number
): Promise<CandidatePlace[]> {
  const pool = getPool();
  const embeddingStr = `[${embedding.join(',')}]`;
  const { rows } = await pool.query(
    `SELECT place_id, name, address, accessibility_tags,
            (embedding <=> $1::vector) AS score
     FROM places
     WHERE city = $2
       AND accessibility_tags && $3
     ORDER BY score ASC
     LIMIT $4`,
    [embeddingStr, location, mobilityTags, topK]
  );
  return rows.map((r) => ({
    placeId: r.place_id,
    name: r.name,
    address: r.address,
    accessibilityTags: r.accessibility_tags,
    score: r.score,
  }));
}

export async function queryCandidatePlaces(query: RagQuery): Promise<CandidatePlace[]> {
  console.log(`  [rag] embedding query: "${query.query.slice(0, 50)}"`);
  const embedding = await embedQuery(
    `${query.query} mobility: ${query.mobilityTags.join(' ')} location: ${query.location}`
  );

  try {
    const results = await queryVectorSearch(embedding, query.topK);
    console.log(`  [rag] ✓ Vector Search returned ${results.length} candidates`);
    return results;
  } catch (err) {
    console.warn('  [rag] Vector Search failed, trying AlloyDB:', (err as Error).message);
    const results = await queryAlloyDb(embedding, query.mobilityTags, query.location, query.topK);
    console.log(`  [rag] ✓ AlloyDB returned ${results.length} candidates`);
    return results;
  }
}
