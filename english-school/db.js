const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const lessons = require('./lessons');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'school.db');
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

  CREATE TABLE IF NOT EXISTS lessons (
    id          INTEGER PRIMARY KEY,
    slug        TEXT NOT NULL UNIQUE,
    module      TEXT NOT NULL,
    level       TEXT NOT NULL,
    title       TEXT NOT NULL,
    summary     TEXT NOT NULL,
    duration    INTEGER NOT NULL,
    price       INTEGER NOT NULL,
    is_free     INTEGER NOT NULL DEFAULT 0,
    theory      TEXT NOT NULL,
    vocabulary  TEXT NOT NULL,
    exercises   TEXT NOT NULL,
    position    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS payments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id  INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    amount     INTEGER NOT NULL,
    status     TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    paid_at    TEXT
  );

  CREATE TABLE IF NOT EXISTS progress (
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id    INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    completed_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, lesson_id)
  );

  CREATE TABLE IF NOT EXISTS requests (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    contact    TEXT NOT NULL,
    message    TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Уроки хранятся в lessons.js и синхронизируются с базой при каждом запуске.
const upsertLesson = db.prepare(`
  INSERT INTO lessons (id, slug, module, level, title, summary, duration, price, is_free, theory, vocabulary, exercises, position)
  VALUES (:id, :slug, :module, :level, :title, :summary, :duration, :price, :is_free, :theory, :vocabulary, :exercises, :position)
  ON CONFLICT(id) DO UPDATE SET
    slug = excluded.slug, module = excluded.module, level = excluded.level, title = excluded.title,
    summary = excluded.summary, duration = excluded.duration, price = excluded.price, is_free = excluded.is_free,
    theory = excluded.theory, vocabulary = excluded.vocabulary, exercises = excluded.exercises, position = excluded.position
`);
lessons.forEach((l, i) => {
  upsertLesson.run({
    id: l.id,
    slug: l.slug,
    module: l.module,
    level: l.level,
    title: l.title,
    summary: l.summary,
    duration: l.duration,
    price: l.price,
    is_free: l.free ? 1 : 0,
    theory: l.theory,
    vocabulary: JSON.stringify(l.vocabulary),
    exercises: JSON.stringify(l.exercises),
    position: i,
  });
});

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
        (SELECT COUNT(*) FROM progress p WHERE p.user_id = u.id) AS completed,
        (SELECT COALESCE(SUM(amount), 0) FROM payments pm WHERE pm.user_id = u.id AND pm.status = 'paid') AS paid_total
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

// ---------- Уроки ----------

function parseLesson(row) {
  if (!row) return null;
  return { ...row, vocabulary: JSON.parse(row.vocabulary), exercises: JSON.parse(row.exercises) };
}

const lessonsRepo = {
  all() {
    return db.prepare('SELECT id, slug, module, level, title, summary, duration, price, is_free, position FROM lessons ORDER BY position').all();
  },
  byId(id) {
    return parseLesson(db.prepare('SELECT * FROM lessons WHERE id = ?').get(id));
  },
  // Список уроков со статусом для конкретного ученика.
  forUser(userId) {
    return db.prepare(`
      SELECT l.id, l.slug, l.module, l.level, l.title, l.summary, l.duration, l.price, l.is_free,
        EXISTS(SELECT 1 FROM payments p WHERE p.user_id = :uid AND p.lesson_id = l.id AND p.status = 'paid') AS paid,
        EXISTS(SELECT 1 FROM payments p WHERE p.user_id = :uid AND p.lesson_id = l.id AND p.status = 'pending') AS pending,
        EXISTS(SELECT 1 FROM progress pr WHERE pr.user_id = :uid AND pr.lesson_id = l.id) AS completed
      FROM lessons l ORDER BY l.position
    `).all({ uid: userId });
  },
  hasAccess(user, lesson) {
    if (lesson.is_free || user.is_admin) return true;
    return !!db.prepare("SELECT 1 FROM payments WHERE user_id = ? AND lesson_id = ? AND status = 'paid'").get(user.id, lesson.id);
  },
  complete(userId, lessonId) {
    db.prepare('INSERT OR IGNORE INTO progress (user_id, lesson_id) VALUES (?, ?)').run(userId, lessonId);
  },
};

// ---------- Платежи ----------

const payments = {
  create(userId, lessonId, amount) {
    // Не плодим одинаковые ожидающие платежи: переиспользуем открытый.
    const open = db.prepare("SELECT * FROM payments WHERE user_id = ? AND lesson_id = ? AND status = 'pending'").get(userId, lessonId);
    if (open) return open;
    const result = db.prepare('INSERT INTO payments (user_id, lesson_id, amount) VALUES (?, ?, ?)').run(userId, lessonId, amount);
    return db.prepare('SELECT * FROM payments WHERE id = ?').get(result.lastInsertRowid);
  },
  byId(id) {
    return db.prepare('SELECT * FROM payments WHERE id = ?').get(id);
  },
  markPaid(id) {
    db.prepare("UPDATE payments SET status = 'paid', paid_at = datetime('now') WHERE id = ?").run(id);
  },
  cancel(id) {
    db.prepare("UPDATE payments SET status = 'cancelled' WHERE id = ? AND status = 'pending'").run(id);
  },
  forUser(userId) {
    return db.prepare(`
      SELECT p.*, l.title AS lesson_title FROM payments p JOIN lessons l ON l.id = p.lesson_id
      WHERE p.user_id = ? ORDER BY p.created_at DESC, p.id DESC
    `).all(userId);
  },
  all() {
    return db.prepare(`
      SELECT p.*, l.title AS lesson_title, u.name AS user_name, u.email AS user_email
      FROM payments p JOIN lessons l ON l.id = p.lesson_id JOIN users u ON u.id = p.user_id
      ORDER BY (p.status = 'pending') DESC, p.created_at DESC, p.id DESC
    `).all();
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
  users.create({ name: 'Администратор', email, password, level: 'C1', isAdmin: true });
  if (!process.env.ADMIN_PASSWORD) {
    console.log(`\n  Создан администратор: ${email}\n  Пароль: ${password}\n  (сохраните его — он показывается один раз)\n`);
  }
}

module.exports = { db, users, sessions, lessons: lessonsRepo, payments, requests, ensureAdmin };
