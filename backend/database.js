// backend/database.js
// SQLite schema: users, bots, env_vars, audit_logs
// Uses better-sqlite3 for synchronous operations (Replit-friendly)

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'panel.db'));

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── SCHEMA ───────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    email       TEXT UNIQUE NOT NULL,
    password    TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'user',   -- 'admin' | 'user'
    created_at  TEXT DEFAULT (datetime('now')),
    active      INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS bots (
    id            TEXT PRIMARY KEY,              -- UUID
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    source        TEXT NOT NULL DEFAULT 'template', -- 'template' | 'github'
    github_url    TEXT,
    status        TEXT DEFAULT 'stopped',        -- 'running' | 'stopped' | 'crashed' | 'pending'
    phone         TEXT,                          -- linked WhatsApp number
    session_path  TEXT,                          -- path to session files
    created_at    TEXT DEFAULT (datetime('now')),
    approved      INTEGER DEFAULT 1,             -- 0 = pending admin approval (github bots)
    max_msg_rate  INTEGER DEFAULT 20             -- messages per minute limit
  );

  CREATE TABLE IF NOT EXISTS env_vars (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id  TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    key     TEXT NOT NULL,
    value   TEXT NOT NULL,
    UNIQUE(bot_id, key)
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER REFERENCES users(id),
    action     TEXT NOT NULL,
    target_id  TEXT,
    detail     TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// ─── SEED ADMIN ───────────────────────────────────────────────────────────────
// Admin account: ibraheemyakub48@gmail.com
// Password is set via ADMIN_PASSWORD env var or defaults to 'Admin@1234' (change on first login!)

const bcrypt = require('bcryptjs');
const ADMIN_EMAIL = 'ibraheemyakub48@gmail.com';
const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(ADMIN_EMAIL);
if (!existing) {
  const adminPass = process.env.ADMIN_PASSWORD || 'ibraheem123';
  const hash = bcrypt.hashSync(adminPass, 12);
  db.prepare(`INSERT INTO users (email, password, role) VALUES (?, ?, 'admin')`).run(ADMIN_EMAIL, hash);
  console.log(`[DB] Admin seeded: ${ADMIN_EMAIL}`);
}

module.exports = db;
