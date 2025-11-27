const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'moja_baza.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Tabela użytkowników
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      password_hash TEXT,
      is_verified INTEGER DEFAULT 0,
      verification_token TEXT,
      verification_expires INTEGER
    )
  `);

  // Tabela bitów
  db.run(`
    CREATE TABLE IF NOT EXISTS beats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      title TEXT,
      price REAL,
      file_path TEXT
    )
  `);
});

module.exports = db;
