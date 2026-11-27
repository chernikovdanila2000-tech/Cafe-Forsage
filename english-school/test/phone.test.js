// Підтвердження номера телефону кодом з SMS (TurboSMS).

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startSite, makeBrowser, plain } = require('./helpers');

const ADMIN = { email: 'admin@test.ua', password: 'admin12345' };
const site = startSite({ ADMIN_EMAIL: ADMIN.email, ADMIN_PASSWORD: ADMIN.password, DEMO_PAYMENTS: 'true' });
const browser = () => makeBrowser(site.base);
const codeFor = (digits) => [...site.sms.messages].reverse().find((m) => m.to === digits).text.match(/(\d{6})/)[1];
let ip = 1;
const register = (b, name, email, phone) => b.request('/register', {
  method: 'POST',
  headers: { 'x-forwarded-for': `10.1.0.${ip++}` },
  form: { name, email, phone, password: 'secret123', agree: '1' },
});

before(async () => {
  await site.ready;
  // Учень, який зареєструвався ще до SMS, вважається підтвердженим.
  await register(browser(), 'Старий', 'old@test.ua', '0670000001');
  const admin = browser();
  await admin.request('/login', { method: 'POST', form: ADMIN });
  const r = await admin.request('/admin/settings', { method: 'POST', form: { lessonPrice: '350', packageLessons: '8', packagePrice: '2550', smsToken: 'test-token-123', smsSender: 'Inkwell' } });
  assert.match(r.location, /admin\.saved/);
});

after(() => site.stop());

test('без SMS-налаштувань реєстрація працює як раніше, старі акаунти не потребують підтвердження', async () => {
  const old = browser();
  await old.request('/login', { method: 'POST', form: { email: 'old@test.ua', password: 'secret123' } });
  assert.equal((await old.request('/dashboard')).status, 200);
});

test('нова реєстрація: код з SMS, неправильний код, підтвердження', async () => {
  const b = browser();
  const r = await register(b, 'Крістіна', 'kris@test.ua', '067 123 45 67');
  assert.equal(r.location, '/verify-phone?next=%2Fdashboard%3Fmsg%3Dregistered');
  await new Promise((res) => setTimeout(res, 150));
  const sent = site.sms.messages.find((m) => m.to === '380671234567');
  assert.ok(sent, 'SMS надіслано на нормалізований номер');
  assert.equal(sent.auth, 'Bearer test-token-123');
  assert.match(sent.text, /Inkwell Academy: ваш код \d{6}/);

  // Поки номер не підтверджено — кабінет, запис і оплата недоступні.
  assert.match((await b.request('/dashboard')).location, /^\/verify-phone/);
  assert.match((await b.request('/pay/single')).location, /^\/verify-phone/);
  const page = plain((await b.request('/verify-phone')).text);
  assert.match(page, /Підтвердіть номер телефону/);
  assert.match(page, /\+380671234567/);
  assert.equal(site.sms.messages.filter((m) => m.to === '380671234567').length, 1, 'повторне відкриття сторінки не шле нове SMS');

  const wrong = await b.request('/verify-phone', { method: 'POST', form: { code: '000000' === codeFor('380671234567') ? '111111' : '000000' } });
  assert.equal(wrong.status, 400);
  assert.match(plain(wrong.text), /Невірний код/);

  // Повторне надсилання — не частіше ніж раз на хвилину.
  assert.match(plain((await b.request('/verify-phone/resend', { method: 'POST' })).text), /зачекайте хвилину/);

  site.telegram.messages.length = 0;
  const ok = await b.request('/verify-phone?next=%2Fdashboard%3Fmsg%3Dregistered', { method: 'POST', form: { code: codeFor('380671234567') } });
  assert.equal(ok.location, '/dashboard?msg=registered');
  assert.equal((await b.request('/dashboard')).status, 200);
  await new Promise((res) => setTimeout(res, 150));
  assert.ok(site.telegram.messages.length === 0 || site.telegram.messages.some((m) => m.includes('Номер підтверджено')));
});

test('один номер — один акаунт; можна змінити номер на сторінці підтвердження', async () => {
  const dup = await register(browser(), 'Друга', 'second@test.ua', '+380 67 123 45 67');
  assert.equal(dup.status, 400);
  assert.match(plain(dup.text), /уже підтверджено в іншому акаунті/);

  const bad = await register(browser(), 'Кривий', 'bad@test.ua', '12345');
  assert.equal(bad.status, 400);

  const b = browser();
  await register(b, 'Олег', 'oleg@test.ua', '0501112233');
  const taken = await b.request('/verify-phone/change', { method: 'POST', form: { phone: '0671234567' } });
  assert.match(plain(taken.text), /уже підтверджено в іншому акаунті/);
  const changed = await b.request('/verify-phone/change', { method: 'POST', form: { phone: '0509998877' } });
  assert.match(changed.location, /^\/verify-phone\?msg=sent/);
  await b.request('/verify-phone', { method: 'POST', form: { code: codeFor('380509998877') } });
  assert.equal((await b.request('/dashboard')).status, 200);
  assert.match((await b.request('/account')).text, /value="\+380509998877"/);
  // Зміна номера в профілі — знову потрібне підтвердження.
  const edit = await b.request('/account', { method: 'POST', form: { name: 'Олег', phone: '0505554433' } });
  assert.equal(edit.location, '/verify-phone?next=%2Faccount');
  assert.match((await b.request('/dashboard')).location, /^\/verify-phone/);
  await b.request('/verify-phone');
  await b.request('/verify-phone?next=%2Faccount', { method: 'POST', form: { code: codeFor('380505554433') } });
  assert.equal((await b.request('/dashboard')).status, 200);
});

test('після 5 невдалих спроб код більше не приймається', async () => {
  const b = browser();
  await register(b, 'Тест', 'brute@test.ua', '0631234567');
  for (let i = 0; i < 5; i++) await b.request('/verify-phone', { method: 'POST', form: { code: 'x' } });
  const r = await b.request('/verify-phone', { method: 'POST', form: { code: codeFor('380631234567') } });
  assert.match(plain(r.text), /Забагато спроб/);
});
