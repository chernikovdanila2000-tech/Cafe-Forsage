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
// Чат прибрано: видаляємо файли, що лишилися від нього.
fs.rmSync(path.join(path.dirname(DB_PATH), 'chat-files'), { recursive: true, force: true });
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
addColumn('users', 'is_teacher', 'INTEGER NOT NULL DEFAULT 0');
addColumn('users', 'teacher_id', 'INTEGER');
// Картка викладача на сайті може бути пов'язана з його акаунтом — тоді учні бачать фото й опис, коли обирають викладача.
addColumn('teachers', 'user_id', 'INTEGER');

// Таблиці чату більше не потрібні.
db.exec('DROP TABLE IF EXISTS chat_reads; DROP TABLE IF EXISTS messages;');

// Графік викладача (щотижневі вільні години) і записи учнів на конкретну дату й час.
db.exec(`
  CREATE TABLE IF NOT EXISTS availability (
    teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    weekday    INTEGER NOT NULL,
    time       TEXT NOT NULL,
    PRIMARY KEY (teacher_id, weekday, time)
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date       TEXT NOT NULL,
    time       TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'booked',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  -- Один і той самий час викладача не можна зайняти двічі.
  CREATE UNIQUE INDEX IF NOT EXISTS bookings_slot ON bookings (teacher_id, date, time) WHERE status = 'booked';
`);
// Пробний урок (безкоштовний, 30 хв) — окремий вид запису.
addColumn('bookings', 'kind', "TEXT NOT NULL DEFAULT 'lesson'");
// Куди зв'язуватися з учнем (месенджер і нік / номер) — питаємо під час оплати.
addColumn('users', 'contact_method', 'TEXT');
addColumn('users', 'contact_value', 'TEXT');
addColumn('orders', 'contact', 'TEXT');
addColumn('bookings', 'contact', 'TEXT');
// Підтвердження номера телефону кодом з SMS.
addColumn('users', 'phone_verified', 'INTEGER NOT NULL DEFAULT 0');
db.exec(`
  CREATE TABLE IF NOT EXISTS phone_codes (
    user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    phone      TEXT NOT NULL,
    code_hash  TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    attempts   INTEGER NOT NULL DEFAULT 0,
    sent_at    INTEGER NOT NULL,
    sends      INTEGER NOT NULL DEFAULT 1,
    window_at  INTEGER NOT NULL
  );
`);


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
  create({ name, email, phone, password, level, source, isAdmin = false, phoneVerified = true }) {
    const result = db
      .prepare('INSERT INTO users (name, email, phone, password_hash, level, source, is_admin, phone_verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(name, email.toLowerCase(), phone || null, hashPassword(password), level || 'A1', source || null, isAdmin ? 1 : 0, phoneVerified ? 1 : 0);
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
  teachers() {
    return db.prepare('SELECT id, name, email FROM users WHERE is_teacher = 1 ORDER BY name').all();
  },
  setTeacherRole(id, isTeacher) {
    db.prepare('UPDATE users SET is_teacher = ? WHERE id = ?').run(isTeacher ? 1 : 0, id);
    // Колишній викладач більше не веде учнів.
    if (!isTeacher) db.prepare('UPDATE users SET teacher_id = NULL WHERE teacher_id = ?').run(id);
  },
  setPhone(id, phone) {
    db.prepare('UPDATE users SET phone = ?, phone_verified = 0 WHERE id = ?').run(phone, id);
  },
  markPhoneVerified(id, phone) {
    db.prepare('UPDATE users SET phone = ?, phone_verified = 1 WHERE id = ?').run(phone, id);
  },
  // Чи цей номер уже підтверджено в іншому акаунті (порівнюємо лише цифри).
  phoneTaken(digits, exceptId = 0) {
    return db.prepare('SELECT id, phone FROM users WHERE phone_verified = 1 AND id != ?').all(exceptId)
      .some((u) => String(u.phone || '').replace(/\D/g, '') === digits);
  },
  setContact(id, method, value) {
    db.prepare('UPDATE users SET contact_method = ?, contact_value = ? WHERE id = ?').run(method, value, id);
  },
  assignTeacher(studentId, teacherId) {
    const teacher = teacherId ? db.prepare('SELECT id FROM users WHERE id = ? AND is_teacher = 1').get(teacherId) : null;
    db.prepare('UPDATE users SET teacher_id = ? WHERE id = ?').run(teacher ? teacher.id : null, studentId);
  },
  // Учні викладача з залишком оплачених занять.
  studentsOf(teacherId) {
    return db.prepare(`
      SELECT u.id, u.name, u.email, u.phone, u.level,
        (SELECT COALESCE(SUM(lessons), 0) FROM orders o WHERE o.user_id = u.id AND o.status = 'paid')
          - (SELECT COUNT(*) FROM attendance a WHERE a.user_id = u.id) AS lessons_left
      FROM users u
      WHERE u.teacher_id = ?
      ORDER BY u.name
    `).all(teacherId);
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
  create(userId, product, contact = null) {
    // Не плодимо однакові неоплачені замовлення: повертаємо вже відкрите.
    const open = db.prepare("SELECT * FROM orders WHERE user_id = ? AND product = ? AND status = 'pending'").get(userId, product.id);
    // Ціна чи контакт могли змінитися — оновлюємо відкрите замовлення.
    if (open) {
      const next = { ...open, amount: product.price, lessons: product.lessons, contact: contact || open.contact };
      if (next.amount !== open.amount || next.lessons !== open.lessons || next.contact !== open.contact) {
        db.prepare('UPDATE orders SET amount = ?, lessons = ?, contact = ? WHERE id = ?').run(next.amount, next.lessons, next.contact, open.id);
      }
      return next;
    }
    const result = db.prepare('INSERT INTO orders (user_id, product, lessons, amount, contact) VALUES (?, ?, ?, ?, ?)')
      .run(userId, product.id, product.lessons, product.price, contact);
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
  create({ name, role, about, photo, userId }) {
    const next = db.prepare('SELECT COALESCE(MAX(position), 0) + 1 AS n FROM teachers').get().n;
    db.prepare('INSERT INTO teachers (name, role, about, photo, position, user_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run(name, role || null, about || null, photo || null, next, userId || null);
  },
  update(id, { name, role, about, photo, userId }) {
    db.prepare('UPDATE teachers SET name = ?, role = ?, about = ?, photo = ?, user_id = ? WHERE id = ?')
      .run(name, role || null, about || null, photo || null, userId || null, id);
  },
  // Викладачі, яких учень може обрати: акаунти з роллю «викладач» + фото й опис із картки на сайті.
  forChoice() {
    return db.prepare(`
      SELECT u.id, COALESCE(t.name, u.name) AS name, t.photo, t.role, t.about
      FROM users u
      -- Картка, пов'язана з акаунтом, а якщо такої немає — картка з тим самим ім'ям.
      LEFT JOIN teachers t ON t.id = COALESCE(
        (SELECT id FROM teachers WHERE user_id = u.id ORDER BY position LIMIT 1),
        (SELECT id FROM teachers WHERE user_id IS NULL AND lower(trim(name)) = lower(trim(u.name)) ORDER BY position LIMIT 1)
      )
      WHERE u.is_teacher = 1
      ORDER BY COALESCE(t.position, 1e9), u.name
    `).all();
  },
  remove(id) {
    db.prepare('DELETE FROM teachers WHERE id = ?').run(id);
  },
};

// ---------- Графік і записи ----------

const schedule = {
  // { 1: ['10:00', '11:00'], ... } — дні тижня 1 (пн) … 7 (нд).
  get(teacherId) {
    const result = {};
    for (const row of db.prepare('SELECT weekday, time FROM availability WHERE teacher_id = ? ORDER BY weekday, time').all(teacherId)) {
      (result[row.weekday] ||= []).push(row.time);
    }
    return result;
  },
  set(teacherId, slots) {
    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM availability WHERE teacher_id = ?').run(teacherId);
      const insert = db.prepare('INSERT OR IGNORE INTO availability (teacher_id, weekday, time) VALUES (?, ?, ?)');
      for (const [weekday, times] of Object.entries(slots)) for (const time of times) insert.run(teacherId, Number(weekday), time);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  },
};

const BOOKING_FIELDS = `b.*, s.name AS student_name, s.phone AS student_phone, s.email AS student_email, t.name AS teacher_name`;
const BOOKING_JOIN = 'FROM bookings b JOIN users s ON s.id = b.student_id JOIN users t ON t.id = b.teacher_id';

const bookings = {
  // Повертає id запису або null, якщо цей час уже зайняли.
  create({ teacherId, studentId, date, time, kind = 'lesson', contact = null }) {
    try {
      return Number(db.prepare('INSERT INTO bookings (teacher_id, student_id, date, time, kind, contact) VALUES (?, ?, ?, ?, ?, ?)').run(teacherId, studentId, date, time, kind, contact).lastInsertRowid);
    } catch (err) {
      if (/UNIQUE/.test(err.message)) return null;
      throw err;
    }
  },
  byId(id) {
    return db.prepare(`SELECT ${BOOKING_FIELDS} ${BOOKING_JOIN} WHERE b.id = ?`).get(id);
  },
  cancel(id) {
    return db.prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ? AND status = 'booked'").run(id).changes > 0;
  },
  // Майбутні записи (from — «YYYY-MM-DD HH:MM» за Києвом).
  upcoming({ from, teacherId, studentId } = {}) {
    const where = ["b.status = 'booked'", "(b.date || ' ' || b.time) >= :from"];
    const params = { from };
    if (teacherId) { where.push('b.teacher_id = :teacherId'); params.teacherId = teacherId; }
    if (studentId) { where.push('b.student_id = :studentId'); params.studentId = studentId; }
    return db.prepare(`SELECT ${BOOKING_FIELDS} ${BOOKING_JOIN} WHERE ${where.join(' AND ')} ORDER BY b.date, b.time`).all(params);
  },
  // Чи в учня вже були (або є) будь-які заняття: пробний чи звичайний запис, проведене заняття, оплата.
  // Пробний урок можна взяти лише тоді, коли нічого з цього ще не було.
  hadLessons(studentId) {
    return Boolean(db.prepare(`
      SELECT 1 FROM bookings WHERE student_id = :id AND status != 'cancelled'
      UNION ALL SELECT 1 FROM attendance WHERE user_id = :id
      UNION ALL SELECT 1 FROM orders WHERE user_id = :id AND status = 'paid'
      LIMIT 1`).get({ id: studentId }));
  },
  // Зайняті години викладача: «YYYY-MM-DD HH:MM» → id учня, який записався.
  taken(teacherId, fromDate, toDate) {
    return new Map(db.prepare("SELECT date || ' ' || time AS slot, student_id FROM bookings WHERE teacher_id = ? AND status = 'booked' AND date BETWEEN ? AND ?")
      .all(teacherId, fromDate, toDate).map((r) => [r.slot, r.student_id]));
  },
};

// Коди підтвердження номера (зберігаємо лише хеш коду).
const phoneCodes = {
  get(userId) {
    return db.prepare('SELECT * FROM phone_codes WHERE user_id = ?').get(userId);
  },
  save({ userId, phone, codeHash, expiresAt, now }) {
    const old = this.get(userId);
    const fresh = !old || now - old.window_at > 60 * 60 * 1000;
    db.prepare(`INSERT INTO phone_codes (user_id, phone, code_hash, expires_at, attempts, sent_at, sends, window_at)
      VALUES (?, ?, ?, ?, 0, ?, 1, ?)
      ON CONFLICT(user_id) DO UPDATE SET phone = excluded.phone, code_hash = excluded.code_hash, expires_at = excluded.expires_at,
        attempts = 0, sent_at = excluded.sent_at, sends = ?, window_at = ?`)
      .run(userId, phone, codeHash, expiresAt, now, now, fresh ? 1 : old.sends + 1, fresh ? now : old.window_at);
  },
  attempt(userId) {
    db.prepare('UPDATE phone_codes SET attempts = attempts + 1 WHERE user_id = ?').run(userId);
  },
  remove(userId) {
    db.prepare('DELETE FROM phone_codes WHERE user_id = ?').run(userId);
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

const DEFAULT_ADMIN = 'admin@school.local';

function ensureAdmin() {
  const email = (process.env.ADMIN_EMAIL || DEFAULT_ADMIN).toLowerCase();
  // Коли задано свій ADMIN_EMAIL, тимчасовий адмін-акаунт, створений автоматично, більше не потрібен.
  if (email !== DEFAULT_ADMIN) {
    const temp = users.byEmail(DEFAULT_ADMIN);
    const used = temp && db.prepare('SELECT 1 FROM orders WHERE user_id = ?').get(temp.id);
    if (temp && temp.is_admin && !used) db.prepare('DELETE FROM users WHERE id = ?').run(temp.id);
  }
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

module.exports = { schedule, bookings, phoneCodes, UPLOADS_DIR, storageWarning, onRailway, db, users, sessions, orders, lessons, requests, settings, teachers, reviews, ping, ensureAdmin };
