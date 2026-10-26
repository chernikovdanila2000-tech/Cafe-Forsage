const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'school.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    phone         TEXT,
    password_hash TEXT NOT NULL,
    level         TEXT NOT NULL DEFAULT 'A1',
    is_admin      INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product    TEXT NOT NULL,
    lessons    INTEGER NOT NULL,
    amount     INTEGER NOT NULL,
    status     TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    paid_at    TEXT
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    held_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS requests (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    contact    TEXT NOT NULL,
    message    TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Таблиці старої версії сайту (уроки за темами) більше не потрібні.
db.exec('DROP TABLE IF EXISTS progress; DROP TABLE IF EXISTS payments; DROP TABLE IF EXISTS lessons;');

// ---------- Пароли ----------

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

// ---------- Пользователи ----------

const users = {
  create({ name, email, phone, password, level, isAdmin = false }) {
    const result = db
      .prepare('INSERT INTO users (name, email, phone, password_hash, level, is_admin) VALUES (?, ?, ?, ?, ?, ?)')
      .run(name, email.toLowerCase(), phone || null, hashPassword(password), level || 'A1', isAdmin ? 1 : 0);
    return Number(result.lastInsertRowid);
  },
  byEmail(email) {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  },
  byId(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  },
  authenticate(email, password) {
    const user = this.byEmail(email);
    return user && verifyPassword(password, user.password_hash) ? user : null;
  },
  updateProfile(id, { name, phone, level }) {
    db.prepare('UPDATE users SET name = ?, phone = ?, level = ? WHERE id = ?').run(name, phone || null, level, id);
  },
  updatePassword(id, password) {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), id);
  },
  all() {
    return db.prepare(`
      SELECT u.*,
        (SELECT COALESCE(SUM(amount), 0) FROM orders o WHERE o.user_id = u.id AND o.status = 'paid') AS paid_total,
        (SELECT COALESCE(SUM(lessons), 0) FROM orders o WHERE o.user_id = u.id AND o.status = 'paid') AS lessons_bought,
        (SELECT COUNT(*) FROM attendance a WHERE a.user_id = u.id) AS lessons_held
      FROM users u ORDER BY u.created_at DESC
    `).all();
  },
};

// ---------- Сессии ----------

const SESSION_DAYS = 30;

const sessions = {
  create(userId) {
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+${SESSION_DAYS} days'))`)
      .run(token, userId);
    return token;
  },
  user(token) {
    if (!token) return null;
    return db.prepare(`
      SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token = ? AND s.expires_at > datetime('now')
    `).get(token) || null;
  },
  destroy(token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  },
  cleanup() {
    db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
  },
};

// ---------- Замовлення (разове заняття або абонемент) ----------

const orders = {
  create(userId, product) {
    // Не плодимо однакові неоплачені замовлення: повертаємо вже відкрите.
    const open = db.prepare("SELECT * FROM orders WHERE user_id = ? AND product = ? AND status = 'pending'").get(userId, product.id);
    if (open) return open;
    const result = db.prepare('INSERT INTO orders (user_id, product, lessons, amount) VALUES (?, ?, ?, ?)')
      .run(userId, product.id, product.lessons, product.price);
    return db.prepare('SELECT * FROM orders WHERE id = ?').get(result.lastInsertRowid);
  },
  byId(id) {
    return db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  },
  markPaid(id) {
    db.prepare("UPDATE orders SET status = 'paid', paid_at = datetime('now') WHERE id = ? AND status = 'pending'").run(id);
  },
  cancel(id) {
    db.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ? AND status = 'pending'").run(id);
  },
  forUser(userId) {
    return db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC, id DESC').all(userId);
  },
  all() {
    return db.prepare(`
      SELECT o.*, u.name AS user_name, u.email AS user_email, u.phone AS user_phone
      FROM orders o JOIN users u ON u.id = o.user_id
      ORDER BY (o.status = 'pending') DESC, o.created_at DESC, o.id DESC
    `).all();
  },
};

// ---------- Облік занять ----------

const lessons = {
  // Скільки занять оплачено, проведено й лишилося.
  balance(userId) {
    const bought = db.prepare("SELECT COALESCE(SUM(lessons), 0) AS n FROM orders WHERE user_id = ? AND status = 'paid'").get(userId).n;
    const held = db.prepare('SELECT COUNT(*) AS n FROM attendance WHERE user_id = ?').get(userId).n;
    return { bought, held, left: Math.max(bought - held, 0) };
  },
  markHeld(userId) {
    if (this.balance(userId).left > 0) db.prepare('INSERT INTO attendance (user_id) VALUES (?)').run(userId);
  },
  undoLast(userId) {
    db.prepare('DELETE FROM attendance WHERE id = (SELECT MAX(id) FROM attendance WHERE user_id = ?)').run(userId);
  },
};

// ---------- Заявки на пробный урок ----------

const requests = {
  create({ name, contact, message }) {
    db.prepare('INSERT INTO requests (name, contact, message) VALUES (?, ?, ?)').run(name, contact, message || null);
  },
  all() {
    return db.prepare('SELECT * FROM requests ORDER BY created_at DESC, id DESC').all();
  },
};

// ---------- Администратор ----------

function ensureAdmin() {
  const email = (process.env.ADMIN_EMAIL || 'admin@school.local').toLowerCase();
  const existing = users.byEmail(email);
  if (existing) {
    if (!existing.is_admin) db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(existing.id);
    if (process.env.ADMIN_PASSWORD) users.updatePassword(existing.id, process.env.ADMIN_PASSWORD);
    return;
  }
  const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
  users.create({ name: 'Адміністратор', email, password, level: 'C1', isAdmin: true });
  if (!process.env.ADMIN_PASSWORD) {
    console.log(`\n  Створено адміністратора: ${email}\n  Пароль: ${password}\n  (збережіть його — він показується один раз)\n`);
  }
}

module.exports = { db, users, sessions, orders, lessons, requests, ensureAdmin };
