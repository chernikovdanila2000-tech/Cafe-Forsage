// Викладачі: роль, призначення, вибір учнем (з фото), «Заняття проведено». Чату на сайті немає.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startSite, makeBrowser, plain } = require('./helpers');

const ADMIN = { email: 'owner@test.ua', password: 'admin-pass-123' };
const site = startSite({ ADMIN_EMAIL: ADMIN.email, ADMIN_PASSWORD: ADMIN.password });
let browser;
let admin;
let teacher;
let teacher2;
let student;
let stranger;
const ids = {};

const cookie = (b) => [...b.jar].map(([k, v]) => `${k}=${v}`).join('; ');

async function register(b, name, email) {
  await b.request('/register', { method: 'POST', form: { name, email, phone: '+380501234567', password: 'secret123', agree: '1' } });
}

async function addCard(fields, withPhoto) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  if (withPhoto) {
    const png = fs.readFileSync(path.join(__dirname, '..', 'public', 'apple-touch-icon.png'));
    fd.append('photo', new Blob([png], { type: 'image/png' }), 'photo.png');
  }
  await fetch(`${site.base}/admin/teachers`, { method: 'POST', body: fd, headers: { cookie: cookie(admin) }, redirect: 'manual' });
}

before(async () => {
  await site.ready;
  browser = () => makeBrowser(site.base);
  admin = browser();
  teacher = browser();
  teacher2 = browser();
  student = browser();
  stranger = browser();
  await admin.request('/login', { method: 'POST', form: ADMIN });
  await register(teacher, 'Олександра', 'teacher@test.ua');
  await register(teacher2, 'Ірина Нова', 'teacher2@test.ua');
  await register(student, 'Максим Учень', 'student@test.ua');
  await register(stranger, 'Чужий Учень', 'stranger@test.ua');
  const page = (await admin.request('/admin/students')).text;
  for (const [key, email] of [['teacher', 'teacher@test.ua'], ['teacher2', 'teacher2@test.ua'], ['student', 'student@test.ua'], ['stranger', 'stranger@test.ua']]) {
    ids[key] = Number(page.match(new RegExp(`${email.replace('.', '\\.')}[\\s\\S]*?/admin/users/(\\d+)/(?:teacher|role)`))[1]);
  }
});

after(() => site.stop());

test('чату на сайті більше немає', async () => {
  for (const url of ['/chat', `/chat/${ids.student}`, '/files/1', '/admin/chats']) {
    assert.equal((await admin.request(url)).status, 404, url);
  }
  assert.doesNotMatch((await student.request('/dashboard')).text, /href="\/chat/);
});

test('поки немає викладачів, блоку вибору немає', async () => {
  assert.doesNotMatch(plain((await student.request('/dashboard')).text), /Оберіть свого викладача/);
  assert.equal((await teacher.request('/teacher')).status, 404);
});

test('адмін робить викладачами; учень бачить їх з аватаркою', async () => {
  await admin.request(`/admin/users/${ids.teacher}/role`, { method: 'POST', form: { teacher: '1' } });
  await admin.request(`/admin/users/${ids.teacher2}/role`, { method: 'POST', form: { teacher: '1' } });
  // Картка з тим самим ім'ям, що й акаунт, — фото підтягується без ручного зв'язування.
  await addCard({ name: 'Олександра', role: 'CELTA', about: 'Займається з дітьми й дорослими.' }, true);
  // Картка з іншим ім'ям, пов'язана вручну.
  await addCard({ name: 'Ірина (IELTS)', role: 'IELTS 8.0', user_id: String(ids.teacher2) }, true);

  const dash = (await student.request('/dashboard')).text;
  assert.match(plain(dash), /Оберіть свого викладача/);
  assert.match(plain(dash), /Олександра CELTA Займається з дітьми й дорослими\./);
  assert.match(plain(dash), /Ірина \(IELTS\) IELTS 8\.0/);
  assert.equal((dash.match(/choose-card[\s\S]*?<img class="avatar avatar-photo" src="\/uploads\/[a-f0-9]+\.png"/g) || []).length, 2, 'в обох — фото');

  const relogin = browser();
  const r = await relogin.request('/login', { method: 'POST', form: { email: 'teacher@test.ua', password: 'secret123' } });
  assert.equal(r.location, '/teacher');
});

test('учень обирає викладача й може змінити; Telegram отримує сповіщення', async () => {
  await admin.request('/admin/settings', { method: 'POST', form: { lessonPrice: '400', packageLessons: '8', packageLessonPrice: '350', tgBotToken: '123456:ABCDEFGHIJKLMNOPQRSTUVWXYZ_abc' } });
  await admin.request('/admin/telegram/connect', { method: 'POST' });
  site.telegram.messages.length = 0;

  await student.request('/choose-teacher', { method: 'POST', form: { teacher_id: String(ids.stranger) } });
  assert.match(plain((await student.request('/dashboard')).text), /Оберіть свого викладача/, 'звичайного учня обрати не можна');

  const chose = await student.request('/choose-teacher', { method: 'POST', form: { teacher_id: String(ids.teacher) } });
  assert.equal(chose.location, '/dashboard?msg=teacher_chosen');
  const dash = (await student.request('/dashboard?msg=teacher_chosen')).text;
  assert.match(plain(dash), /Викладач побачить вас у своєму списку учнів/);
  assert.match(dash, /teacher-card[\s\S]*?avatar-photo[\s\S]*?Олександра/);
  await new Promise((r) => setTimeout(r, 200));
  assert.ok(site.telegram.messages.some((m) => m.includes('Учень обрав викладача') && m.includes('Максим Учень')));

  assert.match(plain((await teacher.request('/teacher')).text), /Максим Учень/);
  await student.request('/choose-teacher', { method: 'POST', form: { teacher_id: String(ids.teacher2) } });
  assert.doesNotMatch(plain((await teacher.request('/teacher')).text), /Максим Учень/);
  assert.match(plain((await teacher2.request('/teacher')).text), /Максим Учень/);
});

test('адмін призначає викладача вручну', async () => {
  await admin.request(`/admin/users/${ids.stranger}/teacher`, { method: 'POST', form: { teacher_id: String(ids.teacher) } });
  assert.match(plain((await teacher.request('/teacher')).text), /Чужий Учень/);
  assert.match(plain((await stranger.request('/dashboard')).text), /Ваш викладач Олександра/);
});

test('викладач відмічає заняття лише своїм учням', async () => {
  for (const b of [student, stranger]) {
    const order = (await b.request('/pay/single')).text.match(/№ (\d+)/)[1];
    await admin.request(`/admin/orders/${order}/confirm`, { method: 'POST' });
  }
  // Максим — учень teacher2, тож teacher не може списати йому заняття.
  await teacher.request(`/teacher/students/${ids.student}/held`, { method: 'POST' });
  assert.match((await student.request('/dashboard')).text, /balance-num">1</);
  await teacher2.request(`/teacher/students/${ids.student}/held`, { method: 'POST' });
  assert.match((await student.request('/dashboard')).text, /balance-num">0</);
});

test('зняття ролі викладача прибирає призначення', async () => {
  await admin.request(`/admin/users/${ids.teacher}/role`, { method: 'POST', form: { teacher: '0' } });
  assert.equal((await teacher.request('/teacher')).status, 404);
  assert.doesNotMatch(plain((await stranger.request('/dashboard')).text), /Ваш викладач Олександра/);
});
