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

// Графік викладача на найближчі DAYS_AHEAD днів зі статусом кожної години:
// [{ date, times: [{ time: '10:00', status: 'free' | 'taken' | 'mine' }] }] — 'mine' означає запис самого глядача.
function grid(teacherId, viewerId) {
  const availability = db.schedule.get(teacherId);
  const today = kyiv().date;
  const last = addDays(today, DAYS_AHEAD - 1);
  const earliest = kyiv(LEAD_HOURS * HOUR).stamp;
  const current = kyiv().stamp;
  const taken = db.bookings.taken(teacherId, today, last);
  const days = [];
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const date = addDays(today, i);
    // Зайняті години показуємо, поки вони не минули; вільні — лише ті, на які ще можна встигнути записатися.
    const times = (availability[weekday(date)] || [])
      .filter((time) => `${date} ${time}` >= current)
      .map((time) => {
        const by = taken.get(`${date} ${time}`);
        return { time, status: by === undefined ? 'free' : viewerId && by === viewerId ? 'mine' : 'taken' };
      })
      .filter((slot) => slot.status !== 'free' || `${date} ${slot.time}` >= earliest);
    if (times.length) days.push({ date, times });
  }
  return days;
}

// Лише вільні години: [{ date, times: ['10:00', ...] }].
function free(teacherId) {
  return grid(teacherId)
    .map((d) => ({ date: d.date, times: d.times.filter((s) => s.status === 'free').map((s) => s.time) }))
    .filter((d) => d.times.length);
}

const isFree = (teacherId, date, time) => free(teacherId).some((d) => d.date === date && d.times.includes(time));

// Чи може учень сам скасувати запис (не пізніше ніж за CANCEL_HOURS до початку).
const canCancel = (booking) => `${booking.date} ${booking.time}` >= kyiv(CANCEL_HOURS * HOUR).stamp;

const now = () => kyiv().stamp;

module.exports = { HOURS, DAYS_AHEAD, CANCEL_HOURS, grid, free, isFree, canCancel, now, weekday };
