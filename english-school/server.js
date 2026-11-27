// Вбудована база SQLite є лише в Node.js 22.13+. На старій версії одразу кажемо, що робити.
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(`\n  Потрібен Node.js 22.13 або новіший, зараз встановлено ${process.version}.\n  Завантажте актуальну LTS-версію: https://nodejs.org\n`);
  process.exit(1);
}

// Приховуємо попередження «SQLite is an experimental feature» — на роботу сайту воно не впливає.
const emitWarning = process.emitWarning;
process.emitWarning = (warning, ...args) => {
  const type = typeof args[0] === 'string' ? args[0] : args[0]?.type;
  if (type === 'ExperimentalWarning' && String(warning).includes('SQLite')) return;
  return emitWarning.call(process, warning, ...args);
};

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const multer = require('multer');
const config = require('./config');
const db = require('./db');
const views = require('./views');
const legal = require('./legal');
const notify = require('./notify');
const slots = require('./slots');
const sms = require('./sms');
const { t, LANGS, DEFAULT_LANG } = require('./i18n');

db.ensureAdmin();
db.sessions.cleanup();

// Одноразове оновлення збережених цін: заняття 400 ₴ (було 450 ₴), абонемент — 350 ₴ за заняття.
{
  const saved = db.settings.all();
  if (!saved['migration.prices-2026-11']) {
    const update = { 'migration.prices-2026-11': '1' };
    if (saved.lessonPrice === '450') update.lessonPrice = '400';
    db.settings.save(update);
  }
  // Нові ціни: заняття 350 ₴, абонемент — 8 занять за 2 550 ₴.
  if (!saved['migration.prices-350']) {
    db.settings.save({ 'migration.prices-350': '1', lessonPrice: '350', packagePrice: '2550', packageLessons: '8' });
  }
  // Підтвердження номера з'явилося пізніше: наявні акаунти вважаємо підтвердженими.
  if (!saved['migration.phone-verified']) {
    db.db.prepare('UPDATE users SET phone_verified = 1').run();
    db.settings.save({ 'migration.phone-verified': '1' });
  }
  // Картка викладачки: ім'я без прізвища (збігається з акаунтом — фото підтягується) і текст українською.
  if (!saved['migration.teacher-card-uk']) {
    db.db.prepare("UPDATE teachers SET name = 'Олександра', role = '2 роки досвіду · B2', about = 'Працюю лише з дітьми.' WHERE name = 'Олександра Ленгер'").run();
    db.settings.save({ 'migration.teacher-card-uk': '1' });
  }
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));
app.use('/uploads', express.static(db.UPLOADS_DIR, { maxAge: '7d', fallthrough: false }));

const COOKIE = 'sid';
const LANG_COOKIE = 'lang';
const SOURCE_COOKIE = 'src';
const DAY = 24 * 60 * 60 * 1000;

// ---------- Сесії, мова, джерело відвідувача ----------

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) {
      try { return decodeURIComponent(rest.join('=')); } catch { return null; }
    }
  }
  return null;
}

const cookieOptions = (maxAge, httpOnly = true) => ({ httpOnly, sameSite: 'lax', secure: config.secureCookies, maxAge });

function startSession(res, userId) {
  res.cookie(COOKIE, db.sessions.create(userId), cookieOptions(30 * DAY));
}

// Звідки прийшов відвідувач: utm-мітки реклами або сайт, з якого перейшли. Пишеться в заявку й акаунт.
function trackSource(req, res) {
  const utm = ['utm_source', 'utm_medium', 'utm_campaign']
    .map((k) => String(req.query[k] || '').trim().slice(0, 40))
    .filter(Boolean)
    .join(' / ');
  if (utm) {
    res.cookie(SOURCE_COOKIE, utm, cookieOptions(30 * DAY));
    return utm;
  }
  const saved = readCookie(req, SOURCE_COOKIE);
  if (saved) return saved;
  if (req.query.fbclid) {
    res.cookie(SOURCE_COOKIE, 'facebook / instagram', cookieOptions(30 * DAY));
    return 'facebook / instagram';
  }
  try {
    const ref = new URL(req.get('referer') || '');
    if (ref.host && ref.host !== req.get('host')) {
      const host = ref.host.replace(/^www\./, '').slice(0, 60);
      res.cookie(SOURCE_COOKIE, host, cookieOptions(30 * DAY));
      return host;
    }
  } catch {}
  return '';
}

app.use((req, res, next) => {
  req.user = db.sessions.user(readCookie(req, COOKIE));
  const lang = readCookie(req, LANG_COOKIE);
  req.lang = LANGS.includes(lang) ? lang : DEFAULT_LANG;
  req.source = req.method === 'GET' ? trackSource(req, res) : readCookie(req, SOURCE_COOKIE) || '';
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Усе, що потрібно сторінці: мова, користувач, повідомлення, адреса.
function ctx(req) {
  return {
    lang: req.lang,
    user: req.user,
    msg: typeof req.query.msg === 'string' ? req.query.msg : '',
    origin: `${req.protocol}://${req.get('host')}`,
    path: req.path,
    hasTeachers: db.teachers.all().length > 0,
    hasReviews: db.reviews.all().length > 0,
  };
}

const notFound = (req, res) => res.status(404).send(views.notFound(ctx(req)));

// Пускаємо далі лише за посиланнями всередині сайту, щоб ?next= не можна було вести на чужий домен.
const safeNext = (value) => (typeof value === 'string' && /^\/(?![/\\])/.test(value) ? value : '/dashboard');

// Учень із непідтвердженим номером (коли SMS налаштовано) спершу підтверджує його.
const needsPhone = (user) => config.sms.enabled && !user.is_admin && !user.is_teacher && !user.phone_verified;

function requireLogin(req, res, next) {
  if (req.user) return next();
  res.redirect(`/login?msg=login_required&next=${encodeURIComponent(req.originalUrl)}`);
}

function requireUser(req, res, next) {
  if (!req.user) return requireLogin(req, res, next);
  if (needsPhone(req.user)) return res.redirect(`/verify-phone?next=${encodeURIComponent(req.method === 'GET' ? req.originalUrl : '/dashboard')}`);
  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.is_admin) return next();
  // Сторінки адмінки відкриваються лише адміністратору; іншим пояснюємо, як увійти.
  if (req.method === 'GET' && req.path === '/') return res.status(403).send(views.adminOnly(ctx(req)));
  notFound(req, res);
}

const field = (value, max = 200) => String(value ?? '').trim().slice(0, max);
const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

// Обмеження частоти: захист від підбору паролів і спаму з одного IP.
function rateLimit(name, max, windowMs) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [key, v] of hits) if (v.reset < now) hits.delete(key);
  }, windowMs).unref();
  return (req) => {
    const key = `${name}:${req.ip}`;
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.reset < now) {
      hits.set(key, { count: 1, reset: now + windowMs });
      return false;
    }
    entry.count += 1;
    return entry.count > max;
  };
}

const limitLogin = rateLimit('login', 10, 10 * 60 * 1000);
const limitRegister = rateLimit('register', 5, 60 * 60 * 1000);
const limitRequest = rateLimit('request', 5, 10 * 60 * 1000);
const limitSms = rateLimit('sms', 10, 60 * 60 * 1000);

// ---------- Службові адреси ----------

app.get('/health', (req, res) => {
  try {
    res.json({ ok: db.ping(), persistentStorage: !db.storageWarning });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

const siteBase = (req) => config.siteUrl || `${req.protocol}://${req.get('host')}`;

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nDisallow: /admin\nDisallow: /dashboard\nDisallow: /account\nDisallow: /pay/\nSitemap: ${siteBase(req)}/sitemap.xml\n`);
});

app.get('/sitemap.xml', (req, res) => {
  const urls = ['/', '/offer', '/privacy'].map((p) => `<url><loc>${siteBase(req)}${p}</loc></url>`).join('');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
});

// Перемикач мови: запам'ятовуємо вибір у cookie й повертаємо на ту саму сторінку.
app.get('/lang/:code', (req, res) => {
  const lang = LANGS.includes(req.params.code) ? req.params.code : DEFAULT_LANG;
  res.cookie(LANG_COOKIE, lang, cookieOptions(365 * DAY, false));
  let back = '/';
  try {
    const referer = new URL(req.get('referer') || '', `${req.protocol}://${req.get('host')}`);
    if (referer.host === req.get('host')) {
      referer.searchParams.delete('msg');
      back = referer.pathname + referer.search;
    }
  } catch {}
  res.redirect(back);
});

// ---------- Публічні сторінки ----------

// Картки викладачів на головній: до кожної — акаунт (якщо є) і чи заповнено графік, щоб показати кнопку «Вільний час».
function teacherCards() {
  const accounts = db.teachers.forChoice();
  const norm = (x) => String(x || '').trim().toLowerCase();
  return db.teachers.all().map((card) => {
    const account = accounts.find((a) => a.id === card.user_id) || (!card.user_id && accounts.find((a) => norm(a.name) === norm(card.name)));
    const hasSchedule = account ? Object.keys(db.schedule.get(account.id)).length > 0 : false;
    return { ...card, accountId: hasSchedule ? account.id : null };
  });
}

app.get('/', (req, res) => {
  res.send(views.home(ctx(req), { teachers: teacherCards(), reviews: db.reviews.all() }));
});

// Вільний час викладача: видно всім; записатися може учень з оплаченими заняттями.
app.get('/schedule/:id', (req, res) => {
  const teacher = db.teachers.forChoice().find((x) => x.id === Number(req.params.id));
  if (!teacher) return notFound(req, res);
  const user = req.user;
  const student = user && !user.is_teacher && !user.is_admin;
  res.send(views.schedulePage(ctx(req), {
    teacher,
    hasSchedule: Object.keys(db.schedule.get(teacher.id)).length > 0,
    freeSlots: slots.grid(teacher.id, user && user.id),
    student,
    canBook: student ? bookingInfo(user).canBook : 0,
    trial: student ? bookingInfo(user).trial : false,
    isMine: student && user.teacher_id === teacher.id,
  }));
});

app.post('/request', (req, res) => {
  // Приховане поле «website» заповнюють лише боти.
  if (field(req.body.website)) return res.redirect('/thanks');
  if (limitRequest(req)) return res.redirect('/?msg=too_many#trial');
  const request = {
    name: field(req.body.name, 80),
    contact: field(req.body.contact, 120),
    message: field(req.body.message, 1000),
    source: req.source,
  };
  if (!request.name || !request.contact) return res.redirect('/#trial');
  db.requests.create(request);
  notify.events.request(request);
  res.redirect('/thanks');
});

app.get('/thanks', (req, res) => res.send(views.thanks(ctx(req))));

app.get('/offer', (req, res) => {
  res.send(views.legalPage(ctx(req), { html: legal.offer(req.lang), title: t(req.lang, 'footer.offer') }));
});

app.get('/privacy', (req, res) => {
  res.send(views.legalPage(ctx(req), { html: legal.privacy(req.lang), title: t(req.lang, 'footer.privacy') }));
});

// ---------- Реєстрація та вхід ----------

app.get('/register', (req, res) => {
  if (req.user) return res.redirect(safeNext(req.query.next));
  res.send(views.authPage(ctx(req), { mode: 'register', next: req.query.next }));
});

app.post('/register', (req, res) => {
  const values = {
    name: field(req.body.name, 80),
    email: field(req.body.email, 120).toLowerCase(),
    phone: field(req.body.phone, 30),
    level: views.LEVEL_CODES.includes(req.body.level) ? req.body.level : 'unknown',
    agree: req.body.agree === '1',
  };
  const password = String(req.body.password || '');
  const fail = (key, status = 400) => res.status(status).send(views.authPage(ctx(req), {
    mode: 'register', error: t(req.lang, key), values, next: req.body.next,
  }));

  if (!values.name) return fail('err.name');
  if (!isEmail(values.email)) return fail('err.email');
  if (values.phone.replace(/\D/g, '').length < 9) return fail('err.phone');
  if (config.sms.enabled) {
    const digits = sms.normalize(values.phone);
    if (!digits) return fail('err.phone');
    if (db.users.phoneTaken(digits)) return fail('err.phoneTaken');
    values.phone = `+${digits}`;
  }
  if (password.length < 8) return fail('err.password');
  if (!values.agree) return fail('err.agree');
  if (db.users.byEmail(values.email)) return fail('err.exists');
  if (limitRegister(req)) return fail('msg.too_many', 429);

  // Поки SMS не налаштовано, номер не перевіряємо — і потім такого учня не блокуємо.
  const userId = db.users.create({ ...values, password, source: req.source, phoneVerified: !config.sms.enabled });
  notify.events.registration({ ...values, source: req.source });
  startSession(res, userId);
  const next = req.body.next ? safeNext(req.body.next) : '/dashboard?msg=registered';
  if (config.sms.enabled) {
    sendPhoneCode(db.users.byId(userId));
    return res.redirect(`/verify-phone?next=${encodeURIComponent(next)}`);
  }
  res.redirect(next);
});

// ---------- Підтвердження номера кодом з SMS ----------

const CODE_TTL = 10 * 60 * 1000; // код діє 10 хв
const RESEND_AFTER = 60 * 1000; // надіслати ще раз можна через хвилину
const MAX_SENDS = 5; // не більше 5 SMS на годину для одного акаунта
const MAX_ATTEMPTS = 5;
const hashCode = (userId, code) => crypto.createHash('sha256').update(`${userId}:${code}`).digest('hex');

// Повертає null, якщо код надіслано, або ключ помилки.
async function sendPhoneCode(user) {
  const digits = sms.normalize(user.phone);
  if (!digits) return 'err.phone';
  const now = Date.now();
  const last = db.phoneCodes.get(user.id);
  if (last && now - last.sent_at < RESEND_AFTER) return 'verify.wait';
  if (last && now - last.window_at < 60 * 60 * 1000 && last.sends >= MAX_SENDS) return 'verify.tooMany';
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  db.phoneCodes.save({ userId: user.id, phone: digits, codeHash: hashCode(user.id, code), expiresAt: now + CODE_TTL, now });
  const result = await sms.send(digits, `Inkwell Academy: ваш код ${code}. Діє 10 хвилин.`);
  return result.ok ? null : 'verify.sendFailed';
}

const verifyNext = (req) => safeNext(req.query.next || req.body?.next || '/dashboard');

app.get('/verify-phone', requireLogin, async (req, res) => {
  const user = req.user;
  if (!needsPhone(user)) return res.redirect(verifyNext(req));
  let error = null;
  if (!db.phoneCodes.get(user.id) || db.phoneCodes.get(user.id).expires_at < Date.now()) {
    const fail = limitSms(req) ? 'msg.too_many' : await sendPhoneCode(user);
    if (fail && fail !== 'verify.wait') error = t(req.lang, fail);
  }
  res.send(views.verifyPhone(ctx(req), { next: verifyNext(req), error, notice: req.query.msg ? t(req.lang, `verify.${req.query.msg}`) : null }));
});

app.post('/verify-phone', requireLogin, (req, res) => {
  const user = req.user;
  const next = verifyNext(req);
  if (!needsPhone(user)) return res.redirect(next);
  const fail = (key) => res.status(400).send(views.verifyPhone(ctx(req), { next, error: t(req.lang, key) }));
  const entry = db.phoneCodes.get(user.id);
  const code = String(req.body.code || '').replace(/\D/g, '');
  if (!entry || entry.expires_at < Date.now()) return fail('verify.expired');
  if (entry.attempts >= MAX_ATTEMPTS) return fail('verify.tooManyAttempts');
  if (hashCode(user.id, code) !== entry.code_hash) {
    db.phoneCodes.attempt(user.id);
    return fail('verify.wrong');
  }
  if (db.users.phoneTaken(entry.phone, user.id)) return fail('err.phoneTaken');
  db.users.markPhoneVerified(user.id, `+${entry.phone}`);
  db.phoneCodes.remove(user.id);
  notify.send([`✅ <b>Номер підтверджено</b>`, `${user.name} · +${entry.phone}`.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])]);
  res.redirect(next);
});

app.post('/verify-phone/resend', requireLogin, async (req, res) => {
  const next = encodeURIComponent(verifyNext(req));
  if (!needsPhone(req.user)) return res.redirect(verifyNext(req));
  const fail = limitSms(req) ? 'msg.too_many' : await sendPhoneCode(req.user);
  if (fail) return res.status(fail === 'verify.wait' ? 200 : 400).send(views.verifyPhone(ctx(req), { next: verifyNext(req), error: t(req.lang, fail) }));
  res.redirect(`/verify-phone?msg=sent&next=${next}`);
});

// Помилилися в номері — змінюємо його й надсилаємо код на новий.
app.post('/verify-phone/change', requireLogin, async (req, res) => {
  const user = req.user;
  if (!needsPhone(user)) return res.redirect(verifyNext(req));
  const fail = (key) => res.status(400).send(views.verifyPhone(ctx(req), { next: verifyNext(req), error: t(req.lang, key) }));
  const digits = sms.normalize(req.body.phone);
  if (!digits) return fail('err.phone');
  if (db.users.phoneTaken(digits, user.id)) return fail('err.phoneTaken');
  db.users.setPhone(user.id, `+${digits}`);
  db.phoneCodes.remove(user.id);
  const error = limitSms(req) ? 'msg.too_many' : await sendPhoneCode(db.users.byId(user.id));
  if (error) return fail(error);
  res.redirect(`/verify-phone?msg=sent&next=${encodeURIComponent(verifyNext(req))}`);
});

app.get('/login', (req, res) => {
  if (req.user) return res.redirect(safeNext(req.query.next));
  res.send(views.authPage(ctx(req), { mode: 'login', next: req.query.next }));
});

app.post('/login', (req, res) => {
  const email = field(req.body.email, 120);
  const fail = (key, status) => res.status(status).send(views.authPage(ctx(req), {
    mode: 'login', error: t(req.lang, key), values: { email }, next: req.body.next,
  }));
  if (limitLogin(req)) return fail('msg.too_many', 429);
  const user = db.users.authenticate(email, String(req.body.password || ''));
  if (!user) return fail('err.login', 401);
  startSession(res, user.id);
  res.redirect(safeNext(req.body.next || (user.is_admin ? '/admin' : user.is_teacher ? '/teacher' : '/dashboard')));
});

app.post('/logout', (req, res) => {
  const token = readCookie(req, COOKIE);
  if (token) db.sessions.destroy(token);
  res.clearCookie(COOKIE);
  res.redirect(req.body.next === '/login?next=%2Fadmin' ? req.body.next : '/?msg=loggedout');
});

app.get('/forgot', (req, res) => res.send(views.forgot(ctx(req))));

// ---------- Особистий кабінет ----------

app.get('/dashboard', requireUser, (req, res) => {
  if (req.user.is_teacher && !req.query.msg) return res.redirect('/teacher');
  res.send(views.dashboard(ctx(req), {
    balance: db.lessons.balance(req.user.id),
    orders: db.orders.forUser(req.user.id),
    teacher: req.user.teacher_id ? db.teachers.forChoice().find((x) => x.id === req.user.teacher_id) || db.users.byId(req.user.teacher_id) : null,
    teachers: db.teachers.forChoice().map((x) => ({ ...x, days: Object.keys(db.schedule.get(x.id)).map(Number) })),
    ...bookingInfo(req.user),
  }));
});

// Що потрібно кабінету учня для запису: його майбутні заняття, вільний час викладача й скільки ще можна записатися.
// Пробний урок (безкоштовний) — лише для учня, у якого ще не було жодних занять, записів чи оплат.
function bookingInfo(user) {
  const upcoming = db.bookings.upcoming({ from: slots.now(), studentId: user.id }).map((b) => ({ ...b, canCancel: slots.canCancel(b) }));
  const canBook = Math.max(db.lessons.balance(user.id).left - upcoming.filter((b) => b.kind !== 'trial').length, 0);
  const trial = canBook <= 0 && !db.bookings.hadLessons(user.id);
  const hasSchedule = user.teacher_id ? Object.keys(db.schedule.get(user.teacher_id)).length > 0 : false;
  return { upcoming, canBook, trial, hasSchedule, freeSlots: user.teacher_id ? slots.grid(user.teacher_id, user.id) : [] };
}

const bookingLine = (b) => `${b.date.split('-').reverse().join('.')} о ${b.time}`;

// Запис учня на вільний час свого викладача (потрібне оплачене заняття).
// Можна записатися й до іншого викладача (зі сторінки «Вільний час») — тоді він стає викладачем учня.
app.post('/book', requireUser, (req, res) => {
  const user = req.user;
  if (user.is_teacher || user.is_admin) return res.redirect('/dashboard');
  const teacherId = req.body.teacher_id ? teacherAccount(req.body.teacher_id) : user.teacher_id;
  if (!teacherId) return res.redirect('/dashboard');
  const fromSchedule = Boolean(req.body.teacher_id);
  const back = (msg) => res.redirect(fromSchedule ? `/schedule/${teacherId}?msg=${msg}` : `/dashboard?msg=${msg}#book`);
  // Можна обрати одразу кілька годин (стільки, скільки оплачених занять лишилося).
  const picked = [...new Set([].concat(req.body.slot || []).map(String))].slice(0, 20)
    .map((v) => v.split('|'))
    .filter(([date, time]) => /^\d{4}-\d{2}-\d{2}$/.test(date || '') && slots.HOURS.includes(time));
  if (!picked.length) return back('booking_taken');
  const info = bookingInfo(user);
  const kind = info.canBook > 0 ? 'lesson' : info.trial ? 'trial' : null;
  if (!kind) return back('booking_no_lessons');
  const limit = kind === 'trial' ? 1 : info.canBook;
  if (picked.length > limit) return back('booking_too_many');
  // Пробний урок: спершу питаємо, де з учнем зв'язатися.
  let contact = null;
  if (kind === 'trial') {
    const method = String(req.body.contact_method || '');
    const value = field(req.body.contact_value, 100);
    if (!MESSENGERS.includes(method) || !value) {
      const [date, time] = picked[0];
      if (!slots.isFree(teacherId, date, time)) return back('booking_taken');
      const teacherName = (db.users.byId(teacherId) || {}).name || '';
      const asked = 'contact_method' in req.body || 'contact_value' in req.body;
      return res.status(asked ? 400 : 200).send(views.trialContact(ctx(req), {
        slot: `${date}|${time}`, teacherId: fromSchedule ? teacherId : null, teacherName, messengers: MESSENGERS,
        values: asked ? { method, value } : {}, error: asked ? t(req.lang, 'pay.contactRequired') : null,
        back: fromSchedule ? `/schedule/${teacherId}` : '/dashboard#book',
      }));
    }
    db.users.setContact(user.id, method, value);
    contact = `${t('uk', `messenger.${method}`)}: ${value}`;
  }
  const made = [];
  for (const [date, time] of picked) {
    if (!slots.isFree(teacherId, date, time)) continue;
    const id = db.bookings.create({ teacherId, studentId: user.id, date, time, kind, contact });
    if (id) made.push(db.bookings.byId(id));
  }
  if (!made.length) return back('booking_taken');
  if (teacherId !== user.teacher_id) db.users.assignTeacher(user.id, teacherId);
  const b = made[0];
  const title = kind === 'trial' ? `🎁 <b>Новий запис на пробний урок</b> (безкоштовно, ${config.trialMinutes} хв)` : `📅 <b>Новий запис на заняття</b>${made.length > 1 ? ` (${made.length})` : ''}`;
  notify.send([title, ...made.map((x) => `${bookingLine(x)} · ${x.teacher_name}`), `Учень: ${b.student_name} · ${b.student_phone || b.student_email}`, contact && `Зв'язок: ${contact}`].filter(Boolean)
    .map((line, i) => (i ? line.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]) : line)));
  if (made.length < picked.length) return back('booked_partly');
  back(kind === 'trial' ? 'booked_trial' : made.length > 1 ? 'booked_many' : 'booked');
});

// Скасування: учень — не пізніше ніж за 24 год; викладач — свої записи; адміністратор — будь-які.
app.post('/bookings/:id/cancel', requireUser, (req, res) => {
  const user = req.user;
  const b = db.bookings.byId(Number(req.params.id));
  const back = user.is_admin ? '/admin/schedule' : user.is_teacher ? '/teacher' : '/dashboard';
  if (!b || b.status !== 'booked') return res.redirect(back);
  const own = b.student_id === user.id;
  const teacherOwn = user.is_teacher && b.teacher_id === user.id;
  if (!user.is_admin && !own && !teacherOwn) return notFound(req, res);
  if (own && !user.is_admin && !slots.canCancel(b)) return res.redirect('/dashboard?msg=booking_too_late#book');
  db.bookings.cancel(b.id);
  const who = own ? 'учень' : teacherOwn ? 'викладач' : 'адміністратор';
  notify.send(['❌ <b>Запис скасовано</b>', `${bookingLine(b)} · ${b.teacher_name}`, `Учень: ${b.student_name} · ${b.student_phone || b.student_email}`, `Скасував: ${who}`]
    .map((line, i) => (i ? line.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]) : line)));
  res.redirect(`${back}?msg=${user.is_admin ? 'admin.bookingCancelled' : user.is_teacher ? 'teacher.bookingCancelled' : 'booking_cancelled'}`);
});

// Учень сам обирає викладача — після цього викладач бачить його у своєму кабінеті.
app.post('/choose-teacher', requireUser, (req, res) => {
  if (req.user.is_teacher || req.user.is_admin) return res.redirect('/dashboard');
  const teacherId = teacherAccount(req.body.teacher_id);
  if (!teacherId) return res.redirect('/dashboard');
  if (teacherId !== req.user.teacher_id) {
    db.users.assignTeacher(req.user.id, teacherId);
    const teacher = db.users.byId(teacherId);
    notify.send([
      '👩‍🏫 <b>Учень обрав викладача</b>',
      `${req.user.name} · ${req.user.phone || req.user.email} → ${teacher.name}`,
    ].map((line, i) => (i ? line.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]) : line)));
  }
  res.redirect('/dashboard?msg=teacher_chosen');
});

// ---------- Кабінет викладача ----------

function requireTeacher(req, res, next) {
  if (req.user?.is_teacher) return next();
  notFound(req, res);
}

app.get('/teacher', requireUser, requireTeacher, (req, res) => {
  res.send(views.teacherHome(ctx(req), {
    students: db.users.studentsOf(req.user.id),
    upcoming: db.bookings.upcoming({ from: slots.now(), teacherId: req.user.id }),
    availability: db.schedule.get(req.user.id),
    hours: slots.HOURS,
  }));
});

// Графік викладача: поля d1…d7 з позначеними годинами.
app.post('/teacher/schedule', requireUser, requireTeacher, (req, res) => {
  const result = {};
  for (let day = 1; day <= 7; day++) {
    const raw = req.body[`d${day}`];
    const times = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter((x) => slots.HOURS.includes(x));
    if (times.length) result[day] = [...new Set(times)];
  }
  db.schedule.set(req.user.id, result);
  res.redirect('/teacher?msg=teacher.scheduleSaved#schedule');
});

app.post('/teacher/students/:id/held', requireUser, requireTeacher, (req, res) => {
  const student = db.users.byId(Number(req.params.id));
  if (student && student.teacher_id === req.user.id) db.lessons.markHeld(student.id);
  res.redirect('/teacher?msg=teacher.held');
});

app.get('/account', requireUser, (req, res) => res.send(views.account(ctx(req), {})));

app.post('/account', requireUser, (req, res) => {
  const name = field(req.body.name, 80);
  if (!name) return res.status(400).send(views.account(ctx(req), { error: t(req.lang, 'err.nameEmpty') }));
  let phone = field(req.body.phone, 30);
  // Новий номер учня (коли SMS увімкнено) треба знову підтвердити кодом.
  const student = !req.user.is_admin && !req.user.is_teacher;
  const changed = sms.normalize(phone) !== sms.normalize(req.user.phone);
  if (config.sms.enabled && student && changed) {
    const digits = sms.normalize(phone);
    if (!digits) return res.status(400).send(views.account(ctx(req), { error: t(req.lang, 'err.phone') }));
    if (db.users.phoneTaken(digits, req.user.id)) return res.status(400).send(views.account(ctx(req), { error: t(req.lang, 'err.phoneTaken') }));
    phone = `+${digits}`;
  }
  db.users.updateProfile(req.user.id, {
    name,
    phone,
    level: views.LEVEL_CODES.includes(req.body.level) ? req.body.level : req.user.level,
  });
  if (config.sms.enabled && student && changed) {
    db.users.setPhone(req.user.id, phone);
    db.phoneCodes.remove(req.user.id);
    return res.redirect('/verify-phone?next=%2Faccount');
  }
  res.redirect('/account?msg=profile_saved');
});

app.post('/account/password', requireUser, (req, res) => {
  const password = String(req.body.password || '');
  if (!db.users.authenticate(req.user.email, String(req.body.current || ''))) {
    return res.status(400).send(views.account(ctx(req), { error: t(req.lang, 'err.currentPassword') }));
  }
  if (password.length < 8) return res.status(400).send(views.account(ctx(req), { error: t(req.lang, 'err.newPassword') }));
  db.users.updatePassword(req.user.id, password);
  res.redirect('/account?msg=password_changed');
});

// ---------- Оплата ----------

function buildPaymentUrl(order, user) {
  const params = { payment: order.id, product: order.product, amount: order.amount, email: user.email };
  if (/\{(payment|product|amount|email)\}/.test(config.paymentUrl)) {
    return config.paymentUrl.replace(/\{(payment|product|amount|email)\}/g, (_, key) => encodeURIComponent(params[key]));
  }
  const url = new URL(config.paymentUrl);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

// «Оплатити»: /pay/single — разове заняття, /pay/monthly — абонемент.
// Створює замовлення, сповіщає адміністратора й показує спосіб оплати.
// Спершу питаємо, де зручно зв'язатися (месенджер), потім створюємо замовлення.
const MESSENGERS = ['telegram', 'viber', 'whatsapp', 'instagram', 'phone'];

app.get('/pay/:product', requireUser, (req, res) => {
  const product = config.products[req.params.product];
  if (!product) return notFound(req, res);
  res.send(views.payContact(ctx(req), { product, messengers: MESSENGERS }));
});

app.post('/pay/:product', requireUser, (req, res) => {
  const product = config.products[req.params.product];
  if (!product) return notFound(req, res);
  const method = String(req.body.contact_method || '');
  const value = field(req.body.contact_value, 100);
  if (!MESSENGERS.includes(method) || !value) {
    return res.status(400).send(views.payContact(ctx(req), { product, messengers: MESSENGERS, values: { method, value }, error: t(req.lang, 'pay.contactRequired') }));
  }
  db.users.setContact(req.user.id, method, value);
  const contact = `${t('uk', `messenger.${method}`)}: ${value}`;
  const existing = db.orders.forUser(req.user.id).find((o) => o.product === product.id && o.status === 'pending');
  const order = db.orders.create(req.user.id, product, contact);
  if (!existing) notify.events.order(order, req.user, views.productName(product.id, 'uk'));
  res.redirect(`/checkout/${order.id}`);
});

// Сторінка оплати замовлення: зовнішнє посилання на оплату або реквізити.
app.get('/checkout/:id', requireUser, (req, res) => {
  const order = db.orders.byId(Number(req.params.id));
  if (!order || order.user_id !== req.user.id) return notFound(req, res);
  if (order.status !== 'pending') return res.redirect('/dashboard');
  const product = config.products[order.product];
  if (config.paymentUrl) {
    try {
      return res.redirect(buildPaymentUrl(order, req.user));
    } catch {
      console.error('Посилання на оплату має бути повним, наприклад https://…');
    }
  }
  const mode = config.demoPayments ? 'demo' : config.paymentDetails ? 'details' : 'manual';
  res.send(views.checkout(ctx(req), { product, order, mode }));
});

// Учень скасовує своє неоплачене замовлення.
app.post('/orders/:id/cancel', requireUser, (req, res) => {
  const order = db.orders.byId(Number(req.params.id));
  if (!order || order.user_id !== req.user.id) return notFound(req, res);
  if (order.status === 'pending') {
    db.orders.cancel(order.id);
    notify.send([`🚫 <b>Замовлення № ${order.id} скасовано</b> учнем`, `${req.user.name} · ${order.amount} ₴`.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])]);
  }
  res.redirect('/dashboard?msg=order_cancelled');
});

// Демо-оплата — лише для перевірки сайту на своєму комп'ютері (на робочому сервері вимкнена).
app.post('/pay/demo/:orderId', requireUser, (req, res) => {
  const order = db.orders.byId(Number(req.params.orderId));
  if (!config.demoPayments || !order || order.user_id !== req.user.id) return notFound(req, res);
  if (db.orders.markPaid(order.id)) notify.events.paid(order, req.user, views.productName(order.product, 'uk'));
  res.redirect('/dashboard?msg=paid');
});

// Адреса повернення після оплати — вкажіть її в налаштуваннях платіжного сервісу.
app.get('/payment/success', requireUser, (req, res) => res.redirect('/dashboard?msg=payment_pending'));

// ---------- Адмін-панель ----------

function adminCounts() {
  return {
    requests: db.requests.all().filter((r) => r.status === 'new').length,
    orders: db.orders.all().filter((o) => o.status === 'pending').length,
  };
}

function checklist() {
  return [
    { key: 'storage', ok: !db.storageWarning },
    { key: 'contacts', ok: Boolean((config.phone || config.telegram) && config.email), href: '/admin/settings' },
    { key: 'legal', ok: Boolean(config.legal.seller && config.legal.taxId && config.legal.address), href: '/admin/settings' },
    { key: 'payment', ok: Boolean(config.paymentUrl || config.paymentDetails), href: '/admin/settings' },
    { key: 'telegram', ok: Boolean(config.telegramBot.token && config.telegramBot.chatId), href: '/admin/settings' },
    { key: 'sms', ok: config.sms.enabled, href: '/admin/settings' },
    { key: 'site', ok: Boolean(config.siteUrl), href: '/admin/settings' },
    { key: 'pixel', ok: Boolean(config.metaPixelId), href: '/admin/settings' },
    { key: 'teachers', ok: db.teachers.all().length > 0, href: '/admin/teachers' },
  ];
}

const admin = express.Router();
admin.use(requireUser, requireAdmin);

admin.get('/', (req, res) => {
  const orders = db.orders.all();
  const users = db.users.all();
  const requests = db.requests.all();
  res.send(views.adminOverview(ctx(req), {
    checklist: checklist(),
    storageWarning: db.storageWarning,
    counts: adminCounts(),
    stats: {
      newRequests: requests.filter((r) => r.status === 'new').length,
      students: users.filter((u) => !u.is_admin).length,
      pending: orders.filter((o) => o.status === 'pending').length,
      revenue: orders.filter((o) => o.status === 'paid').reduce((sum, o) => sum + o.amount, 0),
    },
    requests: requests.filter((r) => r.status === 'new').slice(0, 5),
    orders: orders.filter((o) => o.status === 'pending'),
  }));
});

admin.get('/requests', (req, res) => {
  res.send(views.adminRequests(ctx(req), { requests: db.requests.all(), counts: adminCounts() }));
});

admin.post('/requests/:id/delete', (req, res) => {
  db.requests.remove(Number(req.params.id));
  res.redirect('/admin/requests?msg=admin.deleted');
});

admin.post('/requests/:id/:status', (req, res) => {
  if (!['done', 'new'].includes(req.params.status)) return notFound(req, res);
  db.requests.setStatus(Number(req.params.id), req.params.status);
  res.redirect((req.get('referer') || '').includes('/admin/requests') ? '/admin/requests' : '/admin');
});

admin.get('/orders', (req, res) => {
  res.send(views.adminOrders(ctx(req), { orders: db.orders.all(), counts: adminCounts() }));
});

admin.post('/orders/:id/confirm', (req, res) => {
  const order = db.orders.byId(Number(req.params.id));
  if (order && db.orders.markPaid(order.id)) {
    notify.events.paid(order, db.users.byId(order.user_id), views.productName(order.product, 'uk'));
  }
  res.redirect('/admin/orders?msg=admin.confirmed');
});

admin.post('/orders/:id/cancel', (req, res) => {
  db.orders.cancel(Number(req.params.id));
  res.redirect('/admin/orders?msg=admin.cancelled');
});

const renderStudents = (req, res, notice) => {
  res.send(views.adminStudents(ctx(req), { users: db.users.all(), teachers: db.users.teachers(), counts: adminCounts(), notice }));
};

admin.post('/users/:id/teacher', (req, res) => {
  const student = db.users.byId(Number(req.params.id));
  if (student && !student.is_teacher && !student.is_admin) db.users.assignTeacher(student.id, Number(req.body.teacher_id) || null);
  res.redirect('/admin/students?msg=admin.teacherAssigned');
});

admin.post('/users/:id/role', (req, res) => {
  const user = db.users.byId(Number(req.params.id));
  if (user && !user.is_admin) {
    const makeTeacher = req.body.teacher === '1';
    db.users.setTeacherRole(user.id, makeTeacher);
    if (makeTeacher) db.users.assignTeacher(user.id, null);
  }
  res.redirect('/admin/students?msg=admin.roleSaved');
});

admin.get('/students', (req, res) => renderStudents(req, res));

admin.get('/schedule', (req, res) => {
  res.send(views.adminSchedule(ctx(req), {
    upcoming: db.bookings.upcoming({ from: slots.now() }),
    teachers: db.users.teachers().map((x) => ({ ...x, availability: db.schedule.get(x.id) })),
    counts: adminCounts(),
  }));
});

admin.post('/users/:id/held', (req, res) => {
  db.lessons.markHeld(Number(req.params.id));
  res.redirect('/admin/students?msg=admin.held');
});

admin.post('/users/:id/undo', (req, res) => {
  db.lessons.undoLast(Number(req.params.id));
  res.redirect('/admin/students?msg=admin.undone');
});

// Новий пароль показується адміністратору один раз і ніде не зберігається у відкритому вигляді.
admin.post('/users/:id/reset', (req, res) => {
  const user = db.users.byId(Number(req.params.id));
  if (!user || user.is_admin) return res.redirect('/admin/students');
  const password = db.users.resetPassword(user.id);
  renderStudents(req, res, t(req.lang, 'admin.newPassword', { email: user.email, password }));
});

// Фото викладачів: лише зображення до 3 МБ, з випадковою назвою файлу.
const PHOTO_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const upload = multer({
  storage: multer.diskStorage({
    destination: db.UPLOADS_DIR,
    filename: (req, file, cb) => cb(null, `${crypto.randomBytes(12).toString('hex')}${PHOTO_TYPES[file.mimetype]}`),
  }),
  limits: { fileSize: 3 * 1024 * 1024, files: 1, fields: 10 },
  fileFilter: (req, file, cb) => cb(null, Boolean(PHOTO_TYPES[file.mimetype])),
}).single('photo');

function withPhoto(req, res, next) {
  upload(req, res, (err) => {
    if (err) {
      return res.status(400).send(views.adminTeachers(ctx(req), {
        teachers: db.teachers.all(), accounts: db.users.teachers(), counts: adminCounts(), error: `${t(req.lang, 'admin.teachers.photo')}: ${t(req.lang, 'admin.teachers.photoHint')}.`,
      }));
    }
    next();
  });
}

function removePhoto(photo) {
  if (photo && photo.startsWith('/uploads/')) fs.rm(path.join(db.UPLOADS_DIR, path.basename(photo)), { force: true }, () => {});
}

// Акаунт, з яким пов'язана картка, має бути викладачем.
const teacherAccount = (value) => {
  const user = db.users.byId(Number(value));
  return user && user.is_teacher ? user.id : null;
};

const teacherInput = (req, current = {}) => ({
  name: field(req.body.name, 80),
  role: field(req.body.role, 120),
  about: field(req.body.about, 400),
  photo: req.file ? `/uploads/${req.file.filename}` : current.photo,
  userId: teacherAccount(req.body.user_id),
});

admin.get('/teachers', (req, res) => {
  res.send(views.adminTeachers(ctx(req), { teachers: db.teachers.all(), accounts: db.users.teachers(), counts: adminCounts() }));
});

admin.post('/teachers', withPhoto, (req, res) => {
  const teacher = teacherInput(req);
  if (teacher.name) db.teachers.create(teacher);
  else removePhoto(teacher.photo);
  res.redirect('/admin/teachers?msg=admin.saved');
});

admin.post('/teachers/:id/delete', (req, res) => {
  const current = db.teachers.all().find((x) => x.id === Number(req.params.id));
  if (current) {
    removePhoto(current.photo);
    db.teachers.remove(current.id);
  }
  res.redirect('/admin/teachers?msg=admin.deleted');
});

admin.post('/teachers/:id', withPhoto, (req, res) => {
  const current = db.teachers.all().find((x) => x.id === Number(req.params.id));
  const teacher = teacherInput(req, current || {});
  if (!current || !teacher.name) {
    if (req.file) removePhoto(teacher.photo);
    return res.redirect('/admin/teachers');
  }
  if (req.file) removePhoto(current.photo);
  db.teachers.update(current.id, teacher);
  res.redirect('/admin/teachers?msg=admin.saved');
});

admin.get('/reviews', (req, res) => {
  res.send(views.adminReviews(ctx(req), { reviews: db.reviews.all(), counts: adminCounts() }));
});

admin.post('/reviews', (req, res) => {
  const name = field(req.body.name, 80);
  const text = field(req.body.text, 800);
  if (name && text) db.reviews.create({ name, text });
  res.redirect('/admin/reviews?msg=admin.saved');
});

admin.post('/reviews/:id/delete', (req, res) => {
  db.reviews.remove(Number(req.params.id));
  res.redirect('/admin/reviews?msg=admin.deleted');
});

// ---------- Налаштування ----------

const SETTINGS_FIELDS = Object.keys(config.EDITABLE).filter((k) => k !== 'tgChatId');

// Значення, що зараз діють (з адмінки або зі змінних Railway).
const currentSettings = () => Object.fromEntries(SETTINGS_FIELDS.map((k) => [k, config.get(k)]));

const renderSettings = (req, res, { notice, error, values } = {}) => {
  res.status(error ? 400 : 200).send(views.adminSettings(ctx(req), {
    values: values || currentSettings(), counts: adminCounts(), notice, error,
  }));
};

const SETTINGS_RULES = {
  email: (v) => !v || isEmail(v),
  lessonPrice: (v) => /^\d{1,6}$/.test(v) && Number(v) > 0,
  packageLessons: (v) => /^\d{1,2}$/.test(v) && Number(v) >= 2 && Number(v) <= 50,
  packagePrice: (v) => /^\d{1,7}$/.test(v) && Number(v) > 0,
  paymentUrl: (v) => !v || /^https:\/\/\S+$/i.test(v),
  siteUrl: (v) => !v || /^https?:\/\/[^\s/]+\.[^\s/]+$/i.test(v),
  metaPixelId: (v) => !v || /^\d{6,20}$/.test(v),
  gaId: (v) => !v || /^G-[A-Z0-9]{4,20}$/i.test(v),
  tgBotToken: (v) => !v || /^\d{5,15}:[\w-]{20,}$/.test(v),
  smsToken: (v) => !v || /^\S{10,200}$/.test(v),
  smsSender: (v) => !v || /^[A-Za-z0-9 ._-]{2,11}$/.test(v),
};

admin.get('/settings', (req, res) => renderSettings(req, res));

admin.post('/settings', (req, res) => {
  const values = Object.fromEntries(SETTINGS_FIELDS.map((k) => [k, field(req.body[k], 600)]));
  values.siteUrl = values.siteUrl.replace(/\/+$/, '');
  for (const [key, valid] of Object.entries(SETTINGS_RULES)) {
    if (!valid(values[key])) {
      return renderSettings(req, res, { values, error: t(req.lang, 'admin.settings.invalid', { field: t(req.lang, `admin.settings.${key}`) }) });
    }
  }
  // Новий токен бота — новий чат: його треба підключити ще раз.
  if (values.tgBotToken !== config.get('tgBotToken')) values.tgChatId = '';
  db.settings.save(values);
  res.redirect('/admin/settings?msg=admin.saved');
});

// «Зберегти й підключити»: кнопка в блоці Telegram надсилає всю форму налаштувань.
// Зберігаємо токен з форми (якщо він новий і правильний), а потім шукаємо чат, де адміністратор натиснув Start.
admin.post('/telegram/connect', async (req, res) => {
  const posted = field(req.body.tgBotToken, 200);
  if (posted && posted !== config.get('tgBotToken')) {
    if (!SETTINGS_RULES.tgBotToken(posted)) {
      return renderSettings(req, res, { error: t(req.lang, 'admin.settings.invalid', { field: t(req.lang, 'admin.settings.tgBotToken') }) });
    }
    db.settings.save({ tgBotToken: posted, tgChatId: '' });
  }
  const { token } = config.telegramBot;
  if (!token) {
    return renderSettings(req, res, { error: t(req.lang, 'admin.settings.invalid', { field: t(req.lang, 'admin.settings.tgBotToken') }) });
  }
  try {
    const result = await notify.connect(token);
    if (!result.ok) return renderSettings(req, res, { error: t(req.lang, 'admin.settings.tgNoChat', { bot: result.bot }) });
    db.settings.save({ tgChatId: result.chatId });
    renderSettings(req, res, { notice: t(req.lang, 'admin.settings.tgOk', { bot: result.bot }) });
  } catch (err) {
    renderSettings(req, res, { error: t(req.lang, 'admin.settings.tgFail', { error: err.message }) });
  }
});

admin.post('/telegram/test', async (req, res) => {
  const sent = await notify.send([`🔔 Тестове сповіщення від ${config.schoolName}. Усе працює!`]);
  if (sent) return res.redirect('/admin/settings?msg=admin.settings.tgTestSent');
  renderSettings(req, res, { error: t(req.lang, 'admin.settings.tgFail', { error: 'chat' }) });
});

app.use('/admin', admin);

app.use(notFound);

app.use((err, req, res, next) => {
  if (err.status === 404 || err.statusCode === 404) return notFound(req, res);
  console.error(err);
  res.status(500).send(t(req.lang || DEFAULT_LANG, 'err.server'));
});

app.listen(config.port, '0.0.0.0', () => {
  console.log(`${config.schoolName} працює на порту ${config.port}: http://localhost:${config.port}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') console.error(`\n  Порт ${config.port} уже зайнятий. Запустіть на іншому: PORT=8080 npm start\n`);
  else console.error(err);
  process.exit(1);
});
