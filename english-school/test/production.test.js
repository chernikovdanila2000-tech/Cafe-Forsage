// Робочий режим, як на Railway: демо-оплата вимкнена, база на Volume, cookie лише через HTTPS.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startSite, makeBrowser, plain } = require('./helpers');

const volume = fs.mkdtempSync(path.join(os.tmpdir(), 'inkwell-volume-'));
const ADMIN = { email: 'owner@test.ua', password: 'admin-pass-123' };
const site = startSite({
  RAILWAY_PROJECT_ID: 'test-project',
  RAILWAY_VOLUME_MOUNT_PATH: volume,
  DB_PATH: '',
  ADMIN_EMAIL: ADMIN.email,
  ADMIN_PASSWORD: ADMIN.password,
});
let browser;

before(async () => {
  await site.ready;
  browser = () => makeBrowser(site.base);
});

after(() => {
  site.stop();
  fs.rmSync(volume, { recursive: true, force: true });
});

test('база на Volume, попередження немає', async () => {
  assert.ok(fs.existsSync(path.join(volume, 'school.db')));
  const health = JSON.parse((await browser().request('/health')).text);
  assert.deepEqual(health, { ok: true, persistentStorage: true });
  assert.doesNotMatch(site.log(), /УВАГА/);
});

test('cookie входу захищені (Secure, HttpOnly)', async () => {
  const b = browser();
  const r = await b.request('/register', { method: 'POST', form: { name: 'Оля', email: 'olia@test.ua', phone: '+380501112233', password: 'secret123', agree: '1' } });
  const sid = r.cookies.find((c) => c.startsWith('sid='));
  assert.match(sid, /Secure/);
  assert.match(sid, /HttpOnly/);
});

test('без способу оплати: замовлення приймається, демо-кнопки немає', async () => {
  const b = browser();
  await b.request('/register', { method: 'POST', form: { name: 'Іван', email: 'ivan@test.ua', phone: '+380501112244', password: 'secret123', agree: '1' } });
  const page = (await b.request('/pay/single')).text;
  assert.doesNotMatch(page, /\/pay\/demo\//);
  assert.match(plain(page), /Замовлення прийнято/);
  const id = page.match(/№ (\d+)/)[1];
  assert.equal((await b.request(`/pay/demo/${id}`, { method: 'POST' })).status, 404);
  assert.doesNotMatch((await b.request('/dashboard')).text, /balance-num/);
});

test('оплата за реквізитами та за посиланням', async () => {
  const admin = browser();
  await admin.request('/login', { method: 'POST', form: ADMIN });
  const base = { lessonPrice: '450', packageLessons: '8', packageDiscount: '20' };
  await admin.request('/admin/settings', { method: 'POST', form: { ...base, paymentDetails: 'IBAN UA12 3456\nФОП Тест' } });

  const b = browser();
  await b.request('/register', { method: 'POST', form: { name: 'Петро', email: 'petro@test.ua', phone: '+380501112255', password: 'secret123', agree: '1' } });
  const details = plain((await b.request('/pay/monthly')).text);
  assert.match(details, /IBAN UA12 3456/);
  assert.match(details, /замовлення № \d+/);
  assert.match(details, /2\s880 ₴/);

  await admin.request('/admin/settings', {
    method: 'POST',
    form: { ...base, paymentDetails: 'IBAN UA12 3456', paymentUrl: 'https://pay.example.com/i?order={payment}&sum={amount}' },
  });
  const redirect = await b.request('/pay/single');
  assert.match(redirect.location, /^https:\/\/pay\.example\.com\/i\?order=\d+&sum=450$/);
});

test('у робочому режимі адмін бачить чекліст без попередження про базу', async () => {
  const admin = browser();
  await admin.request('/login', { method: 'POST', form: ADMIN });
  const page = plain((await admin.request('/admin')).text);
  assert.doesNotMatch(page, /не на постійному диску/);
  assert.match(page, /Готовність до запуску/);
});
