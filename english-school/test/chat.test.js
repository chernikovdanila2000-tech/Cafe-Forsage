// Чат учня з викладачем: ролі, призначення, повідомлення з файлами, доступ.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startSite, makeBrowser, plain } = require('./helpers');

const ADMIN = { email: 'owner@test.ua', password: 'admin-pass-123' };
const site = startSite({ ADMIN_EMAIL: ADMIN.email, ADMIN_PASSWORD: ADMIN.password });
let browser;
let admin;
let teacher;
let student;
let stranger;
let studentId;
let teacherId;

const cookie = (b) => [...b.jar].map(([k, v]) => `${k}=${v}`).join('; ');

async function register(b, name, email) {
  await b.request('/register', { method: 'POST', form: { name, email, phone: '+380501234567', password: 'secret123', agree: '1' } });
}

// Надсилання повідомлення так, як це робить браузер (multipart + JSON-відповідь).
async function send(b, id, { body = '', files = [] } = {}) {
  const fd = new FormData();
  fd.append('body', body);
  for (const f of files) fd.append('files', new Blob([f.content], { type: f.type }), f.name);
  const res = await fetch(`${site.base}/chat/${id}`, {
    method: 'POST', body: fd, headers: { cookie: cookie(b), accept: 'application/json' },
  });
  return { status: res.status, data: await res.json() };
}

before(async () => {
  await site.ready;
  browser = () => makeBrowser(site.base);
  admin = browser();
  teacher = browser();
  student = browser();
  stranger = browser();
  await admin.request('/login', { method: 'POST', form: ADMIN });
  await register(teacher, 'Олена Викладачка', 'teacher@test.ua');
  await register(student, 'Максим Учень', 'student@test.ua');
  await register(stranger, 'Чужий Учень', 'stranger@test.ua');
  const page = (await admin.request('/admin/students')).text;
  studentId = Number(page.match(/student@test\.ua[\s\S]*?\/admin\/users\/(\d+)\/teacher/)[1]);
  teacherId = Number(page.match(/teacher@test\.ua[\s\S]*?\/admin\/users\/(\d+)\/role/)[1]);
});

after(() => site.stop());

test('без викладача чату немає', async () => {
  const dash = plain((await student.request('/dashboard')).text);
  assert.match(dash, /Чат з викладачем з'явиться тут/);
  assert.equal((await student.request('/chat')).location, '/dashboard');
  assert.equal((await teacher.request('/teacher')).status, 404, 'ще не викладач');
});

test('адмін робить викладача й призначає учня', async () => {
  const role = await admin.request(`/admin/users/${teacherId}/role`, { method: 'POST', form: { teacher: '1' } });
  assert.equal(role.location, '/admin/students?msg=admin.roleSaved');
  await admin.request(`/admin/users/${studentId}/teacher`, { method: 'POST', form: { teacher_id: String(teacherId) } });
  const students = plain((await admin.request('/admin/students')).text);
  assert.match(students, /викладач/);

  const dash = plain((await student.request('/dashboard')).text);
  assert.match(dash, /Ваш викладач: Олена Викладачка/);
  assert.equal((await student.request('/chat')).status, 200);
  // Викладач після входу потрапляє у свій кабінет.
  const relogin = browser();
  const r = await relogin.request('/login', { method: 'POST', form: { email: 'teacher@test.ua', password: 'secret123' } });
  assert.equal(r.location, '/teacher');
  assert.match(plain((await teacher.request('/teacher')).text), /Максим Учень/);
});

test('сповіщення в Telegram про повідомлення учня (не частіше раз на 10 хв)', async () => {
  await admin.request('/admin/settings', { method: 'POST', form: { lessonPrice: '450', packageLessons: '8', packageDiscount: '20', tgBotToken: '123456:ABCDEFGHIJKLMNOPQRSTUVWXYZ_abc' } });
  await admin.request('/admin/telegram/connect', { method: 'POST' });
  site.telegram.messages.length = 0;
  await send(student, studentId, { body: 'Перше питання' });
  await send(student, studentId, { body: 'Друге питання' });
  await new Promise((r) => setTimeout(r, 200));
  const chatNotes = site.telegram.messages.filter((m) => m.includes('Нове повідомлення в чаті'));
  assert.equal(chatNotes.length, 1);
  assert.match(chatNotes[0], /Максим Учень/);
  assert.match(chatNotes[0], /Перше питання/);
});

test('повідомлення, файли й непрочитані', async () => {
  const text = await send(student, studentId, { body: 'Добрий день! Ось моє домашнє https://example.com' });
  assert.equal(text.status, 200);
  assert.match(text.data.messages[0].html, /href="https:\/\/example\.com"/);

  const png = Buffer.from('89504e470d0a1a0a', 'hex');
  const withFiles = await send(student, studentId, {
    body: 'Фото й документ',
    files: [
      { name: 'фото.png', type: 'image/png', content: png },
      { name: 'Есе.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', content: 'docx' },
    ],
  });
  assert.equal(withFiles.data.messages.length, 2);
  assert.match(withFiles.data.messages[0].html, /<img src="\/files\/\d+"/);
  assert.match(withFiles.data.messages[1].html, /Есе\.docx/);

  // У викладача — значок непрочитаних.
  const home = (await teacher.request('/teacher')).text;
  assert.match(home, /class="badge[^"]*">5</);

  const chat = plain((await teacher.request(`/chat/${studentId}`)).text);
  assert.match(chat, /Добрий день! Ось моє домашнє/);
  assert.doesNotMatch((await teacher.request('/teacher')).text, /class="badge[^"]*">\d/, 'після відкриття чату прочитано');

  const reply = await send(teacher, studentId, { body: 'Дякую, перевірю!' });
  assert.equal(reply.status, 200);
  const poll = JSON.parse((await student.request(`/chat/${studentId}/messages?after=${withFiles.data.messages[1].id}`)).text);
  assert.equal(poll.messages.length, 1);
  assert.match(poll.messages[0].html, /Дякую, перевірю!/);
  assert.match(poll.messages[0].html, /викладач/);
});

test('файли відкриваються лише учасникам розмови', async () => {
  const page = (await student.request('/chat')).text;
  const fileUrl = page.match(/href="(\/files\/\d+)\?download=1"/)[1];
  const own = await fetch(site.base + fileUrl, { headers: { cookie: cookie(student) } });
  assert.equal(own.status, 200);
  assert.match(own.headers.get('content-disposition'), /attachment; filename\*=UTF-8''%D0%95%D1%81%D0%B5\.docx/);
  assert.equal((await fetch(site.base + fileUrl, { headers: { cookie: cookie(teacher) } })).status, 200);
  assert.equal((await fetch(site.base + fileUrl, { headers: { cookie: cookie(admin) } })).status, 200);
  assert.equal((await fetch(site.base + fileUrl, { headers: { cookie: cookie(stranger) } })).status, 404);
  assert.equal((await fetch(site.base + fileUrl, { redirect: 'manual' })).status, 302, 'без входу — на сторінку входу');
});

test('чужий чат недоступний', async () => {
  assert.equal((await stranger.request(`/chat/${studentId}`)).status, 404);
  assert.equal((await stranger.request(`/chat/${studentId}/messages`)).status, 404);
  const post = await send(stranger, studentId, { body: 'спам' });
  assert.equal(post.status, 404);
});

test('заборонені й порожні повідомлення', async () => {
  const html = await send(student, studentId, { files: [{ name: 'virus.html', type: 'text/html', content: '<script>alert(1)</script>' }] });
  assert.equal(html.status, 400);
  assert.match(html.data.error, /не можна надіслати/);
  const svg = await send(student, studentId, { files: [{ name: 'x.svg', type: 'image/svg+xml', content: '<svg/>' }] });
  assert.equal(svg.status, 400);
  const empty = await send(student, studentId, { body: '   ' });
  assert.equal(empty.status, 400);
  const xss = await send(student, studentId, { body: '<img src=x onerror=alert(1)>' });
  assert.doesNotMatch(xss.data.messages[0].html, /<img src=x/);
});

test('викладач відмічає заняття лише своїм учням', async () => {
  const order = (await student.request('/pay/single')).text;
  const orderId = order.match(/№ (\d+)/)[1];
  await admin.request(`/admin/orders/${orderId}/confirm`, { method: 'POST' });
  assert.match(plain((await teacher.request('/teacher')).text), /Заняття проведено/);
  await teacher.request(`/teacher/students/${studentId}/held`, { method: 'POST' });
  assert.match((await student.request('/dashboard')).text, /balance-num">0</);

  const strangerId = Number((await admin.request('/admin/students')).text.match(/stranger@test\.ua[\s\S]*?\/admin\/users\/(\d+)\/teacher/)[1]);
  const o2 = (await stranger.request('/pay/single')).text.match(/№ (\d+)/)[1];
  await admin.request(`/admin/orders/${o2}/confirm`, { method: 'POST' });
  await teacher.request(`/teacher/students/${strangerId}/held`, { method: 'POST' });
  assert.match((await stranger.request('/dashboard')).text, /balance-num">1</, 'чужому учню заняття не списалося');
});

test('адмін бачить усі чати й може писати', async () => {
  const chats = plain((await admin.request('/admin/chats')).text);
  assert.match(chats, /Максим Учень/);
  assert.match(chats, /Олена Викладачка/);
  const r = await send(admin, studentId, { body: 'Вітаю від школи!' });
  assert.equal(r.status, 200);
  assert.match(r.data.messages[0].html, /Ви/);
  const seen = (await student.request('/chat')).text;
  assert.match(plain(seen), /адміністратор/);
});

test('зняття ролі викладача прибирає призначення', async () => {
  await admin.request(`/admin/users/${teacherId}/role`, { method: 'POST', form: { teacher: '0' } });
  assert.equal((await teacher.request('/teacher')).status, 404);
  assert.equal((await student.request('/chat')).location, '/dashboard');
});
