const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '54322'),
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'postgres',
  database: process.env.PG_DATABASE || 'inclusive_tourism_v1',
});

pool.on('error', err => console.error('PG pool error:', err.message));

async function query(text, params) {
  const result = await pool.query(text, params);
  return result;
}

async function get(text, params) {
  const result = await pool.query(text, params);
  return result.rows[0] || null;
}

async function all(text, params) {
  const result = await pool.query(text, params);
  return result.rows;
}

async function insert(text, params) {
  const result = await pool.query(text, params);
  return result.rows[0]?.id || null;
}

async function exec(text) {
  await pool.query(text);
}

async function initSchema() {
  const fs = require('fs');
  const schemaFile = path.join(__dirname, 'schema_v1.sql');
  if (fs.existsSync(schemaFile)) {
    const sql = fs.readFileSync(schemaFile, 'utf8');
    await pool.query(sql);
    console.log('PG schema initialized');
  }
}

async function close() {
  await pool.end();
}

module.exports = { query, get, all, insert, exec, initSchema, close, pool };
