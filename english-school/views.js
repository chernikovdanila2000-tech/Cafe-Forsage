const config = require('./config');

// ---------- Утилиты ----------

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const h = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

const money = (amount) => `${Number(amount).toLocaleString('uk-UA')} ${config.currency}`;

const date = (value) =>
  value ? new Date(value.replace(' ', 'T') + 'Z').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

const MESSAGES = {
  registered: ['success', 'Добро пожаловать! Аккаунт создан, первый урок уже доступен.'],
  loggedout: ['info', 'Вы вышли из аккаунта.'],
  login_required: ['info', 'Войдите, чтобы продолжить.'],
  request_sent: ['success', 'Спасибо! Мы свяжемся с вами в течение рабочего дня.'],
  profile_saved: ['success', 'Изменения сохранены.'],
  password_changed: ['success', 'Пароль обновлён.'],
  paid: ['success', 'Оплата прошла успешно — урок открыт.'],
  payment_pending: ['info', 'Мы получили запрос на оплату. Урок откроется сразу после подтверждения платежа.'],
  completed: ['success', 'Отлично! Урок отмечен как пройденный.'],
  confirmed: ['success', 'Платёж подтверждён, урок открыт ученику.'],
  cancelled: ['info', 'Платёж отменён.'],
};

const LEVELS = {
  A1: 'A1 — Начальный',
  A2: 'A2 — Элементарный',
  B1: 'B1 — Средний',
  B2: 'B2 — Выше среднего',
  C1: 'C1 — Продвинутый',
};

function groupByModule(lessons) {
  const groups = new Map();
  for (const lesson of lessons) {
    if (!groups.has(lesson.module)) groups.set(lesson.module, []);
    groups.get(lesson.module).push(lesson);
  }
  return [...groups];
}

const icon = {
  check: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  lock: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  play: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
  clock: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  back: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
};

// ---------- Каркас страницы ----------

function layout({ title, user, body, msg, bodyClass = '', description }) {
  const flash = MESSAGES[msg];
  const pageTitle = title ? `${title} — ${config.schoolName}` : `${config.schoolName} — школа английского языка`;
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${h(pageTitle)}</title>
<meta name="description" content="${h(description || 'Онлайн-школа английского языка: уроки в личном кабинете, живые занятия с преподавателями и бесплатный пробный урок.')}">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#1e2b45"/><text x="32" y="44" font-family="Georgia,serif" font-size="34" text-anchor="middle" fill="#e9d9b8">${config.schoolName[0]}</text></svg>`)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
</head>
<body class="${h(bodyClass)}">
<header class="site-header">
  <div class="container header-inner">
    <a class="logo" href="/">
      <span class="logo-mark">${h(config.schoolName[0])}</span>
      <span>${h(config.schoolName)}<small>${h(config.tagline)}</small></span>
    </a>
    <button class="nav-toggle" aria-label="Меню" aria-expanded="false"><span></span><span></span></button>
    <nav class="nav">
      <a href="/#approach">Подход</a>
      <a href="/#program">Программа</a>
      <a href="/#pricing">Цены</a>
      <a href="/#teachers">Преподаватели</a>
      <a href="/#faq">Вопросы</a>
      ${user
        ? `${user.is_admin ? '<a href="/admin">Админ-панель</a>' : ''}
           <a class="btn btn-small btn-dark" href="/dashboard">Личный кабинет</a>`
        : `<a href="/login">Войти</a>
           <a class="btn btn-small btn-dark" href="/register">Начать учиться</a>`}
    </nav>
  </div>
</header>
${flash ? `<div class="container"><div class="flash flash-${flash[0]}" role="status">${h(flash[1])}</div></div>` : ''}
<main>
${body}
</main>
<footer class="site-footer">
  <div class="container footer-inner">
    <div>
      <a class="logo logo-light" href="/"><span class="logo-mark">${h(config.schoolName[0])}</span><span>${h(config.schoolName)}<small>${h(config.tagline)}</small></span></a>
      <p class="muted">Английский для жизни, работы и путешествий.</p>
    </div>
    <div class="footer-links">
      <a href="/#program">Программа</a>
      <a href="/#pricing">Цены</a>
      <a href="/#trial">Пробный урок</a>
      <a href="/dashboard">Личный кабинет</a>
    </div>
    <div class="footer-contacts">
      <a href="tel:${h(config.phone.replace(/[^+\d]/g, ''))}">${h(config.phone)}</a>
      <a href="mailto:${h(config.email)}">${h(config.email)}</a>
    </div>
  </div>
  <div class="container footer-bottom">© ${new Date().getFullYear()} ${h(config.schoolName)}. Все права защищены.</div>
</footer>
<script src="/app.js" defer></script>
</body>
</html>`;
}

// ---------- Главная ----------

function home({ user, msg, lessons }) {
  const firstFree = lessons.find((l) => l.is_free);
  const lessonPrice = Math.min(...lessons.filter((l) => !l.is_free).map((l) => l.price));
  const body = `
<section class="hero">
  <div class="container hero-inner">
    <div class="hero-text">
      <p class="eyebrow">Онлайн-школа английского языка</p>
      <h1>Английский, который <em>остаётся</em> с вами</h1>
      <p class="lead">Короткие понятные уроки в личном кабинете, живая практика с преподавателем и честный прогресс от A1 до C1. Учитесь в своём темпе — с телефона или компьютера.</p>
      <div class="hero-actions">
        <a class="btn btn-dark" href="${user ? '/dashboard' : '/register'}">${user ? 'Продолжить обучение' : 'Начать бесплатно'} ${icon.arrow}</a>
        <a class="btn btn-ghost" href="#program">Смотреть программу</a>
      </div>
      <ul class="hero-points">
        <li>${icon.check} Первый урок бесплатно</li>
        <li>${icon.check} Оплата за каждый урок, без абонементов</li>
      </ul>
    </div>
    <div class="hero-card" aria-hidden="true">
      <div class="hc-top">
        <span class="hc-badge">Урок ${lessons.length > 2 ? 3 : 1} · A1</span>
        <span class="hc-time">${icon.clock} 45 мин</span>
      </div>
      <p class="hc-title">Present Simple: привычки и факты</p>
      <div class="hc-progress"><span style="width:62%"></span></div>
      <p class="hc-caption">Пройдено 62% курса</p>
      <div class="hc-word">
        <span class="hc-label">Слово дня</span>
        <span class="hc-en">serendipity</span>
        <span class="hc-ru">счастливая случайность</span>
      </div>
      <div class="hc-quiz">
        <span>She … in a bank.</span>
        <div><b>works</b><i>work</i><i>working</i></div>
      </div>
    </div>
  </div>
</section>

<section class="stats">
  <div class="container stats-inner">
    <div><b>A1–C1</b><span>уровни подготовки</span></div>
    <div><b>${lessons.length}</b><span>уроков уже в кабинете</span></div>
    <div><b>30–45</b><span>минут на урок</span></div>
    <div><b>24/7</b><span>доступ к материалам</span></div>
  </div>
</section>

<section class="section" id="approach">
  <div class="container">
    <div class="section-head">
      <p class="eyebrow">Наш подход</p>
      <h2>Учиться легко, когда всё понятно</h2>
      <p class="muted">Мы убрали из обучения всё лишнее и оставили то, что действительно работает.</p>
    </div>
    <div class="features">
      <article class="feature">
        <div class="feature-icon"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"/></svg></div>
        <h3>Понятная теория</h3>
        <p>Грамматика объясняется на русском, простыми словами и на живых примерах — без зубрёжки правил.</p>
      </article>
      <article class="feature">
        <div class="feature-icon"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6.5h16v10H9l-5 4z"/><path d="M8.5 11.5h7"/></svg></div>
        <h3>Разговорная практика</h3>
        <p>Каждый урок построен вокруг реальных ситуаций: знакомство, работа, кафе, аэропорт, отель.</p>
      </article>
      <article class="feature">
        <div class="feature-icon"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V11M10 19V5M16 19v-6M22 19H2"/></svg></div>
        <h3>Видимый прогресс</h3>
        <p>В личном кабинете видно, что уже пройдено и что дальше. Тесты после урока закрепляют материал.</p>
      </article>
    </div>
  </div>
</section>

<section class="section section-tint" id="program">
  <div class="container">
    <div class="section-head">
      <p class="eyebrow">Программа</p>
      <h2>Уроки в личном кабинете</h2>
      <p class="muted">Каждый урок — теория, словарь и тест для самопроверки. ${firstFree ? `Урок «${h(firstFree.title)}» открыт бесплатно.` : ''}</p>
    </div>
    <div class="program">
      ${groupByModule(lessons).map(([module, items]) => `
        <div class="module">
          <h3>${h(module)}</h3>
          <ol class="program-list">
            ${items.map((l) => `
              <li>
                <span class="pl-num">${String(l.position + 1).padStart(2, '0')}</span>
                <span class="pl-body"><b>${h(l.title)}</b><span>${h(l.summary)}</span></span>
                <span class="pl-meta">${l.is_free ? '<span class="tag tag-free">Бесплатно</span>' : money(l.price)}</span>
              </li>`).join('')}
          </ol>
        </div>`).join('')}
    </div>
  </div>
</section>

<section class="section" id="how">
  <div class="container">
    <div class="section-head">
      <p class="eyebrow">Как это работает</p>
      <h2>Четыре шага до первого результата</h2>
    </div>
    <ol class="steps">
      <li><span>1</span><h3>Регистрация</h3><p>Создайте аккаунт за минуту — нужен только email.</p></li>
      <li><span>2</span><h3>Бесплатный урок</h3><p>Пройдите первый урок и решите, подходит ли вам формат.</p></li>
      <li><span>3</span><h3>Оплата урока</h3><p>Оплачивайте только те уроки, которые нужны, — по ссылке в кабинете.</p></li>
      <li><span>4</span><h3>Практика</h3><p>Закрепляйте материал тестами и отмечайте пройденные уроки.</p></li>
    </ol>
  </div>
</section>

<section class="section section-tint" id="pricing">
  <div class="container">
    <div class="section-head">
      <p class="eyebrow">Стоимость</p>
      <h2>Платите только за то, что изучаете</h2>
    </div>
    <div class="pricing">
      <article class="price-card">
        <h3>Пробный урок</h3>
        <p class="price">0 ${h(config.currency)}</p>
        <ul>
          <li>${icon.check} Полный первый урок</li>
          <li>${icon.check} Теория, словарь и тест</li>
          <li>${icon.check} Без привязки карты</li>
        </ul>
        <a class="btn btn-ghost" href="${user ? '/dashboard' : '/register'}">Попробовать</a>
      </article>
      <article class="price-card price-card-accent">
        <span class="price-badge">Популярно</span>
        <h3>Урок в кабинете</h3>
        <p class="price">${Number.isFinite(lessonPrice) ? money(lessonPrice) : '—'}<small> / урок</small></p>
        <ul>
          <li>${icon.check} Доступ к уроку навсегда</li>
          <li>${icon.check} Оплата по ссылке онлайн</li>
          <li>${icon.check} Отслеживание прогресса</li>
        </ul>
        <a class="btn btn-light" href="${user ? '/dashboard' : '/register'}">Выбрать урок</a>
      </article>
      <article class="price-card">
        <h3>С преподавателем</h3>
        <p class="price">${money(config.tutorPrice)}<small> / 60 мин</small></p>
        <ul>
          <li>${icon.check} Индивидуальное занятие онлайн</li>
          <li>${icon.check} Программа под вашу цель</li>
          <li>${icon.check} Разговорная практика</li>
        </ul>
        <a class="btn btn-ghost" href="#trial">Оставить заявку</a>
      </article>
    </div>
  </div>
</section>

<section class="section" id="teachers">
  <div class="container">
    <div class="section-head">
      <p class="eyebrow">Команда</p>
      <h2>Преподаватели</h2>
      <p class="muted">Сертифицированные специалисты с опытом преподавания взрослым и подросткам.</p>
    </div>
    <div class="teachers">
      ${config.teachers.map((t) => `
        <article class="teacher">
          <div class="avatar">${h(t.name[0])}</div>
          <h3>${h(t.name)}</h3>
          <p class="teacher-role">${h(t.role)}</p>
          <p class="muted">${h(t.about)}</p>
        </article>`).join('')}
    </div>
  </div>
</section>

<section class="section section-tint" id="faq">
  <div class="container container-narrow">
    <div class="section-head">
      <p class="eyebrow">Вопросы и ответы</p>
      <h2>Часто спрашивают</h2>
    </div>
    <div class="faq">
      <details><summary>С какого уровня можно начать?</summary><p>С нуля. Программа начинается с базовых фраз и глагола to be, а дальше постепенно усложняется. Если у вас уже есть база, напишите нам — подскажем, с какого урока начать.</p></details>
      <details><summary>Как оплатить урок?</summary><p>В личном кабинете у каждого платного урока есть кнопка «Оплатить». Она ведёт на защищённую страницу оплаты. После подтверждения платежа урок сразу открывается.</p></details>
      <details><summary>Сколько времени у меня будет доступ к уроку?</summary><p>Без ограничений. Оплаченный урок остаётся в кабинете навсегда — к нему можно вернуться в любой момент.</p></details>
      <details><summary>Можно ли заниматься с телефона?</summary><p>Да, сайт и личный кабинет удобно открываются на любом устройстве.</p></details>
      <details><summary>Есть ли занятия с живым преподавателем?</summary><p>Да. Оставьте заявку внизу страницы — мы подберём преподавателя и удобное время.</p></details>
    </div>
  </div>
</section>

<section class="cta" id="trial">
  <div class="container cta-inner">
    <div>
      <p class="eyebrow eyebrow-light">Пробное занятие</p>
      <h2>Запишитесь на бесплатную консультацию</h2>
      <p>Определим ваш уровень, обсудим цели и подберём формат обучения. Ответим в течение рабочего дня.</p>
    </div>
    <form class="cta-form" method="post" action="/request">
      <label>Ваше имя<input name="name" required maxlength="80" autocomplete="name"></label>
      <label>Телефон или email<input name="contact" required maxlength="120"></label>
      <label>Цель обучения <span class="optional">(необязательно)</span><textarea name="message" rows="3" maxlength="1000" placeholder="Например: подготовка к собеседованию"></textarea></label>
      <button class="btn btn-light" type="submit">Отправить заявку</button>
    </form>
  </div>
</section>`;
  return layout({ user, msg, body });
}

// ---------- Вход и регистрация ----------

function authPage({ mode, error, values = {}, user, msg, next }) {
  const isRegister = mode === 'register';
  const body = `
<section class="auth">
  <div class="auth-card">
    <h1>${isRegister ? 'Создать аккаунт' : 'Вход в кабинет'}</h1>
    <p class="muted">${isRegister ? 'Первый урок станет доступен сразу после регистрации.' : 'Рады видеть вас снова!'}</p>
    ${error ? `<div class="flash flash-error">${h(error)}</div>` : ''}
    <form method="post" action="/${mode}" class="form">
      ${next ? `<input type="hidden" name="next" value="${h(next)}">` : ''}
      ${isRegister ? `<label>Имя<input name="name" required maxlength="80" value="${h(values.name)}" autocomplete="name"></label>` : ''}
      <label>Email<input type="email" name="email" required maxlength="120" value="${h(values.email)}" autocomplete="email"></label>
      ${isRegister ? `<label>Телефон <span class="optional">(необязательно)</span><input type="tel" name="phone" maxlength="30" value="${h(values.phone)}" autocomplete="tel"></label>` : ''}
      <label>Пароль<input type="password" name="password" required minlength="${isRegister ? 8 : 1}" autocomplete="${isRegister ? 'new-password' : 'current-password'}"></label>
      ${isRegister ? `
      <label>Ваш уровень
        <select name="level">${Object.entries(LEVELS).map(([k, v]) => `<option value="${k}"${values.level === k ? ' selected' : ''}>${v}</option>`).join('')}</select>
      </label>` : ''}
      <button class="btn btn-dark btn-block" type="submit">${isRegister ? 'Зарегистрироваться' : 'Войти'}</button>
    </form>
    <p class="auth-switch">${isRegister
      ? 'Уже есть аккаунт? <a href="/login">Войти</a>'
      : 'Ещё нет аккаунта? <a href="/register">Зарегистрироваться</a>'}</p>
  </div>
</section>`;
  return layout({ title: isRegister ? 'Регистрация' : 'Вход', user, msg, body, bodyClass: 'page-auth' });
}

// ---------- Личный кабинет ----------

function lessonStatus(l) {
  if (l.completed) return { cls: 'done', label: 'Пройден' };
  if (l.is_free || l.paid) return { cls: 'open', label: l.is_free ? 'Бесплатно' : 'Оплачен' };
  if (l.pending) return { cls: 'pending', label: 'Ожидает подтверждения' };
  return { cls: 'locked', label: money(l.price) };
}

function dashboard({ user, msg, lessons, payments }) {
  const done = lessons.filter((l) => l.completed).length;
  const percent = lessons.length ? Math.round((done / lessons.length) * 100) : 0;
  const next = lessons.find((l) => !l.completed && (l.is_free || l.paid || user.is_admin)) || lessons.find((l) => !l.completed);

  const body = `
<section class="dash">
  <div class="container">
    <div class="dash-head">
      <div>
        <p class="eyebrow">Личный кабинет</p>
        <h1>Здравствуйте, ${h(user.name.split(' ')[0])}!</h1>
        <p class="muted">Уровень: ${h(LEVELS[user.level] || user.level)} · <a href="/account">Настройки профиля</a></p>
      </div>
      <form method="post" action="/logout"><button class="btn btn-ghost btn-small" type="submit">Выйти</button></form>
    </div>

    <div class="dash-grid">
      <div class="panel progress-panel">
        <span class="panel-label">Ваш прогресс</span>
        <div class="ring" style="--p:${percent}"><span>${percent}%</span></div>
        <p>Пройдено <b>${done}</b> из <b>${lessons.length}</b> уроков</p>
      </div>
      ${next ? `
      <div class="panel next-panel">
        <span class="panel-label">${done ? 'Продолжить' : 'Начните отсюда'}</span>
        <h2>${h(next.title)}</h2>
        <p class="muted">${h(next.summary)}</p>
        <a class="btn btn-dark" href="/lessons/${next.id}">${icon.play} ${next.is_free || next.paid || user.is_admin ? 'Открыть урок' : 'Перейти к уроку'}</a>
      </div>` : `
      <div class="panel next-panel">
        <span class="panel-label">Поздравляем</span>
        <h2>Все уроки пройдены!</h2>
        <p class="muted">Новые уроки появятся совсем скоро. А пока — запишитесь на занятие с преподавателем.</p>
        <a class="btn btn-dark" href="/#trial">Записаться</a>
      </div>`}
    </div>

    <h2 class="dash-title">Мои уроки</h2>
    ${groupByModule(lessons).map(([module, items]) => `
      <div class="module">
        <h3>${h(module)}</h3>
        <div class="lesson-list">
          ${items.map((l) => {
            const s = user.is_admin && !l.is_free && !l.paid && !l.completed ? { cls: 'open', label: 'Доступ администратора' } : lessonStatus(l);
            const unlocked = l.is_free || l.paid || user.is_admin;
            return `
            <div class="lesson-row status-${s.cls}">
              <span class="lr-icon">${s.cls === 'done' ? icon.check : unlocked ? icon.play : icon.lock}</span>
              <a class="lr-body" href="/lessons/${l.id}">
                <b>${h(l.title)}</b>
                <span>${h(l.level)} · ${l.duration} мин</span>
              </a>
              <span class="lr-status">${h(s.label)}</span>
              ${unlocked
                ? `<a class="btn btn-small btn-ghost" href="/lessons/${l.id}">${l.completed ? 'Повторить' : 'Открыть'}</a>`
                : `<a class="btn btn-small btn-accent" href="/pay/${l.id}">Оплатить</a>`}
            </div>`;
          }).join('')}
        </div>
      </div>`).join('')}

    ${payments.length ? `
    <h2 class="dash-title">История оплат</h2>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Урок</th><th>Сумма</th><th>Дата</th><th>Статус</th></tr></thead>
        <tbody>
          ${payments.map((p) => `
          <tr>
            <td>${h(p.lesson_title)}</td>
            <td>${money(p.amount)}</td>
            <td>${date(p.created_at)}</td>
            <td><span class="pill pill-${h(p.status)}">${{ paid: 'Оплачен', pending: 'Ожидает', cancelled: 'Отменён' }[p.status] || h(p.status)}</span></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : ''}
  </div>
</section>`;
  return layout({ title: 'Личный кабинет', user, msg, body, bodyClass: 'page-app' });
}

// ---------- Урок ----------

function lessonPage({ user, msg, lesson, hasAccess, completed, prev, next, pending }) {
  const header = `
    <a class="back-link" href="/dashboard">${icon.back} Все уроки</a>
    <p class="eyebrow">${h(lesson.module)}</p>
    <h1>${h(lesson.title)}</h1>
    <div class="lesson-meta">
      <span class="tag">${h(lesson.level)}</span>
      <span>${icon.clock} ${lesson.duration} мин</span>
      ${completed ? `<span class="tag tag-free">${icon.check} Пройден</span>` : ''}
    </div>
    <p class="lead">${h(lesson.summary)}</p>`;

  const content = hasAccess
    ? `
    <article class="lesson-body">
      <h2>Теория</h2>
      <div class="prose">${lesson.theory}</div>

      <h2>Словарь урока</h2>
      <div class="vocab">
        ${lesson.vocabulary.map(([en, ru]) => `<div class="vocab-item"><b>${h(en)}</b><span>${h(ru)}</span></div>`).join('')}
      </div>

      <h2>Проверьте себя</h2>
      <form class="quiz" data-quiz>
        ${lesson.exercises.map((ex, i) => `
          <fieldset class="quiz-q" data-answer="${ex.answer}">
            <legend><span>${i + 1}.</span> ${h(ex.q)}</legend>
            ${ex.options.map((opt, j) => `<label class="quiz-opt"><input type="radio" name="q${i}" value="${j}"> <span>${h(opt)}</span></label>`).join('')}
          </fieldset>`).join('')}
        <div class="quiz-actions">
          <button class="btn btn-ghost" type="submit">Проверить ответы</button>
          <p class="quiz-result" aria-live="polite"></p>
        </div>
      </form>

      <div class="lesson-finish">
        ${completed
          ? `<p>${icon.check} Вы уже прошли этот урок.</p>`
          : `<form method="post" action="/lessons/${lesson.id}/complete"><button class="btn btn-dark" type="submit">${icon.check} Отметить урок пройденным</button></form>`}
      </div>
    </article>`
    : `
    <div class="paywall">
      <div class="paywall-icon">${icon.lock}</div>
      <h2>Урок доступен после оплаты</h2>
      <p class="muted">В уроке: теория с примерами, словарь из ${lesson.vocabulary.length} слов и тест из ${lesson.exercises.length} вопросов. Доступ остаётся навсегда.</p>
      <p class="paywall-price">${money(lesson.price)}</p>
      <a class="btn btn-accent" href="/pay/${lesson.id}">Оплатить урок ${icon.arrow}</a>
      ${pending ? '<p class="muted small">Есть неподтверждённый платёж за этот урок. Если вы уже оплатили, урок откроется после подтверждения.</p>' : ''}
    </div>`;

  const body = `
<section class="lesson">
  <div class="container container-narrow">
    ${header}
    ${content}
    <nav class="lesson-nav">
      ${prev ? `<a href="/lessons/${prev.id}">${icon.back} ${h(prev.title)}</a>` : '<span></span>'}
      ${next ? `<a href="/lessons/${next.id}">${h(next.title)} ${icon.arrow}</a>` : ''}
    </nav>
  </div>
</section>`;
  return layout({ title: lesson.title, user, msg, body, bodyClass: 'page-app' });
}

// ---------- Оплата ----------

function demoCheckout({ user, lesson, payment }) {
  const body = `
<section class="auth">
  <div class="auth-card checkout">
    <p class="eyebrow">Оплата урока</p>
    <h1>${h(lesson.title)}</h1>
    <div class="checkout-row"><span>Ученик</span><b>${h(user.email)}</b></div>
    <div class="checkout-row"><span>Номер платежа</span><b>№ ${payment.id}</b></div>
    <div class="checkout-row checkout-total"><span>К оплате</span><b>${money(payment.amount)}</b></div>
    <div class="flash flash-info">Демо-режим: платёжная система ещё не подключена. Укажите <code>PAYMENT_URL</code> в настройках, и кнопка «Оплатить» будет вести на страницу оплаты вашего банка или сервиса.</div>
    <form method="post" action="/pay/demo/${payment.id}">
      <button class="btn btn-accent btn-block" type="submit">Оплатить ${money(payment.amount)} (демо)</button>
    </form>
    <p class="auth-switch"><a href="/lessons/${lesson.id}">Вернуться к уроку</a></p>
  </div>
</section>`;
  return layout({ title: 'Оплата', user, body, bodyClass: 'page-auth' });
}

// ---------- Профиль ----------

function account({ user, msg, error }) {
  const body = `
<section class="dash">
  <div class="container container-narrow">
    <a class="back-link" href="/dashboard">${icon.back} В кабинет</a>
    <h1>Настройки профиля</h1>
    ${error ? `<div class="flash flash-error">${h(error)}</div>` : ''}
    <div class="panel">
      <h2 class="panel-title">Личные данные</h2>
      <form method="post" action="/account" class="form">
        <label>Имя<input name="name" required maxlength="80" value="${h(user.name)}"></label>
        <label>Email<input value="${h(user.email)}" disabled></label>
        <label>Телефон<input type="tel" name="phone" maxlength="30" value="${h(user.phone)}"></label>
        <label>Уровень
          <select name="level">${Object.entries(LEVELS).map(([k, v]) => `<option value="${k}"${user.level === k ? ' selected' : ''}>${v}</option>`).join('')}</select>
        </label>
        <button class="btn btn-dark" type="submit">Сохранить</button>
      </form>
    </div>
    <div class="panel">
      <h2 class="panel-title">Смена пароля</h2>
      <form method="post" action="/account/password" class="form">
        <label>Текущий пароль<input type="password" name="current" required autocomplete="current-password"></label>
        <label>Новый пароль<input type="password" name="password" required minlength="8" autocomplete="new-password"></label>
        <button class="btn btn-dark" type="submit">Обновить пароль</button>
      </form>
    </div>
  </div>
</section>`;
  return layout({ title: 'Профиль', user, msg, body, bodyClass: 'page-app' });
}

// ---------- Админ-панель ----------

function admin({ user, msg, users, payments, requests }) {
  const pending = payments.filter((p) => p.status === 'pending');
  const revenue = payments.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const body = `
<section class="dash">
  <div class="container">
    <p class="eyebrow">Администрирование</p>
    <h1>Панель управления</h1>
    <div class="admin-stats">
      <div class="panel"><span class="panel-label">Ученики</span><b>${users.filter((u) => !u.is_admin).length}</b></div>
      <div class="panel"><span class="panel-label">Ждут подтверждения</span><b>${pending.length}</b></div>
      <div class="panel"><span class="panel-label">Выручка</span><b>${money(revenue)}</b></div>
      <div class="panel"><span class="panel-label">Заявки</span><b>${requests.length}</b></div>
    </div>

    <h2 class="dash-title">Платежи</h2>
    ${payments.length ? `
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>№</th><th>Ученик</th><th>Урок</th><th>Сумма</th><th>Дата</th><th>Статус</th><th></th></tr></thead>
        <tbody>
          ${payments.map((p) => `
          <tr>
            <td>${p.id}</td>
            <td>${h(p.user_name)}<br><span class="muted small">${h(p.user_email)}</span></td>
            <td>${h(p.lesson_title)}</td>
            <td>${money(p.amount)}</td>
            <td>${date(p.created_at)}</td>
            <td><span class="pill pill-${h(p.status)}">${{ paid: 'Оплачен', pending: 'Ожидает', cancelled: 'Отменён' }[p.status] || h(p.status)}</span></td>
            <td class="actions">${p.status === 'pending' ? `
              <form method="post" action="/admin/payments/${p.id}/confirm"><button class="btn btn-small btn-dark">Подтвердить</button></form>
              <form method="post" action="/admin/payments/${p.id}/cancel"><button class="btn btn-small btn-ghost">Отменить</button></form>` : ''}
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : '<p class="muted">Платежей пока нет.</p>'}

    <h2 class="dash-title">Аккаунты</h2>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Имя</th><th>Email</th><th>Телефон</th><th>Уровень</th><th>Пройдено</th><th>Оплачено</th><th>Регистрация</th></tr></thead>
        <tbody>
          ${users.map((u) => `
          <tr>
            <td>${h(u.name)}${u.is_admin ? ' <span class="pill pill-paid">админ</span>' : ''}</td>
            <td>${h(u.email)}</td>
            <td>${h(u.phone || '—')}</td>
            <td>${h(u.level)}</td>
            <td>${u.completed}</td>
            <td>${money(u.paid_total)}</td>
            <td>${date(u.created_at)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <h2 class="dash-title">Заявки на консультацию</h2>
    ${requests.length ? `
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Имя</th><th>Контакт</th><th>Сообщение</th><th>Дата</th></tr></thead>
        <tbody>
          ${requests.map((r) => `<tr><td>${h(r.name)}</td><td>${h(r.contact)}</td><td>${h(r.message || '—')}</td><td>${date(r.created_at)}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>` : '<p class="muted">Заявок пока нет.</p>'}
  </div>
</section>`;
  return layout({ title: 'Админ-панель', user, msg, body, bodyClass: 'page-app' });
}

function notFound({ user }) {
  const body = `
<section class="auth">
  <div class="auth-card" style="text-align:center">
    <p class="eyebrow">Ошибка 404</p>
    <h1>Страница не найдена</h1>
    <p class="muted">Возможно, ссылка устарела или в адресе опечатка.</p>
    <a class="btn btn-dark" href="/">На главную</a>
  </div>
</section>`;
  return layout({ title: 'Страница не найдена', user, body, bodyClass: 'page-auth' });
}

module.exports = { home, authPage, dashboard, lessonPage, demoCheckout, account, admin, notFound, LEVELS };
