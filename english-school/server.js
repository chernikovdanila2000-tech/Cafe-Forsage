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
const { t, LANGS, DEFAULT_LANG } = require('./i18n');

db.ensureAdmin();
db.sessions.cleanup();

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

function requireUser(req, res, next) {
  if (req.user) return next();
  res.redirect(`/login?msg=login_required&next=${encodeURIComponent(req.originalUrl)}`);
}

function requireAdmin(req, res, next) {
  if (req.user?.is_admin) return next();
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

app.get('/', (req, res) => {
  res.send(views.home(ctx(req), { teachers: db.teachers.all(), reviews: db.reviews.all() }));
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
  res.send(views.legalPage(ctx(req), { html: legal.offer(), title: t(req.lang, 'footer.offer') }));
});

app.get('/privacy', (req, res) => {
  res.send(views.legalPage(ctx(req), { html: legal.privacy(), title: t(req.lang, 'footer.privacy') }));
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
  if (password.length < 8) return fail('err.password');
  if (!values.agree) return fail('err.agree');
  if (db.users.byEmail(values.email)) return fail('err.exists');
  if (limitRegister(req)) return fail('msg.too_many', 429);

  const userId = db.users.create({ ...values, password, source: req.source });
  notify.events.registration({ ...values, source: req.source });
  startSession(res, userId);
  res.redirect(req.body.next ? safeNext(req.body.next) : '/dashboard?msg=registered');
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
  res.redirect(safeNext(req.body.next || (user.is_admin ? '/admin' : '/dashboard')));
});

app.post('/logout', (req, res) => {
  const token = readCookie(req, COOKIE);
  if (token) db.sessions.destroy(token);
  res.clearCookie(COOKIE);
  res.redirect('/?msg=loggedout');
});

app.get('/forgot', (req, res) => res.send(views.forgot(ctx(req))));

// ---------- Особистий кабінет ----------

app.get('/dashboard', requireUser, (req, res) => {
  res.send(views.dashboard(ctx(req), {
    balance: db.lessons.balance(req.user.id),
    orders: db.orders.forUser(req.user.id),
  }));
});

app.get('/account', requireUser, (req, res) => res.send(views.account(ctx(req), {})));

app.post('/account', requireUser, (req, res) => {
  const name = field(req.body.name, 80);
  if (!name) return res.status(400).send(views.account(ctx(req), { error: t(req.lang, 'err.nameEmpty') }));
  db.users.updateProfile(req.user.id, {
    name,
    phone: field(req.body.phone, 30),
    level: views.LEVEL_CODES.includes(req.body.level) ? req.body.level : req.user.level,
  });
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
app.get('/pay/:product', requireUser, (req, res) => {
  const product = config.products[req.params.product];
  if (!product) return notFound(req, res);
  const existing = db.orders.forUser(req.user.id).find((o) => o.product === product.id && o.status === 'pending');
  const order = db.orders.create(req.user.id, product);
  if (!existing) notify.events.order(order, req.user, views.productName(product.id, 'uk'));

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
  res.send(views.adminStudents(ctx(req), { users: db.users.all(), counts: adminCounts(), notice }));
};

admin.get('/students', (req, res) => renderStudents(req, res));

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
        teachers: db.teachers.all(), counts: adminCounts(), error: `${t(req.lang, 'admin.teachers.photo')}: ${t(req.lang, 'admin.teachers.photoHint')}.`,
      }));
    }
    next();
  });
}

function removePhoto(photo) {
  if (photo && photo.startsWith('/uploads/')) fs.rm(path.join(db.UPLOADS_DIR, path.basename(photo)), { force: true }, () => {});
}

const teacherInput = (req, current = {}) => ({
  name: field(req.body.name, 80),
  role: field(req.body.role, 120),
  about: field(req.body.about, 400),
  photo: req.file ? `/uploads/${req.file.filename}` : current.photo,
});

admin.get('/teachers', (req, res) => {
  res.send(views.adminTeachers(ctx(req), { teachers: db.teachers.all(), counts: adminCounts() }));
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
  packageDiscount: (v) => /^\d{1,2}$/.test(v) && Number(v) <= 90,
  paymentUrl: (v) => !v || /^https:\/\/\S+$/i.test(v),
  siteUrl: (v) => !v || /^https?:\/\/[^\s/]+\.[^\s/]+$/i.test(v),
  metaPixelId: (v) => !v || /^\d{6,20}$/.test(v),
  gaId: (v) => !v || /^G-[A-Z0-9]{4,20}$/i.test(v),
  tgBotToken: (v) => !v || /^\d{5,15}:[\w-]{20,}$/.test(v),
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

admin.post('/telegram/connect', async (req, res) => {
  const { token } = config.telegramBot;
  if (!token) return res.redirect('/admin/settings');
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
