// Встроенная база SQLite есть только в Node.js 22.13+. На старой версии сразу говорим, что делать.
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(`\n  Нужен Node.js 22.13 или новее, сейчас установлен ${process.version}.\n  Скачайте актуальную LTS-версию: https://nodejs.org\n`);
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

db.ensureAdmin();
db.sessions.cleanup();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

const COOKIE = 'sid';

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
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

// Пускаем дальше только по ссылкам внутри сайта, чтобы ?next= нельзя было увести на чужой домен.
const safeNext = (value) => (typeof value === 'string' && /^\/(?![/\\])/.test(value) ? value : '/dashboard');

function requireUser(req, res, next) {
  if (req.user) return next();
  res.redirect(`/login?msg=login_required&next=${encodeURIComponent(req.originalUrl)}`);
}

function requireAdmin(req, res, next) {
  if (req.user?.is_admin) return next();
  res.status(404).send(views.notFound({ user: req.user }));
}

const field = (value, max = 200) => String(value ?? '').trim().slice(0, max);
const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

// ---------- Публичные страницы ----------

app.get('/', (req, res) => {
  res.send(views.home({ user: req.user, msg: req.query.msg, lessons: db.lessons.all() }));
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
  res.send(views.authPage({ mode: 'register', msg: req.query.msg }));
});

app.post('/register', (req, res) => {
  const values = {
    name: field(req.body.name, 80),
    email: field(req.body.email, 120).toLowerCase(),
    phone: field(req.body.phone, 30),
    level: views.LEVELS[req.body.level] ? req.body.level : 'A1',
  };
  const password = String(req.body.password || '');
  const fail = (error) => res.status(400).send(views.authPage({ mode: 'register', error, values }));

  if (!values.name) return fail('Укажите имя.');
  if (!isEmail(values.email)) return fail('Проверьте email — кажется, в нём ошибка.');
  if (password.length < 8) return fail('Пароль должен быть не короче 8 символов.');
  if (db.users.byEmail(values.email)) return fail('Аккаунт с таким email уже существует. Попробуйте войти.');

  const userId = db.users.create({ ...values, password });
  startSession(res, userId);
  res.redirect('/dashboard?msg=registered');
});

app.get('/login', (req, res) => {
  if (req.user) return res.redirect(safeNext(req.query.next));
  res.send(views.authPage({ mode: 'login', msg: req.query.msg, next: req.query.next }));
});

app.post('/login', (req, res) => {
  const email = field(req.body.email, 120);
  const user = db.users.authenticate(email, String(req.body.password || ''));
  if (!user) {
    return res.status(401).send(views.authPage({
      mode: 'login', error: 'Неверный email или пароль.', values: { email }, next: req.body.next,
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
    user: req.user,
    msg: req.query.msg,
    lessons: db.lessons.forUser(req.user.id),
    payments: db.payments.forUser(req.user.id),
  }));
});

app.get('/account', requireUser, (req, res) => {
  res.send(views.account({ user: req.user, msg: req.query.msg }));
});

app.post('/account', requireUser, (req, res) => {
  const name = field(req.body.name, 80);
  if (!name) return res.status(400).send(views.account({ user: req.user, error: 'Имя не может быть пустым.' }));
  db.users.updateProfile(req.user.id, {
    name,
    phone: field(req.body.phone, 30),
    level: views.LEVELS[req.body.level] ? req.body.level : req.user.level,
  });
  res.redirect('/account?msg=profile_saved');
});

app.post('/account/password', requireUser, (req, res) => {
  const password = String(req.body.password || '');
  if (!db.users.authenticate(req.user.email, String(req.body.current || ''))) {
    return res.status(400).send(views.account({ user: req.user, error: 'Текущий пароль указан неверно.' }));
  }
  if (password.length < 8) {
    return res.status(400).send(views.account({ user: req.user, error: 'Новый пароль должен быть не короче 8 символов.' }));
  }
  db.users.updatePassword(req.user.id, password);
  res.redirect('/account?msg=password_changed');
});

// ---------- Уроки ----------

function loadLesson(req, res, next) {
  const lesson = db.lessons.byId(Number(req.params.id));
  if (!lesson) return res.status(404).send(views.notFound({ user: req.user }));
  req.lesson = lesson;
  next();
}

app.get('/lessons/:id', requireUser, loadLesson, (req, res) => {
  const { lesson, user } = req;
  const list = db.lessons.forUser(user.id);
  const index = list.findIndex((l) => l.id === lesson.id);
  res.send(views.lessonPage({
    user,
    msg: req.query.msg,
    lesson,
    hasAccess: db.lessons.hasAccess(user, lesson),
    completed: !!list[index].completed,
    pending: !!list[index].pending,
    prev: list[index - 1],
    next: list[index + 1],
  }));
});

app.post('/lessons/:id/complete', requireUser, loadLesson, (req, res) => {
  if (db.lessons.hasAccess(req.user, req.lesson)) db.lessons.complete(req.user.id, req.lesson.id);
  res.redirect(`/lessons/${req.lesson.id}?msg=completed`);
});

// ---------- Оплата ----------

function buildPaymentUrl(payment, lesson, user) {
  const params = { payment: payment.id, lesson: lesson.id, amount: payment.amount, email: user.email };
  if (/\{(payment|lesson|amount|email)\}/.test(config.paymentUrl)) {
    return config.paymentUrl.replace(/\{(payment|lesson|amount|email)\}/g, (_, key) => encodeURIComponent(params[key]));
  }
  const url = new URL(config.paymentUrl);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

// Ссылка «Оплатить урок»: создаёт запись о платеже и отправляет ученика на страницу оплаты.
app.get('/pay/:id', requireUser, loadLesson, (req, res) => {
  const { lesson, user } = req;
  if (db.lessons.hasAccess(user, lesson)) return res.redirect(`/lessons/${lesson.id}`);
  const payment = db.payments.create(user.id, lesson.id, lesson.price);
  if (config.paymentUrl) return res.redirect(buildPaymentUrl(payment, lesson, user));
  res.send(views.demoCheckout({ user, lesson, payment }));
});

// Демо-оплата работает, только пока не указан PAYMENT_URL.
app.post('/pay/demo/:paymentId', requireUser, (req, res) => {
  const payment = db.payments.byId(Number(req.params.paymentId));
  if (config.paymentUrl || !payment || payment.user_id !== req.user.id) {
    return res.status(404).send(views.notFound({ user: req.user }));
  }
  db.payments.markPaid(payment.id);
  res.redirect(`/lessons/${payment.lesson_id}?msg=paid`);
});

// Адрес возврата после оплаты — укажите его в настройках платёжного сервиса.
app.get('/payment/success', requireUser, (req, res) => {
  res.redirect('/dashboard?msg=payment_pending');
});

// ---------- Админ-панель ----------

app.get('/admin', requireUser, requireAdmin, (req, res) => {
  res.send(views.admin({
    user: req.user,
    msg: req.query.msg,
    users: db.users.all(),
    payments: db.payments.all(),
    requests: db.requests.all(),
  }));
});

app.post('/admin/payments/:id/confirm', requireUser, requireAdmin, (req, res) => {
  db.payments.markPaid(Number(req.params.id));
  res.redirect('/admin?msg=confirmed');
});

app.post('/admin/payments/:id/cancel', requireUser, requireAdmin, (req, res) => {
  db.payments.cancel(Number(req.params.id));
  res.redirect('/admin?msg=cancelled');
});

app.use((req, res) => res.status(404).send(views.notFound({ user: req.user })));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Что-то пошло не так. Попробуйте обновить страницу.');
});

app.listen(config.port, '0.0.0.0', () => {
  console.log(`${config.schoolName} запущен на порту ${config.port}: http://localhost:${config.port}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') console.error(`\n  Порт ${config.port} уже занят. Запустите на другом: PORT=8080 npm start\n`);
  else console.error(err);
  process.exit(1);
});
