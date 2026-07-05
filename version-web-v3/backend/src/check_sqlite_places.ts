import Database from 'better-sqlite3';
import path from 'path';

async function run() {
  const dbPath = path.join(__dirname, '..', 'data', 'tourism.db');
  const db = new Database(dbPath);
  const total = db.prepare('SELECT COUNT(*) as c FROM places').get() as any;
  console.log('SQLite total places:', total.c);
  
  const categories = db.prepare("SELECT category, COUNT(*) as c FROM places GROUP BY category").all() as any[];
  console.log('SQLite categories breakdown:', categories);
  
  const nonTransit = db.prepare("SELECT COUNT(*) as c FROM places WHERE category NOT IN ('toilet', 'restroom', 'mtr', 'bus_stop', 'transit', 'bus')").get() as any;
  console.log('SQLite non-transit/toilet places:', nonTransit.c);
}
run().catch(console.error);
