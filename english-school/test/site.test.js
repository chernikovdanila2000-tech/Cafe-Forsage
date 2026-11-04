// Повна перевірка сайту: запускає сервер із порожньою базою та фальшивим Telegram
// і проходить шлях відвідувача, учня й адміністратора. Запуск: npm test

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startSite, makeBrowser, plain } = require('./helpers');

const ADMIN = { email: 'owner@test.ua', password: 'admin-pass-123' };
const site = startSite({ ADMIN_EMAIL: ADMIN.email, ADMIN_PASSWORD: ADMIN.password, DEMO_PAYMENTS: 'true' });
const { telegram } = site;
let BASE;
let browser;

before(async () => {
  await site.ready;
  BASE = site.base;
  browser = () => makeBrowser(BASE);
});

after(() => site.stop());

const tick = () => new Promise((r) => setTimeout(r, 150));

test('головна сторінка: ціни, тексти, мета-теги', async () => {
  const b = browser();
  const { status, text } = await b.request('/');
  assert.equal(status, 200);
  const page = plain(text);
  assert.match(page, /Англійська, яка залишається з вами/);
  assert.match(page, /450 ₴/);
  assert.match(page, /2\s880 ₴/);
  assert.match(page, /3\s600 ₴/);
  assert.match(page, /360 ₴ за заняття замість 450 ₴/);
  assert.match(page, /Економія 720 ₴/);
  assert.match(page, /Шкільна програма/);
  assert.match(text, /<html lang="uk">/);
  assert.match(text, /og:image" content="http:\/\/127\.0\.0\.1:\d+\/og\.png"/);
  // Порожні розділи не показуються, вигаданих людей немає.
  assert.doesNotMatch(text, /id="teachers"/);
  assert.doesNotMatch(text, /id="reviews"/);
  // Без налаштувань аналітики скриптів пікселя немає.
  assert.doesNotMatch(text, /fbq\(/);
});

test('англійська версія', async () => {
  const b = browser();
  const r = await b.request('/lang/en', { headers: { referer: `${BASE}/` } });
  assert.equal(r.location, '/');
  const { text } = await b.request('/');
  assert.match(text, /<html lang="en">/);
  assert.match(plain(text), /English that stays with you/);
});

test('службові адреси', async () => {
  const b = browser();
  const health = JSON.parse((await b.request('/health')).text);
  assert.equal(health.ok, true);
  assert.match((await b.request('/robots.txt')).text, /Disallow: \/admin/);
  assert.match((await b.request('/sitemap.xml')).text, /<loc>http:\/\/127\.0\.0\.1:\d+\/offer<\/loc>/);
  assert.equal((await b.request('/og.png')).status, 200);
  assert.equal((await b.request('/favicon.svg')).status, 200);
  assert.equal((await b.request('/nema-takoi')).status, 404);
  assert.equal((await b.request('/uploads/nema.jpg')).status, 404);
  assert.match(plain((await b.request('/offer')).text), /Публічний договір/);
  assert.match(plain((await b.request('/privacy')).text), /Політика конфіденційності/);
});

test('заявка на консультацію з utm-міткою → сторінка «Дякуємо» й сповіщення', async () => {
  const b = browser();
  await b.request('/?utm_source=instagram&utm_campaign=start');
  const r = await b.request('/request', { method: 'POST', form: { name: 'Оксана', contact: '+380671112233', message: 'для школи' } });
  assert.equal(r.status, 302);
  assert.equal(r.location, '/thanks');
  assert.match(plain((await b.request('/thanks')).text), /заявку отримано/);
  // Бот (заповнене приховане поле) — заявка не зберігається.
  await b.request('/request', { method: 'POST', form: { name: 'bot', contact: 'bot', website: 'spam' } });
});

test('реєстрація: перевірки й успіх', async () => {
  const b = browser();
  const base = { name: 'Тарас Шевченко', email: 'Taras@Test.UA', phone: '+380 50 111 22 33', password: 'secret123', agree: '1' };
  const noAgree = await b.request('/register', { method: 'POST', form: { ...base, agree: '' } });
  assert.equal(noAgree.status, 400);
  assert.match(plain(noAgree.text), /погодьтеся з умовами оферти/);
  const shortPass = await b.request('/register', { method: 'POST', form: { ...base, password: '123' } });
  assert.match(plain(shortPass.text), /не коротшим за 8 символів/);
  const noPhone = await b.request('/register', { method: 'POST', form: { ...base, phone: '12' } });
  assert.match(plain(noPhone.text), /Вкажіть телефон/);

  const ok = await b.request('/register', { method: 'POST', form: base });
  assert.equal(ok.location, '/dashboard?msg=registered');
  const dash = await b.request('/dashboard?msg=registered');
  assert.match(plain(dash.text), /Вітаємо, Тарас!/);
  assert.match(plain(dash.text), /Оплачених занять поки немає/);

  const dup = await browser().request('/register', { method: 'POST', form: { ...base, email: 'taras@test.ua' } });
  assert.equal(dup.status, 400);
  assert.match(plain(dup.text), /email уже існує/);
});

test('вхід: email без урахування регістру, неправильний пароль, вихід', async () => {
  const b = browser();
  const bad = await b.request('/login', { method: 'POST', form: { email: 'taras@test.ua', password: 'wrong-pass' } });
  assert.equal(bad.status, 401);
  const ok = await b.request('/login', { method: 'POST', form: { email: '  TARAS@test.ua ', password: 'secret123' } });
  assert.equal(ok.location, '/dashboard');
  assert.equal((await b.request('/dashboard')).status, 200);
  await b.request('/logout', { method: 'POST' });
  const after = await b.request('/dashboard');
  assert.match(after.location, /^\/login/);
});

test('оплата для незалогіненого веде на вхід і повертає на оплату після реєстрації', async () => {
  const b = browser();
  const r = await b.request('/pay/monthly');
  assert.equal(r.location, '/login?msg=login_required&next=%2Fpay%2Fmonthly');
  const reg = await b.request('/register', {
    method: 'POST',
    form: { name: 'Ірина', email: 'iryna@test.ua', phone: '0501234567', password: 'secret123', agree: '1', next: '/pay/monthly' },
  });
  assert.equal(reg.location, '/pay/monthly');
  const checkout = plain((await b.request('/pay/monthly')).text);
  assert.match(checkout, /Абонемент на місяць/);
  assert.match(checkout, /2\s880 ₴/);
  assert.match(checkout, /−20%/);
});

let adminBrowser;

test('адмін: вхід, огляд, чекліст, заявка з джерелом', async () => {
  adminBrowser = browser();
  const login = await adminBrowser.request('/login', { method: 'POST', form: ADMIN });
  assert.equal(login.location, '/admin');
  const overview = plain((await adminBrowser.request('/admin')).text);
  assert.match(overview, /Готовність до запуску/);
  assert.match(overview, /Сповіщення в Telegram/);
  const requests = plain((await adminBrowser.request('/admin/requests')).text);
  assert.match(requests, /Оксана/);
  assert.match(requests, /instagram \/ start/);
  assert.doesNotMatch(requests, /bot bot/);
  // Учень не має доступу до адмінки.
  const student = browser();
  await student.request('/login', { method: 'POST', form: { email: 'taras@test.ua', password: 'secret123' } });
  assert.equal((await student.request('/admin')).status, 404);
  assert.equal((await student.request('/admin/settings', { method: 'POST', form: { lessonPrice: '1' } })).status, 404);
});

test('адмін: налаштування, перевірка полів, ціни одразу на сайті', async () => {
  const bad = await adminBrowser.request('/admin/settings', { method: 'POST', form: { lessonPrice: 'abc', packageLessons: '8', packageDiscount: '20' } });
  assert.equal(bad.status, 400);
  assert.match(plain(bad.text), /Ціна заняття/);

  const form = {
    phone: '+380 67 000 11 22', email: 'hello@inkwell.academy', telegram: '@inkwell_academy', instagram: 'inkwell.academy',
    lessonPrice: '500', packageLessons: '8', packageDiscount: '20',
    paymentUrl: '', paymentDetails: 'IBAN UA00 0000 0000 0000 0000 0000 0000 0\nФОП Тест',
    legalSeller: 'ФОП Тестовий Тест Тестович', legalTaxId: '1234567890', legalAddress: 'м. Київ',
    siteUrl: 'https://inkwell.academy/', metaPixelId: '123456789012345', gaId: 'G-TEST1234', tgBotToken: '123456:ABCDEFGHIJKLMNOPQRSTUVWXYZ_abc',
  };
  const ok = await adminBrowser.request('/admin/settings', { method: 'POST', form });
  assert.equal(ok.location, '/admin/settings?msg=admin.saved');

  const home = await browser().request('/');
  const page = plain(home.text);
  assert.match(page, /500 ₴/);
  assert.match(page, /3\s200 ₴/, 'абонемент 8 × 500 − 20% = 3 200 ₴');
  assert.match(page, /Економія 800 ₴/);
  assert.match(home.text, /fbq\('init',"123456789012345"\)/);
  assert.match(home.text, /googletagmanager\.com\/gtag\/js\?id=G-TEST1234/);
  assert.match(home.text, /https:\/\/t\.me\/inkwell_academy/);
  assert.match(home.text, /https:\/\/instagram\.com\/inkwell\.academy/);
  assert.match(home.text, /og:image" content="https:\/\/inkwell\.academy\/og\.png"/);
  assert.match(plain((await browser().request('/offer')).text), /ФОП Тестовий Тест Тестович/);
  assert.match(plain((await browser().request('/privacy')).text), /Meta Pixel/);

  // Повертаємо базову ціну 450 ₴ для наступних перевірок.
  await adminBrowser.request('/admin/settings', { method: 'POST', form: { ...form, lessonPrice: '450' } });
});

test('адмін: підключення Telegram і сповіщення', async () => {
  const connect = await adminBrowser.request('/admin/telegram/connect', { method: 'POST' });
  assert.match(plain(connect.text), /Готово! Перевірте Telegram/);
  telegram.messages.length = 0;
  await browser().request('/request', { method: 'POST', form: { name: 'Петро', contact: '@petro_ua' } });
  await tick();
  assert.ok(telegram.messages.some((m) => m.includes('Нова заявка') && m.includes('Петро')), 'сповіщення про заявку');
});

test('оплата: замовлення без дублів, адмін підтверджує, заняття списуються', async () => {
  const b = browser();
  await b.request('/register', { method: 'POST', form: { name: 'Марія', email: 'maria@test.ua', phone: '+380631112233', password: 'secret123', agree: '1' } });
  telegram.messages.length = 0;

  // DEMO_PAYMENTS увімкнено в тесті, тож спершу перевіряємо демо-шлях на окремому учні.
  const page = plain((await b.request('/pay/monthly')).text);
  assert.match(page, /2\s880 ₴/);
  await tick();
  assert.ok(telegram.messages.some((m) => m.includes('Нове замовлення')), 'сповіщення про замовлення');

  // Повторне відкриття оплати не створює дубль замовлення.
  await b.request('/pay/monthly');
  const orders = plain((await adminBrowser.request('/admin/orders')).text);
  assert.equal((orders.match(/maria@test\.ua/g) || []).length, 1);

  const orderId = Number((await adminBrowser.request('/admin/orders')).text.match(/\/admin\/orders\/(\d+)\/confirm/)[1]);
  await adminBrowser.request(`/admin/orders/${orderId}/confirm`, { method: 'POST' });
  await tick();
  assert.ok(telegram.messages.some((m) => m.includes('Оплачено')), 'сповіщення про оплату');
  // Повторне підтвердження нічого не змінює.
  await adminBrowser.request(`/admin/orders/${orderId}/confirm`, { method: 'POST' });

  let dash = (await b.request('/dashboard')).text;
  assert.match(dash, /balance-num">8</);

  const studentsPage = (await adminBrowser.request('/admin/students')).text;
  const userId = Number(studentsPage.match(/maria@test\.ua[\s\S]*?\/admin\/users\/(\d+)\/held/)[1]);
  await adminBrowser.request(`/admin/users/${userId}/held`, { method: 'POST' });
  await adminBrowser.request(`/admin/users/${userId}/held`, { method: 'POST' });
  dash = (await b.request('/dashboard')).text;
  assert.match(dash, /balance-num">6</);
  await adminBrowser.request(`/admin/users/${userId}/undo`, { method: 'POST' });
  dash = (await b.request('/dashboard')).text;
  assert.match(dash, /balance-num">7</);
});

test('демо-оплата працює лише для власного замовлення', async () => {
  const a = browser();
  await a.request('/register', { method: 'POST', form: { name: 'Андрій', email: 'andrii@test.ua', phone: '+380671234567', password: 'secret123', agree: '1' } });
  const checkout = (await a.request('/pay/single')).text;
  const orderId = checkout.match(/\/pay\/demo\/(\d+)/)[1];
  const stranger = browser();
  await stranger.request('/login', { method: 'POST', form: { email: 'taras@test.ua', password: 'secret123' } });
  assert.equal((await stranger.request(`/pay/demo/${orderId}`, { method: 'POST' })).status, 404);
  const paid = await a.request(`/pay/demo/${orderId}`, { method: 'POST' });
  assert.equal(paid.location, '/dashboard?msg=paid');
  assert.match((await a.request('/dashboard')).text, /balance-num">1</);
});

test('адмін: скидання пароля учня', async () => {
  const page = (await adminBrowser.request('/admin/students')).text;
  const userId = page.match(/taras@test\.ua[\s\S]*?\/admin\/users\/(\d+)\/reset/)[1];
  const reset = plain((await adminBrowser.request(`/admin/users/${userId}/reset`, { method: 'POST' })).text);
  const password = reset.match(/taras@test\.ua: (\S+) —/)[1];
  const b = browser();
  assert.equal((await b.request('/login', { method: 'POST', form: { email: 'taras@test.ua', password: 'secret123' } })).status, 401);
  assert.equal((await b.request('/login', { method: 'POST', form: { email: 'taras@test.ua', password } })).location, '/dashboard');
});

test('адмін: викладач із фото та відгук з\'являються на сайті', async () => {
  const png = fs.readFileSync(path.join(__dirname, '..', 'public', 'apple-touch-icon.png'));
  const fd = new FormData();
  fd.append('name', 'Олена Іваненко');
  fd.append('role', 'CELTA · 6 років досвіду');
  fd.append('about', 'Займається з дітьми й дорослими.');
  fd.append('photo', new Blob([png], { type: 'image/png' }), 'photo.png');
  const cookie = [...adminBrowser.jar].map(([k, v]) => `${k}=${v}`).join('; ');
  const res = await fetch(`${BASE}/admin/teachers`, { method: 'POST', body: fd, headers: { cookie }, redirect: 'manual' });
  assert.equal(res.status, 302);

  await adminBrowser.request('/admin/reviews', { method: 'POST', form: { name: 'Марія, 16 років', text: 'Нарешті перестала боятися говорити!' } });

  const home = (await browser().request('/')).text;
  assert.match(home, /id="teachers"/);
  assert.match(plain(home), /Олена Іваненко/);
  const photo = home.match(/src="(\/uploads\/[a-f0-9]+\.png)"/)[1];
  assert.equal((await browser().request(photo)).status, 200);
  assert.match(plain(home), /Нарешті перестала боятися говорити!/);

  // Не-зображення відхиляється.
  const fd2 = new FormData();
  fd2.append('name', 'Тест');
  fd2.append('photo', new Blob(['<script>'], { type: 'text/html' }), 'x.html');
  await fetch(`${BASE}/admin/teachers`, { method: 'POST', body: fd2, headers: { cookie }, redirect: 'manual' });
  const uploads = fs.readdirSync(path.join(site.dir, 'uploads'));
  assert.ok(uploads.every((f) => /\.(png|jpg|webp)$/.test(f)));
});

test('захист від XSS у заявках', async () => {
  await browser().request('/request', { method: 'POST', form: { name: '<script>alert(1)</script>', contact: '+380500000000' } });
  const page = (await adminBrowser.request('/admin/requests')).text;
  assert.doesNotMatch(page, /<script>alert\(1\)<\/script>/);
  assert.match(page, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test('обмеження спроб входу', async () => {
  const b = browser();
  let last;
  for (let i = 0; i < 12; i++) last = await b.request('/login', { method: 'POST', form: { email: 'x@test.ua', password: 'nope' } });
  assert.equal(last.status, 429);
});
