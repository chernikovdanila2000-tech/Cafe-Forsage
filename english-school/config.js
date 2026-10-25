// Настройки сайта. Всё можно переопределить переменными окружения (см. README).
module.exports = {
  port: Number(process.env.PORT) || 3000,
  schoolName: process.env.SCHOOL_NAME || 'Mayfair',
  phone: process.env.SCHOOL_PHONE || '+7 (900) 000-00-00',
  email: process.env.SCHOOL_EMAIL || 'hello@mayfair-english.ru',
  currency: process.env.CURRENCY || '₽',
  tutorPrice: Number(process.env.TUTOR_PRICE) || 1900,

  // Ссылка на оплату (ЮKassa, Robokassa, Stripe Payment Link, страница банка и т. п.).
  // Можно использовать подстановки: {payment} {lesson} {amount} {email}.
  // Если подстановок нет, параметры добавятся в конец ссылки.
  // Пусто — включается демо-оплата для проверки сайта.
  paymentUrl: process.env.PAYMENT_URL || '',

  // Включайте при работе за HTTPS — cookie будет передаваться только по защищённому каналу.
  secureCookies: process.env.SECURE_COOKIES === 'true',

  // Замените на реальных преподавателей школы.
  teachers: [
    { name: 'Анна Смирнова', role: 'Методист · CELTA', about: 'Отвечает за программу курса. Помогает разобраться в грамматике без страха и зубрёжки.' },
    { name: 'Дмитрий Орлов', role: 'Разговорный английский', about: 'Ведёт практику для тех, кто понимает язык, но стесняется говорить.' },
    { name: 'Мария Ковалёва', role: 'Бизнес-английский · IELTS', about: 'Готовит к собеседованиям, переговорам и международным экзаменам.' },
  ],
};
