const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

// Де лежить база. На Railway з підключеним Volume беремо його автоматично,
// інакше база житиме всередині контейнера й зникатиме після кожного оновлення сайту.
const VOLUME = process.env.RAILWAY_VOLUME_MOUNT_PATH;
const DB_PATH = process.env.DB_PATH || (VOLUME ? path.join(VOLUME, 'school.db') : path.join(__dirname, 'data', 'school.db'));
const onRailway = Boolean(process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_PROJECT_ID);
const insideVolume = VOLUME && path.resolve(DB_PATH).startsWith(path.resolve(VOLUME) + path.sep);
const storageWarning = onRailway && !insideVolume;
if (storageWarning) {
  console.warn(`\n  УВАГА: база ${DB_PATH} не на постійному диску (Volume).\n  Акаунти й оплати зникатимуть після кожного оновлення сайту.\n  Підключіть Volume у Railway: правою кнопкою по сервісу → Attach Volume, шлях /data.\n`);
}
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
// Завантажені фото викладачів лежать поруч із базою — на тому ж постійному диску.
const UPLOADS_DIR = path.join(path.dirname(DB_PATH), 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
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

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS teachers (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    role       TEXT,
    about      TEXT,
    photo      TEXT,
    position   INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    text       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Нові колонки в таблицях, створених попередніми версіями сайту.
function addColumn(table, column, definition) {
  const exists = db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
  if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
addColumn('users', 'source', 'TEXT');
addColumn('requests', 'source', 'TEXT');
addColumn('requests', 'status', "TEXT NOT NULL DEFAULT 'new'");

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
  create({ name, email, phone, password, level, source, isAdmin = false }) {
    const result = db
      .prepare('INSERT INTO users (name, email, phone, password_hash, level, source, is_admin) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(name, email.toLowerCase(), phone || null, hashPassword(password), level || 'A1', source || null, isAdmin ? 1 : 0);
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
  // Скидання пароля адміністратором: новий тимчасовий пароль, усі входи учня завершуються.
  resetPassword(id) {
    const password = crypto.randomBytes(6).toString('base64url');
    this.updatePassword(id, password);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    return password;
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
    // Ціна могла змінитися в налаштуваннях — оновлюємо суму відкритого замовлення.
    if (open) {
      if (open.amount !== product.price || open.lessons !== product.lessons) {
        db.prepare('UPDATE orders SET amount = ?, lessons = ? WHERE id = ?').run(product.price, product.lessons, open.id);
        return { ...open, amount: product.price, lessons: product.lessons };
      }
      return open;
    }
    const result = db.prepare('INSERT INTO orders (user_id, product, lessons, amount) VALUES (?, ?, ?, ?)')
      .run(userId, product.id, product.lessons, product.price);
    return db.prepare('SELECT * FROM orders WHERE id = ?').get(result.lastInsertRowid);
  },
  byId(id) {
    return db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  },
  // Повертає true, якщо замовлення справді перейшло в «оплачено» (а не було оплачене раніше).
  markPaid(id) {
    return db.prepare("UPDATE orders SET status = 'paid', paid_at = datetime('now') WHERE id = ? AND status = 'pending'").run(id).changes > 0;
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
  create({ name, contact, message, source }) {
    db.prepare('INSERT INTO requests (name, contact, message, source) VALUES (?, ?, ?, ?)').run(name, contact, message || null, source || null);
  },
  all() {
    return db.prepare("SELECT * FROM requests ORDER BY (status = 'new') DESC, created_at DESC, id DESC").all();
  },
  setStatus(id, status) {
    db.prepare('UPDATE requests SET status = ? WHERE id = ?').run(status === 'done' ? 'done' : 'new', id);
  },
  remove(id) {
    db.prepare('DELETE FROM requests WHERE id = ?').run(id);
  },
};

// ---------- Налаштування сайту (редагуються в адмін-панелі) ----------

const settings = {
  all() {
    return Object.fromEntries(db.prepare('SELECT key, value FROM settings').all().map((r) => [r.key, r.value]));
  },
  save(values) {
    const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    for (const [key, value] of Object.entries(values)) upsert.run(key, String(value ?? ''));
  },
};

// ---------- Викладачі та відгуки ----------

const teachers = {
  all() {
    return db.prepare('SELECT * FROM teachers ORDER BY position, id').all();
  },
  create({ name, role, about, photo }) {
    const next = db.prepare('SELECT COALESCE(MAX(position), 0) + 1 AS n FROM teachers').get().n;
    db.prepare('INSERT INTO teachers (name, role, about, photo, position) VALUES (?, ?, ?, ?, ?)').run(name, role || null, about || null, photo || null, next);
  },
  update(id, { name, role, about, photo }) {
    db.prepare('UPDATE teachers SET name = ?, role = ?, about = ?, photo = ? WHERE id = ?').run(name, role || null, about || null, photo || null, id);
  },
  remove(id) {
    db.prepare('DELETE FROM teachers WHERE id = ?').run(id);
  },
};

const reviews = {
  all() {
    return db.prepare('SELECT * FROM reviews ORDER BY id DESC').all();
  },
  create({ name, text }) {
    db.prepare('INSERT INTO reviews (name, text) VALUES (?, ?)').run(name, text);
  },
  remove(id) {
    db.prepare('DELETE FROM reviews WHERE id = ?').run(id);
  },
};

// Перевірка, що база відповідає (для /health).
const ping = () => db.prepare('SELECT 1 AS ok').get().ok === 1;

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

module.exports = { UPLOADS_DIR, storageWarning, onRailway, db, users, sessions, orders, lessons, requests, settings, teachers, reviews, ping, ensureAdmin };
