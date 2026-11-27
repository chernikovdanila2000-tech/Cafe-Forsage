// Графік викладача й запис учнів на вільний час.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startSite, makeBrowser, plain, checkout } = require('./helpers');

const ADMIN = { email: 'owner@test.ua', password: 'admin-pass-123' };
const site = startSite({ ADMIN_EMAIL: ADMIN.email, ADMIN_PASSWORD: ADMIN.password });
let browser;
let admin;
let teacher;
let student;
let other;
const ids = {};
const HOURS = Array.from({ length: 16 }, (_, i) => `${String(7 + i).padStart(2, '0')}:00`);

async function register(b, name, email) {
  await b.request('/register', { method: 'POST', form: { name, email, phone: '+380501234567', password: 'secret123', agree: '1' } });
}

async function pay(b, product = 'monthly') {
  const id = (await checkout(b, product)).text.match(/№ (\d+)/)[1];
  await admin.request(`/admin/orders/${id}/confirm`, { method: 'POST' });
}

const slotsOf = (html) => [...html.matchAll(/name="slot" value="([\d-]+\|\d\d:\d\d)"/g)].map((m) => m[1]);

before(async () => {
  await site.ready;
  browser = () => makeBrowser(site.base);
  admin = browser();
  teacher = browser();
  student = browser();
  other = browser();
  await admin.request('/login', { method: 'POST', form: ADMIN });
  await register(teacher, 'Олександра', 'teacher@test.ua');
  await register(student, 'Максим', 'student@test.ua');
  await register(other, 'Софія', 'other@test.ua');
  const page = (await admin.request('/admin/students')).text;
  for (const [key, email] of [['teacher', 'teacher@test.ua'], ['student', 'student@test.ua'], ['other', 'other@test.ua']]) {
    ids[key] = Number(page.match(new RegExp(`${email.replace('.', '\\.')}[\\s\\S]*?/admin/users/(\\d+)/(?:teacher|role)`))[1]);
  }
  await admin.request(`/admin/users/${ids.teacher}/role`, { method: 'POST', form: { teacher: '1' } });
  await admin.request('/admin/settings', { method: 'POST', form: { lessonPrice: '350', packageLessons: '8', packagePrice: '2550', tgBotToken: '123456:ABCDEFGHIJKLMNOPQRSTUVWXYZ_abc' } });
  await admin.request('/admin/telegram/connect', { method: 'POST' });
});

after(() => site.stop());

test('викладач заповнює графік (неправильні години ігноруються)', async () => {
  const editor = (await teacher.request('/teacher')).text;
  assert.match(plain(editor), /Мій графік/);
  assert.equal((editor.match(/name="d1" value="/g) || []).length, 16, '16 годин на день');
  const form = new URLSearchParams();
  for (let d = 1; d <= 7; d++) for (const h of HOURS) form.append(`d${d}`, h);
  form.append('d1', '03:00');
  form.append('d9', '10:00');
  const r = await teacher.request('/teacher/schedule', { method: 'POST', body: form.toString(), headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  assert.match(r.location, /msg=teacher\.scheduleSaved/);
  const saved = (await teacher.request('/teacher')).text;
  assert.equal((saved.match(/ checked>/g) || []).length, 7 * 16);
  assert.doesNotMatch(saved, /03:00/);
});

test('без оплати — один безкоштовний пробний урок', async () => {
  await student.request('/choose-teacher', { method: 'POST', form: { teacher_id: String(ids.teacher) } });
  const dash = (await student.request('/dashboard')).text;
  assert.match(plain(dash), /Записатися на заняття/);
  assert.match(plain(dash), /Пробний урок — безкоштовно, 30 хв/);
  const free = slotsOf(dash);
  assert.ok(free.length > 0, 'на пробний можна обрати час');
  site.telegram.messages.length = 0;
  const r = await student.request('/book', { method: 'POST', form: { slot: free.at(-30) } });
  assert.equal(r.location, '/dashboard?msg=booked_trial#book');
  await new Promise((res) => setTimeout(res, 200));
  assert.ok(site.telegram.messages.some((m) => m.includes('пробний урок') && m.includes('Максим')));
  const after = (await student.request('/dashboard')).text;
  assert.match(plain(after), /Пробний · 30 хв/);
  // Другий пробний — не можна: далі тільки після оплати.
  assert.match(plain(after), /оплатіть разове заняття або абонемент/);
  assert.equal(slotsOf(after).length, 0);
  const again = await student.request('/book', { method: 'POST', form: { slot: free.at(-29) } });
  assert.match(again.location, /booking_no_lessons/);
  // Викладач і адмін бачать пробний урок в окремому блоці.
  assert.match(plain((await teacher.request('/teacher')).text), /Пробні уроки \(1\).*Пробний · 30 хв.*Максим/);
  assert.match(plain((await admin.request('/admin/schedule')).text), /Пробні уроки \(1\).*Максим/);
});

test('учень записується; час зникає для інших; ліміт за оплаченими заняттями', async () => {
  await pay(student, 'single');
  const dash = (await student.request('/dashboard')).text;
  assert.match(plain(dash), /Можна записатися ще на занять: 1/);
  const slots = slotsOf(dash);
  assert.ok(slots.length > 100, 'вільних слотів багато на 2 тижні');
  // Обираємо слот через ~3 дні (його можна скасувати).
  const later = slots[slots.length - 20];
  site.telegram.messages.length = 0;
  const r = await student.request('/book', { method: 'POST', form: { slot: later } });
  assert.equal(r.location, '/dashboard?msg=booked#book');
  await new Promise((res) => setTimeout(res, 200));
  assert.ok(site.telegram.messages.some((m) => m.includes('Новий запис') && m.includes('Максим')));

  const after = (await student.request('/dashboard')).text;
  assert.match(plain(after), /Мої заняття/);
  assert.match(plain(after), /оплатіть разове заняття або абонемент/, 'оплачене заняття вже використано на запис');

  // Інший учень того ж викладача не бачить зайнятий час і не може його взяти.
  await other.request('/choose-teacher', { method: 'POST', form: { teacher_id: String(ids.teacher) } });
  await pay(other);
  const otherDash = (await other.request('/dashboard')).text;
  assert.ok(!slotsOf(otherDash).includes(later));
  // Зайнята година видна іншим червоною з позначкою «зайнято», а самому учню — як «ваш запис».
  const [date, time] = later.split('|');
  assert.match(otherDash, new RegExp(`class="slot slot-taken"[^>]*>${time} <small>зайнято</small>`));
  assert.match((await student.request('/dashboard')).text, new RegExp(`class="slot slot-mine">${time} <small>ваш запис</small>`));
  assert.match((await browser().request(`/schedule/${ids.teacher}`)).text, /slot-taken/, 'гість теж бачить зайнятий час');
  assert.ok(date);
  const taken = await other.request('/book', { method: 'POST', form: { slot: later } });
  assert.match(taken.location, /booking_taken/);

  // Викладач і адмін бачать запис.
  assert.match(plain((await teacher.request('/teacher')).text), /Найближчі заняття.*Максим/);
  assert.match(plain((await admin.request('/admin/schedule')).text), /Максим.*Олександра/);
});

test('скасування: учень — не пізніше ніж за 24 год', async () => {
  const slots = slotsOf((await other.request('/dashboard')).text);
  await other.request('/book', { method: 'POST', form: { slot: slots[0] } }); // найближчий — менше ніж за 24 год
  await other.request('/book', { method: 'POST', form: { slot: slots[slots.length - 1] } }); // через ~2 тижні
  const dash = (await other.request('/dashboard')).text;
  const cancelIds = [...dash.matchAll(/\/bookings\/(\d+)\/cancel/g)].map((m) => m[1]);
  assert.equal(cancelIds.length, 1, 'скасувати можна лише далекий запис');
  assert.match(plain(dash), /Скасувати можна не пізніше ніж за 24 год/);

  // Спроба скасувати близький запис напряму — відмова.
  const rows = (await admin.request('/admin/schedule')).text.split('<tr>').filter((row) => row.includes('Софія'));
  const nearId = rows.map((row) => row.match(/\/bookings\/(\d+)\/cancel/)[1]).find((id) => !cancelIds.includes(id));
  const late = await other.request(`/bookings/${nearId}/cancel`, { method: 'POST' });
  assert.match(late.location, /booking_too_late/);

  const ok = await other.request(`/bookings/${cancelIds[0]}/cancel`, { method: 'POST' });
  assert.match(ok.location, /booking_cancelled/);
  // Чужий запис скасувати не можна.
  assert.equal((await student.request(`/bookings/${nearId}/cancel`, { method: 'POST' })).status, 404);
  // Викладач може скасувати свій запис у будь-який час.
  const byTeacher = await teacher.request(`/bookings/${nearId}/cancel`, { method: 'POST' });
  assert.match(byTeacher.location, /teacher\.bookingCancelled/);
});

test('пробний — лише якщо занять ще не було (навіть після скасування звичайного запису)', async () => {
  // Софія вже оплатила абонемент і мала записи — пробний їй недоступний, навіть коли заняття скінчаться.
  const dash = plain((await other.request('/dashboard')).text);
  assert.doesNotMatch(dash, /Пробний урок — безкоштовно/);
  // Учень, якому адмін відмітив проведене заняття, теж не отримує пробний.
  const veteran = browser();
  // Окрема IP-адреса, щоб не впертися в ліміт реєстрацій з однієї адреси.
  await veteran.request('/register', { method: 'POST', headers: { 'x-forwarded-for': '10.0.0.9' }, form: { name: 'Олег', email: 'oleg@test.ua', phone: '+380501234567', password: 'secret123', agree: '1' } });
  await veteran.request('/choose-teacher', { method: 'POST', form: { teacher_id: String(ids.teacher) } });
  await pay(veteran, 'single');
  const page = (await admin.request('/admin/students')).text;
  const id = page.match(/oleg@test\.ua[\s\S]*?\/admin\/users\/(\d+)\/held/)[1];
  await admin.request(`/admin/users/${id}/held`, { method: 'POST' });
  const vd = (await veteran.request('/dashboard')).text;
  assert.doesNotMatch(plain(vd), /Пробний урок — безкоштовно/);
  assert.equal(slotsOf(vd).length, 0);
  const r = await veteran.request('/book', { method: 'POST', form: { slot: '2099-01-01|10:00' } });
  assert.match(r.location, /booking_no_lessons/);
});

test('учень бачить вільні дні викладача в картці вибору', async () => {
  const fresh = browser();
  await register(fresh, 'Новий', 'fresh@test.ua');
  assert.match(plain((await fresh.request('/dashboard')).text), /Вільні дні: пн, вт, ср, чт, пт, сб, нд/);
});

test('кнопка «Вільний час»: сторінка для гостя, учня без оплати й запис до іншого викладача', async () => {
  // Картка на головній із тим самим ім'ям — кнопка веде на сторінку графіка.
  const fd = new FormData();
  fd.append('name', 'Олександра');
  fd.append('role', '2 роки досвіду · B2');
  await fetch(`${site.base}/admin/teachers`, { method: 'POST', body: fd, headers: { cookie: [...admin.jar].map(([k, v]) => `${k}=${v}`).join('; ') }, redirect: 'manual' });
  const home = (await browser().request('/')).text;
  assert.match(home, new RegExp(`href="/schedule/${ids.teacher}"[^>]*>[\\s\\S]*?Вільний час`));
  assert.match(plain(home), /Пробний урок безкоштовно/);

  // Гість бачить години, але не кнопки запису.
  const guest = (await browser().request(`/schedule/${ids.teacher}`)).text;
  assert.match(plain(guest), /Вільний час і запис/);
  assert.match(plain(guest), /увійдіть або створіть акаунт/);
  assert.match(guest, /class="slot slot-view"/);
  assert.equal(slotsOf(guest).length, 0);
  assert.match(guest, new RegExp(`/register\\?next=%2Fschedule%2F${ids.teacher}`));

  assert.match(plain(guest), /Пробний урок — 30 хвилин безкоштовно/);

  // Новий учень без викладача й без оплати: може обрати час для пробного уроку.
  const nobody = browser();
  await register(nobody, 'Тарас', 'taras@test.ua');
  const unpaid = (await nobody.request(`/schedule/${ids.teacher}`)).text;
  assert.match(plain(unpaid), /Пробний урок — безкоштовно, 30 хв/);
  assert.ok(slotsOf(unpaid).length > 0);

  // Після оплати записується прямо зі сторінки — і викладач стає його.
  await pay(nobody, 'single');
  const paid = (await nobody.request(`/schedule/${ids.teacher}`)).text;
  assert.match(plain(paid), /після запису Олександра стане вашим викладачем/);
  const slot = slotsOf(paid).at(-5);
  const r = await nobody.request('/book', { method: 'POST', form: { slot, teacher_id: String(ids.teacher) } });
  assert.equal(r.location, `/schedule/${ids.teacher}?msg=booked`);
  const dash = plain((await nobody.request('/dashboard')).text);
  assert.match(dash, /Ваш викладач Олександра/);
  assert.match(dash, /Мої заняття/);

  // Кнопка є й у картках вибору в кабінеті; неіснуючий викладач — 404.
  assert.match((await nobody.request('/dashboard')).text, /href="\/schedule\/\d+"/);
  assert.equal((await browser().request(`/schedule/${ids.student}`)).status, 404);
});
