// Сповіщення адміністратору в Telegram: нові заявки, реєстрації, оплати й вибір викладача.
// Бот підключається в адмін-панелі: токен від @BotFather → написати боту /start → «Підключити».

const config = require('./config');

const API = process.env.TELEGRAM_API_URL || 'https://api.telegram.org';

async function call(token, method, body) {
  const res = await fetch(`${API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
    signal: AbortSignal.timeout(8000),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) throw new Error(data.description || `Telegram ${res.status}`);
  return data.result;
}

const esc = (value) => String(value ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

// Надсилає повідомлення, якщо бот підключено. Помилки лише пишуться в лог — сайт працює далі.
function send(lines) {
  const { token, chatId } = config.telegramBot;
  if (!token || !chatId) return Promise.resolve(false);
  const text = lines.filter(Boolean).join('\n');
  return call(token, 'sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true })
    .then(() => true)
    .catch((err) => {
      console.error('Telegram:', err.message);
      return false;
    });
}

// Знаходить чат, у якому адміністратор написав боту, і надсилає тестове повідомлення.
async function connect(token) {
  const me = await call(token, 'getMe');
  const updates = await call(token, 'getUpdates', { limit: 50 });
  const chat = updates.map((u) => (u.message || u.my_chat_member || u.channel_post)?.chat).filter(Boolean).pop();
  if (!chat) return { ok: false, bot: me.username };
  await call(token, 'sendMessage', {
    chat_id: chat.id,
    text: `✅ Сповіщення ${config.schoolName} підключено. Сюди приходитимуть нові заявки, реєстрації та оплати.`,
  });
  return { ok: true, bot: me.username, chatId: String(chat.id) };
}

const site = () => config.siteUrl || '';

const events = {
  request: (r) => send([
    '📩 <b>Нова заявка на пробний урок</b>',
    `Ім'я: ${esc(r.name)}`,
    `Контакт: ${esc(r.contact)}`,
    r.message && `Повідомлення: ${esc(r.message)}`,
    r.source && `Джерело: ${esc(r.source)}`,
    site() && `${site()}/admin`,
  ]),
  registration: (u) => send([
    '👤 <b>Нова реєстрація</b>',
    `${esc(u.name)} · ${esc(u.email)}`,
    `Телефон: ${esc(u.phone)}`,
    u.source && `Джерело: ${esc(u.source)}`,
  ]),
  // extra: { teacher, bookings: ['28.11 о 10:00 (пробний)', …] } — щоб одразу було видно викладача й записи учня.
  order: (o, u, productName, extra = {}) => send([
    '🧾 <b>Нове замовлення</b> — очікує оплати',
    `№ ${o.id}: ${esc(productName)}, ${o.amount} ₴`,
    `${esc(u.name)} · ${esc(u.phone)} · ${esc(u.email)}`,
    o.contact && `Зв'язок: ${esc(o.contact)}`,
    extra.teacher && `Викладач: ${esc(extra.teacher)}`,
    extra.bookings && extra.bookings.length
      ? `Записи учня: ${esc(extra.bookings.join(', '))}`
      : 'Час заняття учень обере в графіку після підтвердження оплати.',
    site() && `Підтвердити оплату: ${site()}/admin/orders`,
  ]),
  paid: (o, u, productName) => send([
    '💰 <b>Оплачено</b>',
    `№ ${o.id}: ${esc(productName)}, ${o.amount} ₴`,
    `${esc(u.name)} · ${esc(u.phone)}`,
    o.contact && `Зв'язок: ${esc(o.contact)}`,
    'Зв\'яжіться з учнем, щоб узгодити розклад.',
  ]),
};

module.exports = { send, connect, events };
