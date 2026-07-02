import { query } from './src/db/client';
import { embedText } from './src/services/ragService';

async function main() {
  console.log('Fetching places without embeddings...');
  const rows = await query('SELECT id, name, COALESCE(description, category, name) as desc_text FROM places WHERE embedding IS NULL');
  console.log(`Found ${rows.rows.length} places to embed`);

  for (let i = 0; i < rows.rows.length; i++) {
    const p = rows.rows[i];
    const text = `${p.name} ${p.desc_text || ''}`;
    console.log(`[${i + 1}/${rows.rows.length}] ${p.name}...`);
    try {
      const embedding = await embedText(text);
      await query('UPDATE places SET embedding = $1 WHERE id = $2', [JSON.stringify(embedding), p.id]);
    } catch (err: any) {
      console.error(`  Failed: ${err.message}`);
    }
  }
  console.log('Done.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
