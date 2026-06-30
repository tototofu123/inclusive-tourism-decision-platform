// Singleton SQLite connection
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'mvp.sqlite');

// Auto-init schema if DB doesn't exist
const dbExists = fs.existsSync(DB_PATH);
const db = new Database(DB_PATH);

if (!dbExists) {
  console.log('📦 First run — creating SQLite schema...');
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
  console.log('✅ Schema created. Run: npm run seed');
}

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

module.exports = db;
