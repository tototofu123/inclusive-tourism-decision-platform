import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
const { Client } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const client = new Client({
  user: 'postgres',
  database: 'inclusive_tourism_mvp',
});

await client.connect();
const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.sql')).sort();
for (const f of files) {
  const sql = fs.readFileSync(path.join(__dirname, f), 'utf8');
  try {
    await client.query(sql);
    console.log('Ran: ' + f);
  } catch (e) {
    if (e.message.includes('already exists')) console.log('Skip (exists): ' + f);
    else console.log('Err: ' + f + ' - ' + e.message.slice(0, 100));
  }
}
await client.end();
