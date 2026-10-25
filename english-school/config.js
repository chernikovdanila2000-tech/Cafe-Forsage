// Налаштування сайту. Усе можна змінити змінними оточення (див. README).
module.exports = {
  port: Number(process.env.PORT) || 3000,
  schoolName: process.env.SCHOOL_NAME || 'Inkwell Academy',
  tagline: process.env.SCHOOL_TAGLINE || 'School of English',
  phone: process.env.SCHOOL_PHONE || '+380 (00) 000-00-00',
  email: process.env.SCHOOL_EMAIL || 'hello@inkwell.academy',
  currency: process.env.CURRENCY || '₴',
  // Індивідуальне заняття з викладачем — єдине, що продається на сайті.
  lessonPrice: Number(process.env.LESSON_PRICE) || 450,
  lessonDuration: Number(process.env.LESSON_DURATION) || 60,

  // Посилання на оплату (WayForPay, LiqPay, Plata by mono, Stripe Payment Link тощо).
  // Можна використовувати підстановки: {payment} {lesson} {amount} {email}.
  // Якщо підстановок немає, параметри додадуться в кінець посилання.
  // Порожньо — вмикається демо-оплата для перевірки сайту.
  paymentUrl: process.env.PAYMENT_URL || '',

  // Вмикайте, коли сайт працює через HTTPS: cookie передаватиметься лише захищеним каналом.
  secureCookies: process.env.SECURE_COOKIES === 'true',

  // Замініть на справжніх викладачів школи.
  teachers: [
    {
      name: { uk: 'Олена Коваленко', en: 'Olena Kovalenko' },
      role: { uk: 'Методистка · CELTA', en: 'Head of studies · CELTA' },
      about: {
        uk: 'Відповідає за програму курсу. Допомагає розібратися в граматиці без страху й зубріння.',
        en: 'Designs the course programme and makes grammar clear, without fear or cramming.',
      },
    },
    {
      name: { uk: 'Андрій Мельник', en: 'Andrii Melnyk' },
      role: { uk: 'Розмовна англійська', en: 'Speaking practice' },
      about: {
        uk: 'Веде практику для тих, хто розуміє мову, але соромиться говорити.',
        en: 'Runs speaking practice for those who understand English but feel shy to speak.',
      },
    },
    {
      name: { uk: 'Ірина Бондар', en: 'Iryna Bondar' },
      role: { uk: 'Бізнес-англійська · IELTS', en: 'Business English · IELTS' },
      about: {
        uk: 'Готує до співбесід, переговорів і міжнародних іспитів.',
        en: 'Prepares students for job interviews, negotiations and international exams.',
      },
    },
  ],
};
