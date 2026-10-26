// Встроенная база SQLite есть только в Node.js 22.13+. На старой версии сразу говорим, что делать.
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(`\n  Потрібен Node.js 22.13 або новіший, зараз встановлено ${process.version}.\n  Завантажте актуальну LTS-версію: https://nodejs.org\n`);
  process.exit(1);
}

// Скрываем предупреждение «SQLite is an experimental feature» — на работу сайта оно не влияет.
const emitWarning = process.emitWarning;
process.emitWarning = (warning, ...args) => {
  const type = typeof args[0] === 'string' ? args[0] : args[0]?.type;
  if (type === 'ExperimentalWarning' && String(warning).includes('SQLite')) return;
  return emitWarning.call(process, warning, ...args);
};

const path = require('node:path');
const express = require('express');
const config = require('./config');
const db = require('./db');
const views = require('./views');
const { t, LANGS, DEFAULT_LANG } = require('./i18n');

db.ensureAdmin();
db.sessions.cleanup();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

const COOKIE = 'sid';
const LANG_COOKIE = 'lang';

// ---------- Сессии ----------

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function startSession(res, userId) {
  res.cookie(COOKIE, db.sessions.create(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.secureCookies,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

app.use((req, res, next) => {
  req.user = db.sessions.user(readCookie(req, COOKIE));
  const lang = readCookie(req, LANG_COOKIE);
  req.lang = LANGS.includes(lang) ? lang : DEFAULT_LANG;
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

// Пускаем дальше только по ссылкам внутри сайта, чтобы ?next= нельзя было увести на чужой домен.
const safeNext = (value) => (typeof value === 'string' && /^\/(?![/\\])/.test(value) ? value : '/dashboard');

// Перемикач мови: запам'ятовуємо вибір у cookie й повертаємо на ту саму сторінку.
app.get('/lang/:code', (req, res) => {
  const lang = LANGS.includes(req.params.code) ? req.params.code : DEFAULT_LANG;
  res.cookie(LANG_COOKIE, lang, { sameSite: 'lax', secure: config.secureCookies, maxAge: 365 * 24 * 60 * 60 * 1000 });
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

function requireUser(req, res, next) {
  if (req.user) return next();
  res.redirect(`/login?msg=login_required&next=${encodeURIComponent(req.originalUrl)}`);
}

function requireAdmin(req, res, next) {
  if (req.user?.is_admin) return next();
  res.status(404).send(views.notFound({ lang: req.lang, user: req.user }));
}

const field = (value, max = 200) => String(value ?? '').trim().slice(0, max);
const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

// ---------- Публичные страницы ----------

app.get('/', (req, res) => {
  res.send(views.home({ lang: req.lang, user: req.user, msg: req.query.msg }));
});

app.post('/request', (req, res) => {
  const name = field(req.body.name, 80);
  const contact = field(req.body.contact, 120);
  if (name && contact) db.requests.create({ name, contact, message: field(req.body.message, 1000) });
  res.redirect('/?msg=request_sent#trial');
});

// ---------- Регистрация и вход ----------

app.get('/register', (req, res) => {
  if (req.user) return res.redirect('/dashboard');
  res.send(views.authPage({ lang: req.lang, mode: 'register', msg: req.query.msg, next: req.query.next }));
});

app.post('/register', (req, res) => {
  const values = {
    name: field(req.body.name, 80),
    email: field(req.body.email, 120).toLowerCase(),
    phone: field(req.body.phone, 30),
    level: views.LEVEL_CODES.includes(req.body.level) ? req.body.level : 'A1',
  };
  const password = String(req.body.password || '');
  const fail = (key) => res.status(400).send(views.authPage({ lang: req.lang, mode: 'register', error: t(req.lang, key), values, next: req.body.next }));

  if (!values.name) return fail('err.name');
  if (!isEmail(values.email)) return fail('err.email');
  if (!values.phone) return fail('err.phone');
  if (password.length < 8) return fail('err.password');
  if (db.users.byEmail(values.email)) return fail('err.exists');

  const userId = db.users.create({ ...values, password });
  startSession(res, userId);
  res.redirect(req.body.next ? safeNext(req.body.next) : '/dashboard?msg=registered');
});

app.get('/login', (req, res) => {
  if (req.user) return res.redirect(safeNext(req.query.next));
  res.send(views.authPage({ lang: req.lang, mode: 'login', msg: req.query.msg, next: req.query.next }));
});

app.post('/login', (req, res) => {
  const email = field(req.body.email, 120);
  const user = db.users.authenticate(email, String(req.body.password || ''));
  if (!user) {
    return res.status(401).send(views.authPage({
      lang: req.lang, mode: 'login', error: t(req.lang, 'err.login'), values: { email }, next: req.body.next,
    }));
  }
  startSession(res, user.id);
  res.redirect(safeNext(req.body.next));
});

app.post('/logout', (req, res) => {
  const token = readCookie(req, COOKIE);
  if (token) db.sessions.destroy(token);
  res.clearCookie(COOKIE);
  res.redirect('/?msg=loggedout');
});

// ---------- Личный кабинет ----------

app.get('/dashboard', requireUser, (req, res) => {
  res.send(views.dashboard({
    lang: req.lang,
    user: req.user,
    msg: req.query.msg,
    balance: db.lessons.balance(req.user.id),
    orders: db.orders.forUser(req.user.id),
  }));
});

app.get('/account', requireUser, (req, res) => {
  res.send(views.account({ lang: req.lang, user: req.user, msg: req.query.msg }));
});

app.post('/account', requireUser, (req, res) => {
  const name = field(req.body.name, 80);
  if (!name) return res.status(400).send(views.account({ lang: req.lang, user: req.user, error: t(req.lang, 'err.nameEmpty') }));
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
    return res.status(400).send(views.account({ lang: req.lang, user: req.user, error: t(req.lang, 'err.currentPassword') }));
  }
  if (password.length < 8) {
    return res.status(400).send(views.account({ lang: req.lang, user: req.user, error: t(req.lang, 'err.newPassword') }));
  }
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

// Посилання «Оплатити»: /pay/single — разове заняття, /pay/monthly — абонемент.
// Створює замовлення й відправляє учня на сторінку оплати.
app.get('/pay/:product', requireUser, (req, res) => {
  const product = config.products[req.params.product];
  if (!product) return res.status(404).send(views.notFound({ lang: req.lang, user: req.user }));
  const order = db.orders.create(req.user.id, product);
  if (config.paymentUrl) return res.redirect(buildPaymentUrl(order, req.user));
  res.send(views.demoCheckout({ lang: req.lang, user: req.user, product, order }));
});

// Демо-оплата працює, лише поки не вказано PAYMENT_URL.
app.post('/pay/demo/:orderId', requireUser, (req, res) => {
  const order = db.orders.byId(Number(req.params.orderId));
  if (config.paymentUrl || !order || order.user_id !== req.user.id) {
    return res.status(404).send(views.notFound({ lang: req.lang, user: req.user }));
  }
  db.orders.markPaid(order.id);
  res.redirect('/dashboard?msg=paid');
});

// Адреса повернення після оплати — вкажіть її в налаштуваннях платіжного сервісу.
app.get('/payment/success', requireUser, (req, res) => {
  res.redirect('/dashboard?msg=payment_pending');
});

// ---------- Адмін-панель ----------

app.get('/admin', requireUser, requireAdmin, (req, res) => {
  res.send(views.admin({
    lang: req.lang,
    user: req.user,
    msg: req.query.msg,
    users: db.users.all(),
    orders: db.orders.all(),
    requests: db.requests.all(),
  }));
});

app.post('/admin/orders/:id/confirm', requireUser, requireAdmin, (req, res) => {
  db.orders.markPaid(Number(req.params.id));
  res.redirect('/admin?msg=confirmed');
});

app.post('/admin/orders/:id/cancel', requireUser, requireAdmin, (req, res) => {
  db.orders.cancel(Number(req.params.id));
  res.redirect('/admin?msg=cancelled');
});

// Відмітка «заняття проведено» списує одне заняття з оплачених.
app.post('/admin/users/:id/held', requireUser, requireAdmin, (req, res) => {
  db.lessons.markHeld(Number(req.params.id));
  res.redirect('/admin?msg=held');
});

app.post('/admin/users/:id/undo', requireUser, requireAdmin, (req, res) => {
  db.lessons.undoLast(Number(req.params.id));
  res.redirect('/admin?msg=undone');
});

app.use((req, res) => res.status(404).send(views.notFound({ lang: req.lang, user: req.user })));

app.use((err, req, res, next) => {
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
