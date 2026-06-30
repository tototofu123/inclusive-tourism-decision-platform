const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const DB_PATH = path.resolve(process.env.DB_PATH || path.join(__dirname, 'mvp.sqlite'));

let db = null;

async function getDb() {
  if (db) return db;
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
    // Run schema
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    db.run(schema);
    db.run("PRAGMA journal_mode=WAL");
    saveDb();
  }
  return db;
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

const api = {
  async prepare(sql) {
    const d = await getDb();
    return d.prepare(sql);
  },
  async run(sql, params = []) {
    const d = await getDb();
    d.run(sql, params);
    saveDb();
  },
  async get(sql, params = []) {
    const d = await getDb();
    const stmt = d.prepare(sql);
    if (params.length) stmt.bind(params);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row;
    }
    stmt.free();
    return null;
  },
  async all(sql, params = []) {
    const d = await getDb();
    const stmt = d.prepare(sql);
    if (params.length) stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  },
  async exec(sql) {
    const d = await getDb();
    d.exec(sql);
    saveDb();
  },
  async insert(sql, params = []) {
    const d = await getDb();
    d.run(sql, params);
    saveDb();
    const stmt = d.prepare('SELECT last_insert_rowid() as id');
    stmt.step();
    const id = stmt.getAsObject().id;
    stmt.free();
    return id;
  },
};

module.exports = api;
