// Вільний час викладача для запису учнів. Увесь час — київський.

const db = require('./db');

const TZ = 'Europe/Kyiv';
const DAYS_AHEAD = 14; // скільки днів уперед показувати учням
const LEAD_HOURS = 2; // найближчий час, на який ще можна записатися
const CANCEL_HOURS = 24; // учень може скасувати запис не пізніше ніж за стільки годин (як в оферті)

// Години, які викладач може позначити у своєму графіку (заняття 55 хв, тож щогодини).
const HOURS = Array.from({ length: 16 }, (_, i) => `${String(7 + i).padStart(2, '0')}:00`);

// Київські дата й час через offsetMs від зараз: { date: 'YYYY-MM-DD', stamp: 'YYYY-MM-DD HH:MM' }.
function kyiv(offsetMs = 0) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(Date.now() + offsetMs)).map((p) => [p.type, p.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  return { date, stamp: `${date} ${parts.hour}:${parts.minute}` };
}

const HOUR = 60 * 60 * 1000;

function addDays(date, n) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// 1 — понеділок … 7 — неділя.
function weekday(date) {
  const d = new Date(`${date}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

// Вільні слоти викладача: [{ date, times: ['10:00', ...] }] на найближчі DAYS_AHEAD днів.
function free(teacherId) {
  const availability = db.schedule.get(teacherId);
  const today = kyiv().date;
  const last = addDays(today, DAYS_AHEAD - 1);
  const earliest = kyiv(LEAD_HOURS * HOUR).stamp;
  const taken = db.bookings.taken(teacherId, today, last);
  const days = [];
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const date = addDays(today, i);
    const times = (availability[weekday(date)] || []).filter((time) => {
      const slot = `${date} ${time}`;
      return slot >= earliest && !taken.has(slot);
    });
    if (times.length) days.push({ date, times });
  }
  return days;
}

const isFree = (teacherId, date, time) => free(teacherId).some((d) => d.date === date && d.times.includes(time));

// Чи може учень сам скасувати запис (не пізніше ніж за CANCEL_HOURS до початку).
const canCancel = (booking) => `${booking.date} ${booking.time}` >= kyiv(CANCEL_HOURS * HOUR).stamp;

const now = () => kyiv().stamp;

module.exports = { HOURS, DAYS_AHEAD, CANCEL_HOURS, free, isFree, canCancel, now, weekday };
