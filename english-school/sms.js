// SMS із кодом підтвердження номера (TurboSMS, https://turbosms.ua).
// Токен і ім'я відправника задаються в адмінці → Налаштування → «SMS-підтвердження номера».

const config = require('./config');

const API = process.env.SMS_API_URL || 'https://api.turbosms.ua';

// TurboSMS відповідає кодом: 0 і 800–899 — повідомлення прийняте до відправки.
const accepted = (code) => code === undefined || code === null || Number(code) === 0 || (Number(code) >= 800 && Number(code) < 900);

async function send(phone, text) {
  const { token, sender } = config.sms;
  if (!token || !sender) return { ok: false, error: 'SMS не налаштовано' };
  try {
    const res = await fetch(`${API}/message/send.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ recipients: [phone], sms: { sender, text } }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json().catch(() => ({}));
    const item = Array.isArray(data.response_result) ? data.response_result[0] : null;
    if (res.ok && accepted(data.response_code) && (!item || accepted(item.response_code))) return { ok: true };
    const error = (item && item.response_status) || data.response_status || `HTTP ${res.status}`;
    console.error('SMS не надіслано:', error);
    return { ok: false, error };
  } catch (err) {
    console.error('SMS не надіслано:', err.message);
    return { ok: false, error: err.message };
  }
}

// Номер у міжнародному форматі без «+»: 0671234567 → 380671234567. Невалідний — null.
function normalize(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) digits = `38${digits}`;
  if (digits.length === 9) digits = `380${digits}`;
  if (digits.startsWith('380')) return /^380\d{9}$/.test(digits) ? digits : null;
  return /^[1-9]\d{9,14}$/.test(digits) ? digits : null;
}

module.exports = { send, normalize };
