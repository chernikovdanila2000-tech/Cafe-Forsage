// Налаштування сайту.
// Більшість значень редагується в адмін-панелі (/admin/settings) і зберігається в базі.
// Якщо в адмінці поле порожнє, береться змінна оточення (Railway → Variables), а потім — значення за замовчуванням.

const db = require('./db');

// Поля, які можна змінити в адмін-панелі: ключ → [змінна оточення, значення за замовчуванням].
const EDITABLE = {
  phone: ['SCHOOL_PHONE', ''],
  email: ['SCHOOL_EMAIL', 'inkwellschool2@gmail.com'],
  telegram: ['SCHOOL_TELEGRAM', '@Inkwell_sch'],
  instagram: ['SCHOOL_INSTAGRAM', ''],
  lessonPrice: ['LESSON_PRICE', '350'],
  packageLessons: ['SUBSCRIPTION_LESSONS', '8'],
  packagePrice: ['SUBSCRIPTION_PRICE', '2550'],
  pack4Price: ['PACK4_PRICE', '1300'],
  pack12Price: ['PACK12_PRICE', '3900'],
  pack16Price: ['PACK16_PRICE', '5100'],
  paymentUrl: ['PAYMENT_URL', ''],
  paymentDetails: ['PAYMENT_DETAILS', ''],
  legalSeller: ['LEGAL_SELLER', ''],
  legalTaxId: ['LEGAL_TAX_ID', ''],
  legalAddress: ['LEGAL_ADDRESS', ''],
  siteUrl: ['SITE_URL', ''],
  metaPixelId: ['META_PIXEL_ID', ''],
  gaId: ['GA_MEASUREMENT_ID', ''],
  tgBotToken: ['TELEGRAM_BOT_TOKEN', ''],
  tgChatId: ['TELEGRAM_CHAT_ID', ''],
  smsToken: ['SMS_TOKEN', ''],
  smsSender: ['SMS_SENDER', ''],
};

const production = db.onRailway || process.env.NODE_ENV === 'production';

// Налаштування читаються з бази при кожному зверненні, тож зміни в адмінці діють одразу.
function value(key) {
  const stored = db.settings.all()[key];
  if (stored !== undefined && stored !== '') return stored;
  const [env, fallback] = EDITABLE[key];
  return process.env[env] || fallback;
}

const number = (key, min, max) => {
  const n = Math.round(Number(value(key)));
  return Number.isFinite(n) && n >= min && n <= max ? n : Number(EDITABLE[key][1]);
};

const config = {
  EDITABLE,
  production,
  port: Number(process.env.PORT) || 3000,
  schoolName: process.env.SCHOOL_NAME || 'Inkwell Academy',
  tagline: process.env.SCHOOL_TAGLINE || 'School of English',
  currency: '₴',
  lessonDuration: Number(process.env.LESSON_DURATION) || 55,
  trialMinutes: 30, // безкоштовний пробний урок

  // На Railway сайт завжди працює через HTTPS, тож cookie передаються лише захищеним каналом.
  secureCookies: production || process.env.SECURE_COOKIES === 'true',

  // Демо-оплата (кнопка, що одразу зараховує заняття) — тільки для перевірки на своєму комп'ютері.
  // На робочому сервері вона вимкнена, щоб ніхто не отримав заняття без оплати.
  demoPayments: process.env.DEMO_PAYMENTS ? process.env.DEMO_PAYMENTS === 'true' : !production,

  get: value,

  get phone() { return value('phone'); },
  get email() { return value('email'); },
  get telegram() { return value('telegram'); },
  get instagram() { return value('instagram'); },
  get paymentUrl() { return value('paymentUrl'); },
  get paymentDetails() { return value('paymentDetails'); },
  get metaPixelId() { return value('metaPixelId'); },
  get gaId() { return value('gaId'); },
  get siteUrl() { return value('siteUrl').replace(/\/+$/, ''); },

  get lessonPrice() { return number('lessonPrice', 1, 100000); },

  // Разове заняття й абонементи на місяць (4, 8, 12, 16 занять). Абонемент на 8 має id «monthly» — як і раніше.
  get products() {
    const price = this.lessonPrice;
    const pack = (id, lessons, total, perWeek) => {
      const fullPrice = lessons * price;
      return {
        id, lessons, perWeek, fullPrice,
        price: total,
        each: Math.round((total / lessons) * 100) / 100, // ціна одного заняття в абонементі (для повернення коштів)
        save: Math.max(fullPrice - total, 0),
      };
    };
    const lessons8 = number('packageLessons', 2, 50);
    return {
      single: { id: 'single', lessons: 1, price },
      pack4: pack('pack4', 4, number('pack4Price', 1, 1000000), 1),
      monthly: pack('monthly', lessons8, number('packagePrice', 1, 1000000), Math.max(Math.round(lessons8 / 4), 1)),
      pack12: pack('pack12', 12, number('pack12Price', 1, 1000000), 3),
      pack16: pack('pack16', 16, number('pack16Price', 1, 1000000), 4),
    };
  },

  // Абонементи в порядку показу.
  get packages() {
    const p = this.products;
    return [p.pack4, p.monthly, p.pack12, p.pack16];
  },

  // Реквізити для оферти й політики конфіденційності.
  get legal() {
    return {
      seller: value('legalSeller'),
      taxId: value('legalTaxId'),
      address: value('legalAddress'),
      site: value('siteUrl'),
      updated: process.env.LEGAL_UPDATED || '04.11.2026',
    };
  },

  // SMS-підтвердження номера: працює, коли задано і токен, і ім'я відправника.
  get sms() {
    const token = value('smsToken');
    const sender = value('smsSender');
    return { token, sender, enabled: Boolean(token && sender) };
  },

  get telegramBot() {
    return { token: value('tgBotToken'), chatId: value('tgChatId') };
  },
};

module.exports = config;
