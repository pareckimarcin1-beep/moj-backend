const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('moja_baza.db');

db.serialize(() => {
    // Tabela użytkowników
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE,
            password TEXT
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
