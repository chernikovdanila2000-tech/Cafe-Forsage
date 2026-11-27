const config = require('./config');
const { t, defaults: textDefaults } = require('./i18n');

// Тривалість заняття підставляється в усі тексти як {min}.
textDefaults.min = config.lessonDuration;

// ---------- Утиліти ----------

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const h = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

const LOCALES = { uk: 'uk-UA', en: 'en-GB' };
const money = (amount, lang) => `${Number(amount).toLocaleString(LOCALES[lang], { maximumFractionDigits: 0 })} ${config.currency}`;

const date = (value, lang) =>
  value ? new Date(value.replace(' ', 'T') + 'Z').toLocaleDateString(LOCALES[lang], { day: 'numeric', month: 'long', year: 'numeric' }) : '';

const dateTime = (value, lang) =>
  value ? new Date(value.replace(' ', 'T') + 'Z').toLocaleString(LOCALES[lang], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' }) : '';

const LEVEL_CODES = ['unknown', 'A1', 'A2', 'B1', 'B2', 'C1'];

const MESSAGE_TYPES = {
  registered: 'success', loggedout: 'info', login_required: 'info', profile_saved: 'success',
  password_changed: 'success', paid: 'success', payment_pending: 'success', too_many: 'error', teacher_chosen: 'success',
  booked: 'success', booked_trial: 'success', booked_many: 'success', booked_partly: 'info', booking_too_many: 'error', order_cancelled: 'info', booking_cancelled: 'info', booking_taken: 'error', booking_no_lessons: 'error', booking_too_late: 'error',
  'teacher.scheduleSaved': 'success', 'teacher.bookingCancelled': 'info', 'admin.bookingCancelled': 'info',
  'admin.saved': 'success', 'admin.deleted': 'info', 'admin.held': 'success', 'admin.undone': 'info',
  'admin.confirmed': 'success', 'admin.cancelled': 'info', 'admin.settings.tgTestSent': 'success',
  'admin.teacherAssigned': 'success', 'admin.roleSaved': 'success', 'teacher.held': 'success',
};

// Дати графіка: «пт, 27 лист.» і назви днів тижня (1 — понеділок).
const dayLabel = (date, lang) => new Date(`${date}T12:00:00Z`).toLocaleDateString(LOCALES[lang], { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const weekdayName = (n, lang, style = 'long') => new Date(Date.UTC(2024, 0, n, 12)).toLocaleDateString(LOCALES[lang], { weekday: style, timeZone: 'UTC' });
const capital = (text) => text.charAt(0).toUpperCase() + text.slice(1);

const levelLabel = (code, lang) => t(lang, `level.${LEVEL_CODES.includes(code) ? code : 'unknown'}`);

function levelOptions(lang, selected) {
  return LEVEL_CODES.map((k) => `<option value="${k}"${selected === k ? ' selected' : ''}>${h(t(lang, `level.${k}`))}</option>`).join('');
}

const productName = (productId, lang) => t(lang, productId === 'monthly' ? 'product.monthly' : 'product.single');
const lessonsLabel = (n, lang) => (n === 1 ? t(lang, 'product.lesson1') : t(lang, 'product.lessons', { n }));
const paymentStatus = (status, lang) => (['paid', 'pending', 'cancelled'].includes(status) ? t(lang, `pay.${status}`) : status);

// Telegram та Instagram можна вказати як @ім'я, ім'я або посилання.
function socialUrl(value, base) {
  const v = String(value || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  return `${base}${v.replace(/^@/, '').replace(/^(t\.me|instagram\.com)\//i, '')}`;
}

const handle = (value) => {
  const v = String(value || '').trim().replace(/\/+$/, '');
  return v.startsWith('@') ? v : `@${v.split('/').pop()}`;
};

const icon = {
  check: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  cross: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg>',
  clock: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  back: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
  globe: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/></svg>',
  user: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/></svg>',
  phone: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 4.5 5.5a2 2 0 0 1 2-2z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M4 7l8 6 8-6"/></svg>',
  telegram: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="M21 4.5L3 11.5l6 2 2 6 3.5-4 4.5 3.5z"/><path d="M9 13.5l8-6"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r=".8" fill="currentColor"/></svg>',
};

// Контакти школи, які заповнено в налаштуваннях.
function contacts() {
  const list = [];
  if (config.telegram) list.push({ href: socialUrl(config.telegram, 'https://t.me/'), label: handle(config.telegram), icon: icon.telegram, external: true });
  if (config.phone) list.push({ href: `tel:${config.phone.replace(/[^+\d]/g, '')}`, label: config.phone, icon: icon.phone });
  if (config.email) list.push({ href: `mailto:${config.email}`, label: config.email, icon: icon.mail });
  if (config.instagram) list.push({ href: socialUrl(config.instagram, 'https://instagram.com/'), label: handle(config.instagram), icon: icon.instagram, external: true });
  return list;
}

const contactLinks = (cls = 'contact-links') => {
  const list = contacts();
  return list.length
    ? `<div class="${cls}">${list.map((c) => `<a href="${h(c.href)}"${c.external ? ' target="_blank" rel="noopener"' : ''}>${c.icon}<span>${h(c.label)}</span></a>`).join('')}</div>`
    : '';
};

// ---------- Аналітика (Meta Pixel і Google Analytics) ----------

const GA_EVENTS = { Lead: 'generate_lead', CompleteRegistration: 'sign_up', InitiateCheckout: 'begin_checkout', Purchase: 'purchase' };

function analytics(events = []) {
  const pixel = /^\d{6,20}$/.test(config.metaPixelId) ? config.metaPixelId : '';
  const ga = /^G-[A-Z0-9]{4,20}$/i.test(config.gaId) ? config.gaId : '';
  if (!pixel && !ga) return '';
  const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
  let out = '';
  if (ga) {
    out += `<script async src="https://www.googletagmanager.com/gtag/js?id=${ga}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config',${json(ga)});${
  events.map((e) => `gtag('event',${json(GA_EVENTS[e.name] || e.name)},${json(e.value ? { value: e.value, currency: 'UAH' } : {})});`).join('')
}</script>`;
  }
  if (pixel) {
    out += `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${json(pixel)});fbq('track','PageView');${
  events.map((e) => `fbq('track',${json(e.name)}${e.value ? `,${json({ value: e.value, currency: 'UAH' })}` : ''});`).join('')
}</script>`;
  }
  return out;
}

// ---------- Каркас сторінки ----------

function langSwitch(lang) {
  return `
    <div class="lang-switch" role="group" aria-label="${h(t(lang, 'lang.switch'))}">
      ${icon.globe}
      <a href="/lang/uk" hreflang="uk" lang="uk"${lang === 'uk' ? ' aria-current="true"' : ''}>UA</a>
      <a href="/lang/en" hreflang="en" lang="en"${lang === 'en' ? ' aria-current="true"' : ''}>EN</a>
    </div>`;
}

function layout(ctx, { title, body, bodyClass = '', events = [], noindex = false, notice, error }) {
  const { lang, user, msg, origin, path, hasTeachers, hasReviews } = ctx;
  const T = (key, vars) => t(lang, key, vars);
  const name = config.schoolName;
  const flashType = MESSAGE_TYPES[msg];
  const flashText = flashType && (/^(admin|teacher)\./.test(msg) ? T(msg) : T(`msg.${msg}`));
  const pageTitle = title ? `${title} — ${name}` : `${name} — ${T('meta.title')}`;
  const description = T('meta.description', { price: money(config.lessonPrice, lang) });
  const base = config.siteUrl || origin;
  const onHome = path === '/';
  const anchor = (id) => (onHome ? `#${id}` : `/#${id}`);
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${h(pageTitle)}</title>
<meta name="description" content="${h(description)}">
${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${h(base + path)}">`}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${h(name)}">
<meta property="og:title" content="${h(pageTitle)}">
<meta property="og:description" content="${h(description)}">
<meta property="og:url" content="${h(base + path)}">
<meta property="og:image" content="${h(base)}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="${lang === 'uk' ? 'uk_UA' : 'en_GB'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#3a2840">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css?v=20">
${analytics(events)}
</head>
<body class="${h(bodyClass)}">
<a class="skip-link" href="#main">${lang === 'uk' ? 'Перейти до вмісту' : 'Skip to content'}</a>
<header class="site-header">
  <div class="container header-inner">
    <a class="logo" href="/">
      <span class="logo-mark">${h(name[0])}</span>
      <span>${h(name)}<small>${h(config.tagline)}</small></span>
    </a>
    <div class="header-tools">
      ${langSwitch(lang)}
      <button class="nav-toggle" aria-label="${h(T('nav.menu'))}" aria-expanded="false"><span></span><span></span></button>
    </div>
    <nav class="nav">
      <a href="${anchor('goals')}">${T('nav.goals')}</a>
      <a href="${anchor('pricing')}">${T('nav.pricing')}</a>
      ${hasTeachers ? `<a href="${anchor('teachers')}">${T('nav.teachers')}</a>` : ''}
      ${hasReviews ? `<a href="${anchor('reviews')}">${T('nav.reviews')}</a>` : ''}
      <a href="${anchor('faq')}">${T('nav.faq')}</a>
      ${user
        ? `${user.is_admin ? `<a href="/admin">${T('nav.admin')}</a>` : ''}
           <a class="btn btn-small btn-dark" href="${user.is_teacher ? '/teacher' : '/dashboard'}">${icon.user} ${T(user.is_teacher ? 'nav.teacher' : 'nav.cabinet')}</a>`
        : `<a href="/login">${T('nav.login')}</a>
           <a class="btn btn-small btn-dark" href="${anchor('trial')}">${T('nav.consult')}</a>`}
    </nav>
  </div>
</header>
${flashType ? `<div class="container"><div class="flash flash-${flashType}" role="status">${h(flashText)}</div></div>` : ''}
${notice ? `<div class="container"><div class="flash flash-success" role="status">${h(notice)}</div></div>` : ''}
${error ? `<div class="container"><div class="flash flash-error" role="alert">${h(error)}</div></div>` : ''}
<main id="main">
${body}
</main>
<footer class="site-footer">
  <div class="container footer-inner">
    <div>
      <a class="logo logo-light" href="/"><span class="logo-mark">${h(name[0])}</span><span>${h(name)}<small>${h(config.tagline)}</small></span></a>
      <p class="muted">${T('footer.slogan')}</p>
    </div>
    <div class="footer-links">
      <a href="/#pricing">${T('nav.pricing')}</a>
      <a href="/#trial">${T('nav.consult')}</a>
      <a href="/dashboard">${T('nav.cabinet')}</a>
      <a href="/offer">${T('footer.offer')}</a>
      <a href="/privacy">${T('footer.privacy')}</a>
    </div>
    ${contactLinks('footer-contacts')}
  </div>
  <div class="container footer-bottom">© ${new Date().getFullYear()} ${h(name)}. ${T('footer.rights')}</div>
</footer>
<script src="/app.js?v=9" defer></script>
</body>
</html>`;
}

// ---------- Головна ----------

function home(ctx, { teachers, reviews }) {
  const { lang, user } = ctx;
  const T = (key, vars) => t(lang, key, vars);
  const { single, monthly } = config.products;
  const price = money(single.price, lang);
  const goals = T('goals.list').split('|');
  const faqVars = {
    price, n: monthly.lessons, pkg: money(monthly.price, lang), full: money(monthly.fullPrice, lang), each: money(monthly.each, lang),
  };

  const body = `
<section class="hero">
  <div class="container hero-inner">
    <div class="hero-text">
      <p class="eyebrow">${T('hero.eyebrow')}</p>
      <h1>${T('hero.title')}</h1>
      <p class="lead">${T('hero.lead')}</p>
      <p class="hero-price">${icon.clock} ${T('hero.price', { price: `<b>${price}</b>` })}</p>
      <div class="hero-actions">
        ${user
          ? `<a class="btn btn-dark" href="/dashboard">${T('hero.cabinet')} ${icon.arrow}</a>`
          : `<a class="btn btn-dark" href="#trial">${T('hero.cta')} ${icon.arrow}</a>`}
        <a class="btn btn-ghost" href="#pricing">${T('hero.pricing')}</a>
      </div>
      <ul class="hero-points">
        <li>${icon.check} ${T('hero.point1')}</li>
        <li>${icon.check} ${T('hero.point2', { n: monthly.lessons, pkg: money(monthly.price, lang) })}</li>
        <li>${icon.check} ${T('hero.point3')}</li>
      </ul>
    </div>
    <div class="hero-card" aria-hidden="true">
      <div class="hc-top">
        <span class="hc-badge">${T('hero.card.badge')}</span>
        <span class="hc-time">${icon.clock} ${config.lessonDuration} ${T('unit.min')}</span>
      </div>
      <p class="hc-title">${T('hero.card.when')}</p>
      <div class="hc-teacher">
        <span class="hc-avatar">${icon.user}</span>
        <span><b>${T('hero.card.teacher')}</b><small>${T('hero.card.online')}</small></span>
      </div>
      <div class="hc-progress"><span style="width:62.5%"></span></div>
      <p class="hc-caption">${T('hero.card.subscription')}</p>
      <div class="hc-word">
        <span class="hc-label">${T('hero.card.word')}</span>
        <span class="hc-en">serendipity</span>
        <span class="hc-ru">${T('hero.card.translation')}</span>
      </div>
    </div>
  </div>
</section>

<section class="stats">
  <div class="container stats-inner">
    <div><b>1:1</b><span>${T('stats.format')}</span></div>
    <div><b>${config.lessonDuration}</b><span>${T('stats.minutes')}</span></div>
    <div><b>${price}</b><span>${T('stats.price')}</span></div>
    <div><b>${money(monthly.price, lang)}</b><span>${T('stats.discount', { n: monthly.lessons })}</span></div>
  </div>
</section>

<section class="section" id="goals">
  <div class="container">
    <div class="section-head">
      <p class="eyebrow">${T('goals.eyebrow')}</p>
      <h2>${T('goals.title')}</h2>
      <p class="muted">${T('goals.lead')}</p>
    </div>
    <ul class="goals">
      ${goals.map((g) => `<li>${icon.check} ${h(g)}</li>`).join('')}
    </ul>
    <p class="goals-note">${T('goals.note', { price: h(price) })}</p>
  </div>
</section>

<section class="section section-tint" id="format">
  <div class="container">
    <div class="section-head">
      <p class="eyebrow">${T('format.eyebrow')}</p>
      <h2>${T('format.title')}</h2>
    </div>
    <div class="format-grid">
      ${[1, 2, 3, 4].map((n) => `
        <article class="format-item">
          <span class="format-num">0${n}</span>
          <h3>${T(`format.f${n}.title`)}</h3>
          <p>${T(`format.f${n}.text`)}</p>
        </article>`).join('')}
    </div>
  </div>
</section>

<section class="section" id="how">
  <div class="container">
    <div class="section-head">
      <p class="eyebrow">${T('how.eyebrow')}</p>
      <h2>${T('how.title')}</h2>
    </div>
    <ol class="steps">
      ${[1, 2, 3, 4].map((n) => `<li><span>${n}</span><h3>${T(`how.s${n}.title`)}</h3><p>${T(`how.s${n}.text`)}</p></li>`).join('')}
    </ol>
  </div>
</section>

<section class="section section-tint" id="pricing">
  <div class="container">
    <div class="section-head">
      <p class="eyebrow">${T('pricing.eyebrow')}</p>
      <h2>${T('pricing.title')}</h2>
      <p class="muted">${T('pricing.lead')}</p>
    </div>
    <div class="pricing">
      <article class="price-card">
        <h3>${T('pricing.trial.title')}</h3>
        <p class="price">${money(0, lang)}<small> ${T('pricing.trial.per', { min: config.trialMinutes })}</small></p>
        <p class="muted small">${T('trial.about', { min: config.trialMinutes })}</p>
        <ul>
          <li>${icon.check} ${T('pricing.trial.f1')}</li>
          <li>${icon.check} ${T('pricing.trial.f2')}</li>
          <li>${icon.check} ${T('pricing.trial.f3')}</li>
        </ul>
        <a class="btn btn-ghost" href="${ctx.hasTeachers ? '#teachers' : '#trial'}">${T('pricing.trial.cta')}</a>
      </article>
      <article class="price-card">
        <h3>${T('pricing.single.title')}</h3>
        <p class="price">${price}<small> ${T('pricing.single.per')}</small></p>
        <ul>
          <li>${icon.check} ${T('pricing.single.f1')}</li>
          <li>${icon.check} ${T('pricing.single.f2')}</li>
          <li>${icon.check} ${T('pricing.single.f3')}</li>
        </ul>
        <a class="btn btn-ghost" href="/pay/single">${T('pricing.single.cta')}</a>
      </article>
      <article class="price-card price-card-accent">
        ${monthly.save ? `<span class="price-badge">${T('pricing.monthly.badge', { save: money(monthly.save, lang) })}</span>` : ''}
        <h3>${T('pricing.monthly.title')}</h3>
        ${monthly.save ? `<p class="price-old">${money(monthly.fullPrice, lang)}</p>` : ''}
        <p class="price">${money(monthly.price, lang)}<small> ${T('pricing.monthly.per', { n: monthly.lessons })}</small></p>
        <ul>
          <li>${icon.check} ${T('pricing.monthly.f1', { n: monthly.lessons })}</li>
          <li>${icon.check} ${T('pricing.monthly.f2', { n: monthly.lessons, full: money(monthly.fullPrice, lang) })}</li>
          ${monthly.save ? `<li>${icon.check} ${T('pricing.monthly.f3', { save: money(monthly.fullPrice - monthly.price, lang) })}</li>` : ''}
          <li>${icon.check} ${T('pricing.monthly.f4')}</li>
        </ul>
        <a class="btn btn-light" href="/pay/monthly">${T('pricing.monthly.cta')}</a>
      </article>
    </div>
    <p class="legal-note">${T('pricing.legal')}</p>
  </div>
</section>

${teachers.length ? `
<section class="section" id="teachers">
  <div class="container">
    <div class="section-head">
      <p class="eyebrow">${T('teachers.eyebrow')}</p>
      <h2>${T('teachers.title')}</h2>
    </div>
    <div class="teachers teachers-${Math.min(teachers.length, 3)}">
      ${teachers.map((teacher) => `
        <article class="teacher">
          ${teacher.photo
            ? `<img class="avatar avatar-photo" src="${h(teacher.photo)}" alt="${h(teacher.name)}" loading="lazy" width="112" height="112">`
            : `<div class="avatar">${h(teacher.name[0])}</div>`}
          <h3>${h(teacher.name)}</h3>
          ${teacher.role ? `<p class="teacher-role">${h(teacher.role)}</p>` : ''}
          ${teacher.about ? `<p class="muted">${h(teacher.about)}</p>` : ''}
          ${teacher.accountId ? `
          <div class="teacher-actions">
            <a class="btn btn-small btn-accent" href="${ctx.user ? `/schedule/${teacher.accountId}` : `/register?next=${encodeURIComponent(`/schedule/${teacher.accountId}`)}`}">${T('trial.button')}</a>
            <a class="btn btn-small btn-ghost teacher-slots" href="/schedule/${teacher.accountId}">${icon.clock} ${T('schedule.button')}</a>
          </div>` : ''}
        </article>`).join('')}
    </div>
  </div>
</section>` : ''}

${reviews.length ? `
<section class="section ${teachers.length ? 'section-tint' : ''}" id="reviews">
  <div class="container">
    <div class="section-head">
      <p class="eyebrow">${T('reviews.eyebrow')}</p>
      <h2>${T('reviews.title')}</h2>
    </div>
    <div class="reviews">
      ${reviews.map((r) => `
        <figure class="review">
          <blockquote>${h(r.text)}</blockquote>
          <figcaption>— ${h(r.name)}</figcaption>
        </figure>`).join('')}
    </div>
  </div>
</section>` : ''}

<section class="section ${(teachers.length ? 1 : 0) + (reviews.length ? 1 : 0) === 1 ? 'section-tint' : ''}" id="faq">
  <div class="container container-narrow">
    <div class="section-head">
      <p class="eyebrow">${T('faq.eyebrow')}</p>
      <h2>${T('faq.title')}</h2>
    </div>
    <div class="faq">
      ${[1, 2, 3, 4, 5, 6, 7].map((n) => `<details><summary>${T(`faq.q${n}`)}</summary><p>${T(`faq.a${n}`, faqVars)}</p></details>`).join('')}
    </div>
  </div>
</section>

<section class="cta" id="trial">
  <div class="container cta-inner">
    <div>
      <p class="eyebrow eyebrow-light">${T('cta.eyebrow')}</p>
      <h2>${T('cta.title')}</h2>
      <p>${T('cta.text')}</p>
      ${contactLinks('cta-contacts')}
    </div>
    <form class="cta-form" method="post" action="/request">
      <label>${T('cta.name')}<input name="name" required maxlength="80" autocomplete="name"></label>
      <label>${T('cta.contact')}<input name="contact" required maxlength="120" autocomplete="tel" inputmode="tel" placeholder="+380"></label>
      <label>${T('cta.goal')} <span class="optional">${T('form.optional')}</span><textarea name="message" rows="2" maxlength="1000" placeholder="${h(T('cta.goalHint'))}"></textarea></label>
      <label class="hp" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>
      <button class="btn btn-light" type="submit">${T('cta.submit')}</button>
      <p class="form-note">${T('cta.privacy')}</p>
    </form>
  </div>
</section>`;
  return layout(ctx, { body });
}

function thanks(ctx) {
  const { lang, user } = ctx;
  const T = (key) => t(lang, key);
  const links = contactLinks();
  const body = `
<section class="auth">
  <div class="auth-card center">
    <div class="success-icon">${icon.check}</div>
    <h1>${T('thanks.title')}</h1>
    <p class="muted">${T('thanks.text')}</p>
    ${links ? `<p class="small">${T('thanks.contact')}</p>${links}` : ''}
    ${user ? '' : `<p class="muted small">${T('thanks.next')}</p><a class="btn btn-dark btn-block" href="/register">${T('thanks.register')}</a>`}
    <p class="auth-switch"><a href="/">${T('thanks.home')}</a></p>
  </div>
</section>`;
  return layout(ctx, { title: T('thanks.title'), body, bodyClass: 'page-auth', events: [{ name: 'Lead' }], noindex: true });
}

// ---------- Вхід і реєстрація ----------

function authPage(ctx, { mode, error, values = {}, next }) {
  const { lang } = ctx;
  const T = (key, vars) => t(lang, key, vars);
  const isRegister = mode === 'register';
  const nextQuery = next ? `?next=${encodeURIComponent(next)}` : '';
  const body = `
<section class="auth">
  <div class="auth-card">
    <h1>${T(isRegister ? 'auth.register.title' : 'auth.login.title')}</h1>
    <p class="muted">${T(isRegister ? 'auth.register.lead' : 'auth.login.lead')}</p>
    ${error ? `<div class="flash flash-error" role="alert">${h(error)}</div>` : ''}
    <form method="post" action="/${mode}" class="form">
      ${next ? `<input type="hidden" name="next" value="${h(next)}">` : ''}
      ${isRegister ? `<label>${T('auth.name')}<input name="name" required maxlength="80" value="${h(values.name)}" autocomplete="name"></label>` : ''}
      <label>${T('auth.email')}<input type="email" name="email" required maxlength="120" value="${h(values.email)}" autocomplete="email" autocapitalize="none" spellcheck="false"></label>
      ${isRegister ? `<label>${T('auth.phone')} <span class="optional">— ${T('auth.phoneHint')}</span><input type="tel" name="phone" required maxlength="30" value="${h(values.phone)}" autocomplete="tel" placeholder="+380"></label>` : ''}
      <label>${T('auth.password')}${isRegister ? ` <span class="optional">— ${T('auth.passwordHint')}</span>` : ''}<input type="password" name="password" required minlength="${isRegister ? 8 : 1}" autocomplete="${isRegister ? 'new-password' : 'current-password'}"></label>
      ${isRegister ? `<label>${T('auth.level')}<select name="level">${levelOptions(lang, values.level || 'unknown')}</select></label>` : ''}
      ${isRegister ? `<label class="check"><input type="checkbox" name="agree" value="1" required${values.agree ? ' checked' : ''}> <span>${T('auth.agree')}</span></label>` : ''}
      <button class="btn btn-dark btn-block" type="submit">${T(isRegister ? 'auth.register.submit' : 'auth.login.submit')}</button>
    </form>
    ${isRegister ? '' : `<p class="auth-forgot"><a href="/forgot">${T('auth.forgot')}</a></p>`}
    <p class="auth-switch">${isRegister
      ? `${T('auth.haveAccount')} <a href="/login${nextQuery}">${T('auth.toLogin')}</a>`
      : `${T('auth.noAccount')} <a href="/register${nextQuery}">${T('auth.toRegister')}</a>`}</p>
  </div>
</section>`;
  return layout(ctx, { title: T(isRegister ? 'auth.register.title' : 'auth.login.title'), body, bodyClass: 'page-auth', noindex: true });
}

function forgot(ctx) {
  const T = (key) => t(ctx.lang, key);
  const links = contactLinks();
  const body = `
<section class="auth">
  <div class="auth-card">
    <h1>${T('forgot.title')}</h1>
    <p class="muted">${links ? T('forgot.text') : T('forgot.noContacts')}</p>
    ${links}
    <p class="auth-switch"><a href="/login">${T('auth.toLogin')}</a></p>
  </div>
</section>`;
  return layout(ctx, { title: T('forgot.title'), body, bodyClass: 'page-auth', noindex: true });
}

// ---------- Особистий кабінет ----------

// Графік годин: вільні — кнопки запису (або просто перегляд), зайняті — червоні, свій запис — лавандовий.
function slotGrid(days, lang, { bookable, teacherId, trial = false, max = 1 }) {
  // Кілька оплачених занять — можна відмітити кілька годин і записатися одним натисканням.
  const multi = bookable && !trial && max > 1;
  const T = (key) => t(lang, key);
  const chip = (date, s) => {
    if (s.status === 'taken') return `<span class="slot slot-taken" title="${h(T('slot.taken'))}">${s.time} <small>${T('slot.taken')}</small></span>`;
    if (s.status === 'mine') return `<span class="slot slot-mine">${s.time} <small>${T('slot.mine')}</small></span>`;
    // Перед записом — підтвердження з датою й часом, щоб було зрозуміло, на що саме записуєтеся.
    const when = `${capital(dayLabel(date, lang))} · ${s.time}`;
    const ask = trial ? `${when} · ${config.trialMinutes} ${t(lang, 'unit.min')}` : `${when} · ${config.lessonDuration} ${t(lang, 'unit.min')}`;
    const askAttrs = `data-confirm="${h(ask)}" data-confirm-title="${h(t(lang, trial ? 'confirm.trialTitle' : 'confirm.lessonTitle'))}" data-confirm-ok="${h(t(lang, 'confirm.book'))}" data-confirm-icon="${trial ? 'gift' : 'calendar'}"`;
    if (multi) return `<label class="slot slot-pick"><input type="checkbox" name="slot" value="${date}|${s.time}" data-when="${h(`${capital(dayLabel(date, lang))}, ${s.time}`)}"> ${s.time}</label>`;
    return bookable ? `<button class="slot${trial ? ' slot-trial' : ''}" name="slot" value="${date}|${s.time}" ${askAttrs}>${s.time}</button>` : `<span class="slot slot-view">${s.time}</span>`;
  };
  return `
    <form method="post" action="/book" class="slots"${multi ? ` data-multi="${max}" data-confirm-many="${h(t(lang, 'book.confirmMany'))}" data-confirm-ok="${h(t(lang, 'confirm.book'))}"` : ''}>
      ${multi ? `<p class="small slots-hint">${t(lang, 'book.multiHint', { n: max })}</p>` : ''}
      ${teacherId ? `<input type="hidden" name="teacher_id" value="${teacherId}">` : ''}
      ${days.map((d) => `
        <div class="slot-day">
          <span class="slot-date">${h(capital(dayLabel(d.date, lang)))}</span>
          <div class="slot-times">${d.times.map((s) => chip(d.date, s)).join('')}</div>
        </div>`).join('')}
    ${multi ? `
      <div class="slots-submit">
        <span class="slots-count" data-template="${h(t(lang, 'book.picked', { n: '{n}', max }))}">${t(lang, 'book.picked', { n: 0, max })}</span>
        <button class="btn btn-accent" type="submit">${t(lang, 'book.submitMany')}</button>
      </div>` : ''}
    </form>
    <p class="slot-legend"><span class="slot slot-view">10:00</span> ${T('slot.legendFree')} <span class="slot slot-taken">10:00</span> ${T('slot.legendTaken')}</p>`;
}

const hasFree = (days) => days.some((d) => d.times.some((s) => s.status === 'free'));

// «Скасувати» для неоплаченого замовлення.
const cancelOrderButton = (order, lang) => `
  <form method="post" action="/orders/${order.id}/cancel" data-confirm="${h(t(lang, 'order.cancelConfirm', { id: order.id }))}" data-confirm-danger>
    <button class="btn btn-small btn-ghost" type="submit">${t(lang, 'order.cancel')}</button>
  </form>`;

// Підказка про безкоштовний пробний урок у блоці запису.
const trialNote = (lang) => `
  <div class="booking-note booking-trial">
    <p><b>${t(lang, 'trial.noteTitle', { min: config.trialMinutes })}</b></p>
    <p class="small">${t(lang, 'trial.about', { min: config.trialMinutes })}</p>
    <p class="small">${t(lang, 'trial.pick')}</p>
  </div>`;

function dashboard(ctx, { balance, orders, teacher, teachers = [], upcoming = [], canBook = 0, trial = false, hasSchedule = false, freeSlots = [] }) {
  const { lang, user, msg } = ctx;
  const T = (key, vars) => t(lang, key, vars);
  const { single, monthly } = config.products;
  const pending = orders.filter((o) => o.status === 'pending');
  const pendingLessons = pending.reduce((s, o) => s + o.lessons, 0);
  const links = contactLinks();
  const events = [];
  if (msg === 'registered') events.push({ name: 'CompleteRegistration' });
  if (msg === 'paid' || msg === 'payment_pending') {
    const last = orders[0];
    events.push({ name: 'Purchase', value: last ? last.amount : single.price });
  }

  const body = `
<section class="dash">
  <div class="container">
    <div class="dash-head">
      <div>
        <p class="eyebrow">${T('dash.eyebrow')}</p>
        <h1>${h(T('dash.hello', { name: user.name.split(' ')[0] }))}</h1>
        <p class="muted">${T('dash.level')}: ${h(levelLabel(user.level, lang))} · <a href="/account">${T('dash.settings')}</a></p>
      </div>
      <form method="post" action="/logout"><button class="btn btn-ghost btn-small" type="submit">${T('dash.logout')}</button></form>
    </div>

    ${teacher ? `
    <div class="panel teacher-card">
      ${teacher.photo ? `<img class="avatar avatar-photo avatar-sm" src="${h(teacher.photo)}" alt="">` : `<div class="avatar avatar-sm">${h(teacher.name[0])}</div>`}
      <div>
        <span class="panel-label">${T('choose.yours')}</span>
        <b>${h(teacher.name)}</b>
        ${teacher.role ? `<span class="muted small">${h(teacher.role)}</span>` : ''}
      </div>
    </div>` : ''}

    ${trial && !upcoming.length && (!teacher || !hasSchedule) ? `
    <div class="panel booking booking-trial-panel" id="trial-book">
      <h2 class="panel-title">🎁 ${T('trial.panelTitle', { min: config.trialMinutes })}</h2>
      <p class="muted small">${T('trial.about', { min: config.trialMinutes })}</p>
      <p class="small"><b>${T('trial.panelStep')}</b></p>
      <div class="trial-teachers">
        ${teachers.filter((tch) => tch.days && tch.days.length).map((tch) => `
        <a class="btn btn-accent" href="/schedule/${tch.id}">${T('trial.pickTeacher', { name: tch.name })}</a>`).join('') || `<p class="muted small">${T('trial.noTeachers')}</p>`}
      </div>
    </div>` : ''}

    ${teacher ? `
    <div class="panel booking" id="book">
      <h2 class="panel-title">${T('book.title')}</h2>
      <p class="muted small">${T('book.lead')}</p>
      ${upcoming.length ? `
        <div class="booking-mine">
          <span class="panel-label">${T('book.mine')}</span>
          ${upcoming.map((b) => `
            <div class="booking-row">
              <b>${h(capital(dayLabel(b.date, lang)))} · ${h(b.time)}</b>
              ${b.kind === 'trial' ? `<span class="tag tag-accent">${T('trial.badge', { min: config.trialMinutes })}</span>` : ''}
              <span class="muted small">${h(b.teacher_name)}</span>
              ${b.canCancel
                ? `<form method="post" action="/bookings/${b.id}/cancel" data-confirm="${h(T('book.confirmCancel'))}" data-confirm-danger><button class="btn btn-small btn-ghost">${T('book.cancel')}</button></form>`
                : `<span class="muted small">${T('book.cancelLate')}</span>`}
            </div>`).join('')}
        </div>` : ''}
      ${!hasSchedule ? `<p class="booking-note">${T('book.noSchedule')}</p>` : `
        ${canBook > 0 ? `<p class="small"><b>${T('book.left', { n: canBook })}</b></p>` : trial ? trialNote(lang) : `<p class="booking-note">${T('book.payFirst')}</p>`}
        ${!hasFree(freeSlots) ? `<p class="booking-note">${T('book.noFree')}</p>` : ''}
        ${freeSlots.length ? slotGrid(freeSlots, lang, { bookable: canBook > 0 || trial, trial: canBook <= 0 && trial, max: canBook }) : ''}`}
    </div>` : ''}

    ${teachers.length ? `
    <details class="choose-teacher"${teacher ? '' : ' open'}>
      <summary>${T(teacher ? 'choose.change' : 'choose.title')}</summary>
      ${teacher ? '' : `<p class="muted">${T('choose.lead')}</p>`}
      <div class="choose-grid">
        ${teachers.map((tch) => `
          <form method="post" action="/choose-teacher" class="panel choose-card${teacher && teacher.id === tch.id ? ' is-current' : ''}">
            <input type="hidden" name="teacher_id" value="${tch.id}">
            ${tch.photo ? `<img class="avatar avatar-photo" src="${h(tch.photo)}" alt="${h(tch.name)}" loading="lazy">` : `<div class="avatar">${h(tch.name[0])}</div>`}
            <h3>${h(tch.name)}</h3>
            ${tch.role ? `<p class="teacher-role">${h(tch.role)}</p>` : ''}
            ${tch.about ? `<p class="muted small">${h(tch.about)}</p>` : ''}
            ${tch.days && tch.days.length ? `<p class="choose-days">${h(T('choose.days', { days: tch.days.sort((a, b) => a - b).map((d) => weekdayName(d, lang, 'short')).join(', ') }))}</p>` : ''}
            <div class="choose-actions">
              ${tch.days && tch.days.length ? `<a class="btn btn-small btn-ghost" href="/schedule/${tch.id}">${icon.clock} ${T('schedule.button')}</a>` : ''}
              ${teacher && teacher.id === tch.id
                ? `<span class="pill pill-paid">${T('choose.current')}</span>`
                : `<button class="btn btn-small btn-dark" type="submit">${T('choose.button')}</button>`}
            </div>
          </form>`).join('')}
      </div>
    </details>` : ''}

    <div class="dash-grid">
      <div class="panel balance-panel">
        <span class="panel-label">${T('dash.balance')}</span>
        ${balance.bought ? `
          <div class="balance-num">${balance.left}</div>
          <p class="balance-caption">${T('dash.left')}</p>
          <p class="muted small">${T('dash.stats', { bought: balance.bought, held: balance.held })}</p>`
        : `<p class="balance-empty">${T('dash.empty')}</p><p class="muted small">${T('dash.emptyHint')}</p>`}
        ${pendingLessons ? `
          <p class="pending-note">${h(T('dash.pendingNote', { n: lessonsLabel(pendingLessons, lang) }))}</p>
          <div class="pending-actions">
            <a class="btn btn-small btn-accent" href="/checkout/${pending[0].id}">${T('dash.payPending')}</a>
            ${cancelOrderButton(pending[0], lang)}
          </div>` : ''}
      </div>

      <div class="panel buy-panel">
        <span class="panel-label">${T('dash.buy')}</span>
        <div class="buy-option">
          <div>
            <b>${T('product.single')}</b>
            <span>${lessonsLabel(1, lang)} · ${config.lessonDuration} ${T('unit.min')}</span>
          </div>
          <div class="buy-price"><b>${money(single.price, lang)}</b></div>
          <a class="btn btn-small btn-ghost" href="/pay/single">${T('btn.pay')}</a>
        </div>
        <div class="buy-option buy-option-accent">
          <div>
            <b>${T('product.monthly')} ${monthly.save ? `<span class="tag tag-accent">−${money(monthly.save, lang)}</span>` : ''}</b>
            <span>${T('pricing.monthly.f1', { n: monthly.lessons })}</span>
          </div>
          <div class="buy-price">${monthly.save ? `<s>${money(monthly.fullPrice, lang)}</s>` : ''}<b>${money(monthly.price, lang)}</b></div>
          <a class="btn btn-small btn-accent" href="/pay/monthly">${T('btn.pay')}</a>
        </div>
        <p class="muted small">${h(T('dash.buyLead', { phone: user.phone || T('dash.noPhone') }))}</p>
        <p class="muted small">${T('dash.consult')}</p>
        <p class="muted small">${T('checkout.legal')}</p>
      </div>
    </div>

    ${links ? `<div class="dash-contacts"><span>${T('dash.contact')}</span>${links}</div>` : ''}

    ${orders.length ? `
    <h2 class="dash-title">${T('dash.orders')}</h2>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>${T('table.product')}</th><th>${T('table.amount')}</th><th>${T('table.date')}</th><th>${T('table.status')}</th><th></th></tr></thead>
        <tbody>
          ${orders.map((o) => `
          <tr>
            <td>${h(productName(o.product, lang))}<br><span class="muted small">№ ${o.id} · ${h(lessonsLabel(o.lessons, lang))}</span></td>
            <td>${money(o.amount, lang)}</td>
            <td>${date(o.created_at, lang)}</td>
            <td><span class="pill pill-${h(o.status)}">${h(paymentStatus(o.status, lang))}</span></td>
            <td class="actions">${o.status === 'pending' ? `<a class="btn btn-small btn-ghost" href="/checkout/${o.id}">${T('btn.pay')}</a>${cancelOrderButton(o, lang)}` : ''}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : ''}
  </div>
</section>`;
  return layout(ctx, { title: T('nav.cabinet'), body, bodyClass: 'page-app', events, noindex: true });
}

// ---------- Оплата ----------

// Підтвердження номера: код з SMS.
function verifyPhone(ctx, { next = '/dashboard', error, notice }) {
  const { lang, user } = ctx;
  const T = (key, vars) => t(lang, key, vars);
  const q = `?next=${encodeURIComponent(next)}`;
  const body = `
<section class="auth">
  <div class="auth-card">
    <p class="eyebrow">${T('verify.eyebrow')}</p>
    <h1>${T('verify.title')}</h1>
    <p class="muted">${T('verify.lead', { phone: user.phone || '' })}</p>
    ${notice ? `<div class="flash flash-success">${h(notice)}</div>` : ''}
    ${error ? `<div class="flash flash-error">${h(error)}</div>` : ''}
    <form method="post" action="/verify-phone${q}" class="form">
      <label>${T('verify.code')}<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required autofocus placeholder="000000" class="code-input"></label>
      <button class="btn btn-accent btn-block" type="submit">${T('verify.submit')}</button>
    </form>
    <form method="post" action="/verify-phone/resend${q}" class="verify-resend">
      <button class="btn btn-ghost btn-small" type="submit">${T('verify.resend')}</button>
    </form>
    <details class="verify-change">
      <summary>${T('verify.changeTitle')}</summary>
      <form method="post" action="/verify-phone/change${q}" class="form">
        <label>${T('auth.phone')}<input name="phone" type="tel" required placeholder="+380 67 000 00 00" autocomplete="tel"></label>
        <button class="btn btn-dark btn-small" type="submit">${T('verify.changeSubmit')}</button>
      </form>
    </details>
    <form method="post" action="/logout" class="auth-switch"><button class="link-button" type="submit">${T('dash.logout')}</button></form>
  </div>
</section>`;
  return layout(ctx, { title: T('verify.title'), body, bodyClass: 'page-auth', noindex: true });
}

// Перед оплатою: куди з учнем зв'язуватися.
function payContact(ctx, { product, messengers, values = {}, error }) {
  const { lang, user } = ctx;
  const T = (key, vars) => t(lang, key, vars);
  const method = values.method || user.contact_method || 'telegram';
  const value = values.value ?? user.contact_value ?? '';
  const body = `
<section class="auth">
  <div class="auth-card checkout">
    <p class="eyebrow">${T('checkout.eyebrow')}</p>
    <h1>${h(productName(product.id, lang))}</h1>
    <div class="checkout-row checkout-total"><span>${T('checkout.total')}</span><b>${money(product.price, lang)}</b></div>
    <form method="post" action="/pay/${product.id}" class="form">
      <p class="checkout-label">${T('pay.contactTitle')}</p>
      <p class="muted small">${T('pay.contactLead')}</p>
      ${error ? `<div class="flash flash-error">${h(error)}</div>` : ''}
      <div class="messenger-options">
        ${messengers.map((m) => `
        <label class="messenger"><input type="radio" name="contact_method" value="${m}"${m === method ? ' checked' : ''} required> <span>${T(`messenger.${m}`)}</span></label>`).join('')}
      </div>
      <label>${T('pay.contactValue')}<input name="contact_value" value="${h(value)}" maxlength="100" required placeholder="${h(T('pay.contactPlaceholder'))}" autocomplete="tel"></label>
      <button class="btn btn-accent btn-block" type="submit">${T('pay.continue')}</button>
    </form>
    <p class="auth-switch"><a class="btn btn-ghost btn-small" href="/dashboard">${T('order.cancel')}</a></p>
  </div>
</section>`;
  return layout(ctx, { title: T('checkout.eyebrow'), body, bodyClass: 'page-auth', noindex: true });
}

function checkout(ctx, { product, order, mode }) {
  const { lang, user } = ctx;
  const T = (key, vars) => t(lang, key, vars);
  let action;
  if (mode === 'demo') {
    action = `
    <div class="flash flash-info">${T('checkout.demo')}</div>
    <form method="post" action="/pay/demo/${order.id}">
      <button class="btn btn-accent btn-block" type="submit">${T('checkout.demoSubmit', { amount: money(order.amount, lang) })}</button>
    </form>`;
  } else if (mode === 'details') {
    action = `
    <p class="checkout-label">${T('checkout.details')}</p>
    <div class="pay-details">${h(config.paymentDetails)}</div>
    <p class="small">${T('checkout.purpose', { id: order.id })}</p>
    <p class="muted small">${T('checkout.after')}</p>
    <a class="btn btn-accent btn-block" href="/payment/success">${T('checkout.done')}</a>`;
  } else {
    action = `
    <div class="flash flash-success">${T('checkout.manual')}</div>
    ${contactLinks()}
    <a class="btn btn-accent btn-block" href="/dashboard">${T('checkout.done')}</a>`;
  }
  const body = `
<section class="auth">
  <div class="auth-card checkout">
    <p class="eyebrow">${T('checkout.eyebrow')}</p>
    <h1>${h(productName(product.id, lang))}</h1>
    <div class="checkout-row"><span>${T('checkout.student')}</span><b>${h(user.name)}<br><span class="muted small">${h(user.email)}</span></b></div>
    <div class="checkout-row"><span>${T('checkout.number')}</span><b>№ ${order.id}</b></div>
    ${order.contact ? `<div class="checkout-row"><span>${T('pay.contactShort')}</span><b>${h(order.contact)}</b></div>` : ''}
    <div class="checkout-row"><span>${T('checkout.lessons')}</span><b>${h(lessonsLabel(order.lessons, lang))} · ${config.lessonDuration} ${T('unit.min')}</b></div>
    ${product.save && product.id === 'monthly' ? `<div class="checkout-row"><span>${T('checkout.discount')}</span><b>${money(product.save, lang)} (<s>${money(product.fullPrice, lang)}</s>)</b></div>` : ''}
    <div class="checkout-row checkout-total"><span>${T('checkout.total')}</span><b>${money(order.amount, lang)}</b></div>
    ${action}
    <p class="legal-note">${T('checkout.legal')}</p>
    <div class="checkout-cancel">${cancelOrderButton(order, lang)}<a href="/dashboard">${T('checkout.back')}</a></div>
  </div>
</section>`;
  return layout(ctx, {
    title: T('checkout.eyebrow'), body, bodyClass: 'page-auth', noindex: true,
    events: [{ name: 'InitiateCheckout', value: order.amount }],
  });
}

// ---------- Профіль ----------

function account(ctx, { error }) {
  const { lang, user } = ctx;
  const T = (key) => t(lang, key);
  const body = `
<section class="dash">
  <div class="container container-narrow">
    <a class="back-link" href="/dashboard">${icon.back} ${T('account.back')}</a>
    <h1>${T('account.title')}</h1>
    ${error ? `<div class="flash flash-error" role="alert">${h(error)}</div>` : ''}
    <div class="panel">
      <h2 class="panel-title">${T('account.personal')}</h2>
      <form method="post" action="/account" class="form">
        <label>${T('auth.name')}<input name="name" required maxlength="80" value="${h(user.name)}"></label>
        <label>${T('auth.email')}<input value="${h(user.email)}" disabled></label>
        <label>${T('auth.phone')}<input type="tel" name="phone" maxlength="30" value="${h(user.phone)}" placeholder="+380"></label>
        <label>${T('auth.level')}<select name="level">${levelOptions(lang, user.level)}</select></label>
        <button class="btn btn-dark" type="submit">${T('account.save')}</button>
      </form>
    </div>
    <div class="panel">
      <h2 class="panel-title">${T('account.passwordTitle')}</h2>
      <form method="post" action="/account/password" class="form">
        <label>${T('account.current')}<input type="password" name="current" required autocomplete="current-password"></label>
        <label>${T('account.new')}<input type="password" name="password" required minlength="8" autocomplete="new-password"></label>
        <button class="btn btn-dark" type="submit">${T('account.update')}</button>
      </form>
    </div>
  </div>
</section>`;
  return layout(ctx, { title: T('account.title'), body, bodyClass: 'page-app', noindex: true });
}

// ---------- Оферта й політика конфіденційності ----------

function legalPage(ctx, { html, title }) {
  const note = t(ctx.lang, 'legal.enNote');
  const body = `
<section class="dash">
  <div class="container container-narrow">
    ${note ? `<div class="flash flash-info" lang="en">${note}</div>` : ''}
    <article class="legal" lang="${ctx.lang}">${html}</article>
  </div>
</section>`;
  return layout(ctx, { title, body, bodyClass: 'page-app' });
}

function adminOnly(ctx) {
  const T = (key, vars) => t(ctx.lang, key, vars);
  const body = `
<section class="auth">
  <div class="auth-card center">
    <p class="eyebrow">${T('admin.eyebrow')}</p>
    <h1>${T('adminOnly.title')}</h1>
    <p class="muted">${h(T('adminOnly.text', { email: ctx.user.email }))}</p>
    <form method="post" action="/logout"><input type="hidden" name="next" value="/login?next=%2Fadmin"><button class="btn btn-dark btn-block" type="submit">${T('adminOnly.relogin')}</button></form>
    <p class="auth-switch"><a href="/">${T('notfound.home')}</a></p>
  </div>
</section>`;
  return layout(ctx, { title: T('adminOnly.title'), body, bodyClass: 'page-auth', noindex: true });
}

function notFound(ctx) {
  const T = (key) => t(ctx.lang, key);
  const body = `
<section class="auth">
  <div class="auth-card center">
    <p class="eyebrow">404</p>
    <h1>${T('notfound.title')}</h1>
    <p class="muted">${T('notfound.text')}</p>
    <a class="btn btn-dark" href="/">${T('notfound.home')}</a>
  </div>
</section>`;
  return layout(ctx, { title: T('notfound.title'), body, bodyClass: 'page-auth', noindex: true });
}

// ---------- Адмін-панель ----------

const ADMIN_SECTIONS = ['overview', 'requests', 'students', 'schedule', 'orders', 'teachers', 'reviews', 'settings'];

function adminLayout(ctx, active, { title, content, counts = {}, notice, error }) {
  const T = (key, vars) => t(ctx.lang, key, vars);
  const body = `
<section class="dash admin">
  <div class="container">
    <p class="eyebrow">${T('admin.eyebrow')}</p>
    <h1>${h(title)}</h1>
    <nav class="admin-nav">
      ${ADMIN_SECTIONS.map((s) => `<a href="/admin${s === 'overview' ? '' : `/${s}`}"${s === active ? ' aria-current="page"' : ''}>${T(`admin.nav.${s}`)}${counts[s] ? ` <span class="count">${counts[s]}</span>` : ''}</a>`).join('')}
    </nav>
    ${content}
  </div>
</section>`;
  return layout(ctx, { title, body, bodyClass: 'page-app', noindex: true, notice, error });
}

const del = (action, lang) => `<form method="post" action="${action}" data-confirm="${h(t(lang, 'admin.confirmDelete'))}" data-confirm-danger><button class="btn btn-small btn-ghost">${t(lang, 'admin.delete')}</button></form>`;

const tel = (phone) => (phone ? `<a href="tel:${h(phone.replace(/[^+\d]/g, ''))}">${h(phone)}</a>` : '—');

// Контакт із заявки: телефон → дзвінок, @нік → Telegram, email → лист.
function contactCell(value) {
  const v = String(value || '').trim();
  if (/^@?[a-z0-9_]{5,32}$/i.test(v) && /[a-z]/i.test(v)) return `<a href="https://t.me/${h(v.replace(/^@/, ''))}" target="_blank" rel="noopener">${h(v)}</a>`;
  if (/@/.test(v) && /\./.test(v)) return `<a href="mailto:${h(v)}">${h(v)}</a>`;
  if (/^[+\d][\d\s()-]{6,}$/.test(v)) return tel(v);
  return h(v);
}

function requestsTable(requests, lang) {
  const T = (key) => t(lang, key);
  if (!requests.length) return `<p class="muted">${T('admin.none')}</p>`;
  return `
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>${T('admin.col.name')}</th><th>${T('admin.col.contact')}</th><th>${T('admin.col.message')}</th><th>${T('admin.col.source')}</th><th>${T('admin.col.date')}</th><th>${T('admin.col.status')}</th><th></th></tr></thead>
        <tbody>
          ${requests.map((r) => `
          <tr class="${r.status === 'new' ? 'row-new' : ''}">
            <td><b>${h(r.name)}</b></td>
            <td>${contactCell(r.contact)}</td>
            <td>${h(r.message || '—')}</td>
            <td class="muted small">${h(r.source || '—')}</td>
            <td class="nowrap">${dateTime(r.created_at, lang)}</td>
            <td><span class="pill ${r.status === 'new' ? 'pill-pending' : 'pill-paid'}">${T(`admin.status.${r.status === 'new' ? 'new' : 'done'}`)}</span></td>
            <td class="actions">
              <form method="post" action="/admin/requests/${r.id}/${r.status === 'new' ? 'done' : 'new'}"><button class="btn btn-small ${r.status === 'new' ? 'btn-dark' : 'btn-ghost'}">${T(r.status === 'new' ? 'admin.markDone' : 'admin.markNew')}</button></form>
              ${del(`/admin/requests/${r.id}/delete`, lang)}
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function ordersTable(orders, lang) {
  const T = (key) => t(lang, key);
  if (!orders.length) return `<p class="muted">${T('admin.none')}</p>`;
  return `
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>№</th><th>${T('admin.col.student')}</th><th>${T('admin.col.phone')}</th><th>${T('admin.col.product')}</th><th>${T('admin.col.amount')}</th><th>${T('admin.col.date')}</th><th>${T('admin.col.status')}</th><th></th></tr></thead>
        <tbody>
          ${orders.map((o) => `
          <tr class="${o.status === 'pending' ? 'row-new' : ''}">
            <td>${o.id}</td>
            <td>${h(o.user_name)}<br><span class="muted small">${h(o.user_email)}</span></td>
            <td class="nowrap">${tel(o.user_phone)}${o.contact ? `<br><span class="small">${h(o.contact)}</span>` : ''}</td>
            <td>${h(productName(o.product, lang))}<br><span class="muted small">${h(lessonsLabel(o.lessons, lang))}</span></td>
            <td class="nowrap"><b>${money(o.amount, lang)}</b></td>
            <td class="nowrap">${dateTime(o.created_at, lang)}</td>
            <td><span class="pill pill-${h(o.status)}">${h(paymentStatus(o.status, lang))}</span></td>
            <td class="actions">${o.status === 'pending' ? `
              <form method="post" action="/admin/orders/${o.id}/confirm"><button class="btn btn-small btn-dark">${T('admin.confirm')}</button></form>
              <form method="post" action="/admin/orders/${o.id}/cancel"><button class="btn btn-small btn-ghost">${T('admin.cancel')}</button></form>` : ''}
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function adminOverview(ctx, { checklist, stats, requests, orders, counts, storageWarning }) {
  const { lang } = ctx;
  const T = (key, vars) => t(lang, key, vars);
  const done = checklist.every((c) => c.ok);
  const content = `
    ${storageWarning ? `<div class="flash flash-error" role="alert">${T('admin.storageWarning')}</div>` : ''}
    <div class="admin-stats">
      <a class="panel" href="/admin/requests"><span class="panel-label">${T('admin.stats.newRequests')}</span><b>${stats.newRequests}</b></a>
      <a class="panel" href="/admin/students"><span class="panel-label">${T('admin.stats.students')}</span><b>${stats.students}</b></a>
      <a class="panel" href="/admin/orders"><span class="panel-label">${T('admin.stats.pending')}</span><b>${stats.pending}</b></a>
      <a class="panel" href="/admin/orders"><span class="panel-label">${T('admin.stats.revenue')}</span><b>${money(stats.revenue, lang)}</b></a>
    </div>

    <div class="panel checklist">
      <h2 class="panel-title">${T('admin.checklist')}</h2>
      ${done ? `<p class="checklist-done">${icon.check} ${T('admin.checklistDone')}</p>` : ''}
      <ul>
        ${checklist.map((c) => `
          <li class="${c.ok ? 'ok' : 'todo'}">
            <span class="check-icon">${c.ok ? icon.check : icon.cross}</span>
            <span>${T(`admin.check.${c.key}`)}</span>
            ${c.ok || !c.href ? '' : `<a href="${c.href}">${T('admin.check.fix')}</a>`}
          </li>`).join('')}
      </ul>
    </div>

    <div class="admin-block-head"><h2 class="dash-title">${T('admin.latestRequests')}</h2><a href="/admin/requests">${T('admin.all')}</a></div>
    ${requestsTable(requests, lang)}

    <div class="admin-block-head"><h2 class="dash-title">${T('admin.pendingOrders')}</h2><a href="/admin/orders">${T('admin.all')}</a></div>
    ${ordersTable(orders, lang)}`;
  return adminLayout(ctx, 'overview', { title: T('admin.title'), content, counts });
}

function adminRequests(ctx, { requests, counts }) {
  const T = (key) => t(ctx.lang, key);
  const content = `<p class="admin-hint">${T('admin.requests.hint')}</p>${requestsTable(requests, ctx.lang)}`;
  return adminLayout(ctx, 'requests', { title: T('admin.requests.title'), content, counts });
}

function adminOrders(ctx, { orders, counts }) {
  const T = (key) => t(ctx.lang, key);
  const content = `<p class="admin-hint">${T('admin.orders.hint')}</p>${ordersTable(orders, ctx.lang)}`;
  return adminLayout(ctx, 'orders', { title: T('admin.orders.title'), content, counts });
}

function adminStudents(ctx, { users, teachers, counts, notice }) {
  const { lang } = ctx;
  const T = (key) => t(lang, key);
  const content = `
    <p class="admin-hint">${T('admin.students.hint')}</p>
    <p class="admin-hint">${T('admin.students.teachersHint')}</p>
    ${users.length ? `
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>${T('admin.col.name')}</th><th>${T('admin.col.phone')}</th><th>${T('admin.col.level')}</th><th>${T('admin.col.teacher')}</th><th>${T('admin.col.left')}</th><th>${T('admin.col.held')}</th><th>${T('admin.col.paid')}</th><th>${T('admin.col.source')}</th><th>${T('admin.col.date')}</th><th></th></tr></thead>
        <tbody>
          ${users.map((u) => {
            const left = Math.max(u.lessons_bought - u.lessons_held, 0);
            return `
          <tr>
            <td><b>${h(u.name)}</b>${u.is_admin ? ` <span class="pill pill-paid">${T('admin.adminTag')}</span>` : ''}${u.is_teacher ? ` <span class="pill pill-teacher">${T('admin.teacherTag')}</span>` : ''}<br><span class="muted small">${h(u.email)}</span></td>
            <td class="nowrap">${tel(u.phone)}</td>
            <td>${h(LEVEL_CODES.includes(u.level) && u.level !== 'unknown' ? u.level : '—')}</td>
            <td>${u.is_admin || u.is_teacher ? '—' : `
              <form method="post" action="/admin/users/${u.id}/teacher" class="assign-form">
                <select name="teacher_id" aria-label="${h(T('admin.col.teacher'))}">
                  <option value="">${h(T('admin.noTeacher'))}</option>
                  ${teachers.map((tch) => `<option value="${tch.id}"${tch.id === u.teacher_id ? ' selected' : ''}>${h(tch.name)}</option>`).join('')}
                </select>
                <button class="btn btn-small btn-ghost">${T('admin.assign')}</button>
              </form>
`}
            </td>
            <td><b class="big-num">${left}</b></td>
            <td>${u.lessons_held}</td>
            <td class="nowrap">${money(u.paid_total, lang)}</td>
            <td class="muted small">${h(u.source || '—')}</td>
            <td class="nowrap">${date(u.created_at, lang)}</td>
            <td class="actions">
              ${left > 0 ? `<form method="post" action="/admin/users/${u.id}/held"><button class="btn btn-small btn-dark">${T('admin.markHeld')}</button></form>` : ''}
              ${u.lessons_held > 0 ? `<form method="post" action="/admin/users/${u.id}/undo"><button class="btn btn-small btn-ghost" title="${h(T('admin.undo'))}" aria-label="${h(T('admin.undo'))}">↶</button></form>` : ''}
              ${u.is_admin ? '' : `<form method="post" action="/admin/users/${u.id}/role"><input type="hidden" name="teacher" value="${u.is_teacher ? '0' : '1'}"><button class="btn btn-small btn-ghost">${T(u.is_teacher ? 'admin.unmakeTeacher' : 'admin.makeTeacher')}</button></form>`}
              ${u.is_admin ? '' : `<form method="post" action="/admin/users/${u.id}/reset" data-confirm="${h(T('admin.confirmReset'))}"><button class="btn btn-small btn-ghost">${T('admin.resetPassword')}</button></form>`}
            </td>
          </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>` : `<p class="muted">${T('admin.none')}</p>`}`;
  return adminLayout(ctx, 'students', { title: T('admin.students.title'), content, counts, notice });
}

function teacherFields(lang, teacher = {}, accounts = []) {
  const T = (key) => t(lang, key);
  return `
    <label>${T('admin.teachers.account')} <span class="optional">— ${T('admin.teachers.accountHint')}</span>
      <select name="user_id">
        <option value="">${h(T('admin.teachers.noAccount'))}</option>
        ${accounts.map((a) => `<option value="${a.id}"${a.id === teacher.user_id ? ' selected' : ''}>${h(a.name)} · ${h(a.email)}</option>`).join('')}
      </select>
    </label>
    <label>${T('admin.teachers.name')}<input name="name" required maxlength="80" value="${h(teacher.name)}"></label>
    <label>${T('admin.teachers.role')} <span class="optional">${T('form.optional')}</span><input name="role" maxlength="120" value="${h(teacher.role)}" placeholder="${h(T('admin.teachers.roleHint'))}"></label>
    <label>${T('admin.teachers.about')} <span class="optional">${T('form.optional')}</span><textarea name="about" rows="2" maxlength="400" placeholder="${h(T('admin.teachers.aboutHint'))}">${h(teacher.about)}</textarea></label>
    <label>${T('admin.teachers.photo')} <span class="optional">— ${T('admin.teachers.photoHint')}</span><input type="file" name="photo" accept="image/jpeg,image/png,image/webp"></label>`;
}

function adminTeachers(ctx, { teachers, accounts = [], counts, error }) {
  const { lang } = ctx;
  const T = (key) => t(lang, key);
  const content = `
    <p class="admin-hint">${T('admin.teachers.hint')}</p>
    <div class="admin-cards">
      ${teachers.map((teacher) => `
        <div class="panel admin-card">
          <div class="admin-card-head">
            ${teacher.photo ? `<img class="avatar avatar-photo avatar-sm" src="${h(teacher.photo)}" alt="">` : `<div class="avatar avatar-sm">${h(teacher.name[0])}</div>`}
            <b>${h(teacher.name)}</b>
          </div>
          <form method="post" action="/admin/teachers/${teacher.id}" enctype="multipart/form-data" class="form">
            ${teacherFields(lang, teacher, accounts)}
            <div class="form-actions"><button class="btn btn-small btn-dark">${T('admin.teachers.save')}</button></div>
          </form>
          ${del(`/admin/teachers/${teacher.id}/delete`, lang)}
        </div>`).join('')}
      <div class="panel admin-card admin-card-new">
        <h2 class="panel-title">${T('admin.teachers.add')}</h2>
        <form method="post" action="/admin/teachers" enctype="multipart/form-data" class="form">
          ${teacherFields(lang, {}, accounts)}
          <button class="btn btn-dark">${T('admin.teachers.add')}</button>
        </form>
      </div>
    </div>`;
  return adminLayout(ctx, 'teachers', { title: T('admin.teachers.title'), content, counts, error });
}

function adminReviews(ctx, { reviews, counts }) {
  const { lang } = ctx;
  const T = (key) => t(lang, key);
  const content = `
    <p class="admin-hint">${T('admin.reviews.hint')}</p>
    <div class="admin-cards">
      ${reviews.map((r) => `
        <div class="panel admin-card">
          <blockquote class="review-text">${h(r.text)}</blockquote>
          <p><b>— ${h(r.name)}</b></p>
          ${del(`/admin/reviews/${r.id}/delete`, lang)}
        </div>`).join('')}
      <div class="panel admin-card admin-card-new">
        <h2 class="panel-title">${T('admin.reviews.add')}</h2>
        <form method="post" action="/admin/reviews" class="form">
          <label>${T('admin.reviews.name')}<input name="name" required maxlength="80" placeholder="${h(T('admin.reviews.nameHint'))}"></label>
          <label>${T('admin.reviews.text')}<textarea name="text" required rows="4" maxlength="800"></textarea></label>
          <button class="btn btn-dark">${T('admin.reviews.add')}</button>
        </form>
      </div>
    </div>`;
  return adminLayout(ctx, 'reviews', { title: T('admin.reviews.title'), content, counts });
}

function adminSettings(ctx, { values, counts, notice, error }) {
  const { lang } = ctx;
  const T = (key, vars) => t(lang, key, vars);
  const { single, monthly } = config.products;
  const tg = config.telegramBot;
  const field = (key, { type = 'text', hint, placeholder, textarea } = {}) => `
    <label>${T(`admin.settings.${key}`)}${hint ? ` <span class="optional">— ${h(T(hint))}</span>` : ''}
      ${textarea
        ? `<textarea name="${key}" rows="3" maxlength="600" placeholder="${h(placeholder || '')}">${h(values[key])}</textarea>`
        : `<input type="${type}" name="${key}" value="${h(values[key])}" maxlength="600" placeholder="${h(placeholder || '')}" autocomplete="off" spellcheck="false" data-1p-ignore data-lpignore="true"${type === 'number' ? ' min="0" step="1"' : ''}>`}
    </label>`;
  const content = `
    <p class="admin-hint">${T('admin.settings.hint')}</p>
    <form method="post" action="/admin/settings" class="settings">
      <div class="panel">
        <h2 class="panel-title">${T('admin.settings.contacts')}</h2>
        <div class="form form-2">
          ${field('phone', { type: 'tel', placeholder: '+380 67 000 00 00' })}
          ${field('email', { type: 'email', placeholder: 'hello@inkwell.academy' })}
          ${field('telegram', { hint: 'admin.settings.telegramHint', placeholder: '@inkwell_academy' })}
          ${field('instagram', { hint: 'admin.settings.instagramHint', placeholder: '@inkwell.academy' })}
        </div>
      </div>

      <div class="panel">
        <h2 class="panel-title">${T('admin.settings.prices')}</h2>
        <div class="form form-3">
          ${field('lessonPrice', { type: 'number' })}
          ${field('packageLessons', { type: 'number' })}
          ${field('packagePrice', { type: 'number' })}
        </div>
        <p class="muted small">${T('admin.settings.pricePreview', { single: money(single.price, lang), pkg: money(monthly.price, lang), full: money(monthly.fullPrice, lang), each: money(monthly.each, lang), n: monthly.lessons })}</p>
      </div>

      <div class="panel">
        <h2 class="panel-title">${T('admin.settings.payment')}</h2>
        <p class="muted small">${T('admin.settings.paymentHint')}</p>
        <div class="form">
          ${field('paymentUrl', { type: 'url', hint: 'admin.settings.paymentUrlHint', placeholder: 'https://secure.wayforpay.com/…' })}
          ${field('paymentDetails', { textarea: true, placeholder: T('admin.settings.paymentDetailsHint') })}
        </div>
      </div>

      <div class="panel">
        <h2 class="panel-title">${T('admin.settings.legal')}</h2>
        <div class="form">
          ${field('legalSeller', { placeholder: 'ФОП Петренко Олена Іванівна' })}
          <div class="form-2">
            ${field('legalTaxId', { placeholder: '0000000000' })}
            ${field('legalAddress')}
          </div>
        </div>
      </div>

      <div class="panel">
        <h2 class="panel-title">${T('admin.settings.ads')}</h2>
        <div class="form">
          ${field('siteUrl', { type: 'url', hint: 'admin.settings.siteUrlHint', placeholder: 'https://inkwell.academy' })}
          <div class="form-2">
            ${field('metaPixelId', { hint: 'admin.settings.metaPixelIdHint', placeholder: '123456789012345' })}
            ${field('gaId', { hint: 'admin.settings.gaIdHint', placeholder: 'G-XXXXXXXXXX' })}
          </div>
        </div>
      </div>

      <div class="panel">
        <h2 class="panel-title">${T('admin.settings.notifications')}</h2>
        ${tg.token && tg.chatId
          ? `<p class="checklist-done">${icon.check} ${h(T('admin.settings.tgConnected', { chat: tg.chatId }))}</p>`
          : `<p class="muted small">${T('admin.settings.tgSteps')}</p>`}
        <div class="form">
          ${field('tgBotToken', { placeholder: '123456789:AA…' })}
        </div>
        <div class="tg-actions">
          <button class="btn btn-dark" type="submit" formaction="/admin/telegram/connect">${T('admin.settings.tgConnect')}</button>
          ${tg.token && tg.chatId ? `<button class="btn btn-ghost" type="submit" formaction="/admin/telegram/test">${T('admin.settings.tgTest')}</button>` : ''}
        </div>
      </div>

      <div class="panel">
        <h2 class="panel-title">${T('admin.settings.sms')}</h2>
        <p class="muted small">${config.sms.enabled ? `${icon.check} ${T('admin.settings.smsOn')}` : T('admin.settings.smsSteps')}</p>
        <div class="form form-2">
          ${field('smsToken', { placeholder: 'токен з кабінету TurboSMS' })}
          ${field('smsSender', { hint: 'admin.settings.smsSenderHint', placeholder: 'Inkwell' })}
        </div>
      </div>

      <div class="settings-actions">
        <button class="btn btn-dark" type="submit">${T('admin.settings.save')}</button>
      </div>
    </form>`;
  return adminLayout(ctx, 'settings', { title: T('admin.settings.title'), content, counts, notice, error });
}

// ---------- Кабінет викладача ----------

function studentsList(students, lang) {
  const T = (key, vars) => t(lang, key, vars);
  return `
    <div class="student-list">
      ${students.map((s) => `
        <div class="panel student-row">
          <div class="student-main">
            <b>${h(s.name)}</b>
            <span class="muted small">${[s.phone, s.email].filter(Boolean).map(h).join(' · ')}</span>
          </div>
          <div class="student-stat"><span class="muted small">${T('teacher.lessonsLeft')}</span><b>${Math.max(s.lessons_left, 0)}</b></div>
          <div class="student-actions">
            ${s.phone ? `<a class="btn btn-small btn-ghost" href="tel:${h(s.phone.replace(/[^+\d]/g, ''))}">${icon.phone} ${h(s.phone)}</a>` : ''}
            ${s.lessons_left > 0 ? `<form method="post" action="/teacher/students/${s.id}/held"><button class="btn btn-small btn-dark">${T('teacher.markHeld')}</button></form>` : ''}
          </div>
        </div>`).join('')}
    </div>`;
}

// Сторінка «Вільний час» викладача.
function schedulePage(ctx, { teacher, hasSchedule, freeSlots, student, canBook, trial, isMine }) {
  const { lang, user } = ctx;
  const T = (key, vars) => t(lang, key, vars);
  const { single, monthly } = config.products;
  const next = encodeURIComponent(`/schedule/${teacher.id}`);
  let note = '';
  if (!user) {
    note = `
      <div class="booking-note">
        <p><b>${T('trial.noteTitle', { min: config.trialMinutes })}</b></p>
        <p class="small">${T('trial.about', { min: config.trialMinutes })}</p>
        <p>${T('schedule.loginFirst')}</p>
        <div class="hero-actions"><a class="btn btn-dark btn-small" href="/register?next=${next}">${T('trial.register')}</a><a class="btn btn-ghost btn-small" href="/login?next=${next}">${T('auth.toLogin')}</a></div>
      </div>`;
  } else if (student && canBook <= 0 && trial) {
    note = `${trialNote(lang)}${isMine ? '' : `<p class="small">${h(T('schedule.willChoose', { name: teacher.name }))}</p>`}`;
  } else if (student && canBook <= 0) {
    note = `
      <div class="booking-note">
        <p>${T('schedule.payFirst')}</p>
        <div class="hero-actions">
          <a class="btn btn-ghost btn-small" href="/pay/single">${T('product.single')} · ${money(single.price, lang)}</a>
          <a class="btn btn-dark btn-small" href="/pay/monthly">${T('product.monthly')} · ${money(monthly.price, lang)}</a>
        </div>
      </div>`;
  } else if (student) {
    note = `<p class="small"><b>${T('book.left', { n: canBook })}</b>${isMine ? '' : ` · ${h(T('schedule.willChoose', { name: teacher.name }))}`}</p>`;
  }
  const bookable = student && (canBook > 0 || trial);
  const body = `
<section class="dash">
  <div class="container container-narrow">
    <a class="back-link" href="${user && !user.is_teacher && !user.is_admin ? '/dashboard' : '/#teachers'}">${icon.back} ${T(user ? 'account.back' : 'thanks.home')}</a>
    <div class="panel teacher-card">
      ${teacher.photo ? `<img class="avatar avatar-photo" src="${h(teacher.photo)}" alt="${h(teacher.name)}">` : `<div class="avatar">${h(teacher.name[0])}</div>`}
      <div>
        <span class="panel-label">${T('schedule.eyebrow')}</span>
        <h1 class="teacher-card-name">${h(teacher.name)}</h1>
        ${teacher.role ? `<span class="teacher-role">${h(teacher.role)}</span>` : ''}
        ${teacher.about ? `<span class="muted small">${h(teacher.about)}</span>` : ''}
      </div>
    </div>
    <div class="panel booking">
      <h2 class="panel-title">${student && canBook <= 0 && trial ? `🎁 ${T('trial.scheduleTitle')}` : T('schedule.title')}</h2>
      <p class="muted small">${T('book.lead')}</p>
      ${note}
      ${!hasSchedule ? `<p class="booking-note">${T('schedule.empty')}</p>` : `
        ${!hasFree(freeSlots) ? `<p class="booking-note">${T('book.noFree')}</p>` : ''}
        ${freeSlots.length ? slotGrid(freeSlots, lang, { bookable, teacherId: teacher.id, trial: student && canBook <= 0 && trial, max: canBook }) : ''}`}
    </div>
  </div>
</section>`;
  return layout(ctx, { title: `${T('schedule.title')} — ${teacher.name}`, body, bodyClass: 'page-app' });
}

function bookingsTable(list, lang, { showTeacher }) {
  const T = (key) => t(lang, key);
  return `
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>${T('admin.col.when')}</th><th>${T('admin.col.student')}</th><th>${T('admin.col.phone')}</th>${showTeacher ? `<th>${T('admin.col.teacher')}</th>` : ''}<th></th></tr></thead>
        <tbody>
          ${list.map((b) => `
          <tr>
            <td class="nowrap"><b>${h(capital(dayLabel(b.date, lang)))}</b> · ${h(b.time)}${b.kind === 'trial' ? `<br><span class="tag tag-accent">${t(lang, 'trial.badge', { min: config.trialMinutes })}</span>` : ''}</td>
            <td>${h(b.student_name)}<br><span class="muted small">${h(b.student_email)}</span></td>
            <td class="nowrap">${tel(b.student_phone)}</td>
            ${showTeacher ? `<td>${h(b.teacher_name)}</td>` : ''}
            <td class="actions"><form method="post" action="/bookings/${b.id}/cancel" data-confirm="${h(T('book.confirmCancel'))}" data-confirm-danger><button class="btn btn-small btn-ghost">${T('book.cancel')}</button></form></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function scheduleEditor(availability, hours, lang) {
  const T = (key) => t(lang, key);
  return `
    <form method="post" action="/teacher/schedule" class="schedule">
      ${[1, 2, 3, 4, 5, 6, 7].map((day) => `
        <div class="schedule-day">
          <span class="schedule-name">${h(capital(weekdayName(day, lang)))}</span>
          <div class="slot-times">
            ${hours.map((time) => `<label class="slot slot-check"><input type="checkbox" name="d${day}" value="${time}"${(availability[day] || []).includes(time) ? ' checked' : ''}><span>${time}</span></label>`).join('')}
          </div>
        </div>`).join('')}
      <div class="settings-actions"><button class="btn btn-dark" type="submit">${T('teacher.saveSchedule')}</button></div>
    </form>`;
}

// Окремий блок «Пробні уроки» — щоб нових учнів було видно одразу.
function trialsBlock(upcoming, lang, { showTeacher }) {
  const trials = upcoming.filter((b) => b.kind === 'trial');
  return `
    <h2 class="dash-title">🎁 ${t(lang, 'trial.listTitle', { n: trials.length })}</h2>
    ${trials.length ? bookingsTable(trials, lang, { showTeacher }) : `<p class="muted">${t(lang, 'trial.listEmpty')}</p>`}`;
}

function teacherHome(ctx, { students, upcoming = [], availability = {}, hours = [] }) {
  const { lang } = ctx;
  const T = (key) => t(lang, key);
  const body = `
<section class="dash">
  <div class="container">
    <div class="dash-head">
      <div>
        <p class="eyebrow">${T('teacher.eyebrow')}</p>
        <h1>${T('teacher.title')}</h1>
      </div>
      <form method="post" action="/logout"><button class="btn btn-ghost btn-small" type="submit">${T('dash.logout')}</button></form>
    </div>

    ${trialsBlock(upcoming, lang, { showTeacher: false })}
    <h2 class="dash-title">${T('teacher.upcoming')}</h2>
    ${upcoming.some((b) => b.kind !== 'trial') ? bookingsTable(upcoming.filter((b) => b.kind !== 'trial'), lang, { showTeacher: false }) : `<p class="muted">${T('teacher.noUpcoming')}</p>`}

    <h2 class="dash-title">${T('teacher.students')}</h2>
    <p class="admin-hint">${T('teacher.hint')}</p>
    ${students.length ? studentsList(students, lang) : `<div class="panel"><p class="muted">${T('teacher.none')}</p></div>`}

    <h2 class="dash-title" id="schedule">${T('teacher.schedule')}</h2>
    <p class="admin-hint">${T('teacher.scheduleHint')}</p>
    ${scheduleEditor(availability, hours, lang)}
  </div>
</section>`;
  return layout(ctx, { title: T('teacher.title'), body, bodyClass: 'page-app', noindex: true });
}

function adminSchedule(ctx, { upcoming, teachers, counts }) {
  const { lang } = ctx;
  const T = (key) => t(lang, key);
  const content = `
    <p class="admin-hint">${T('admin.schedule.hint')}</p>
    ${trialsBlock(upcoming, lang, { showTeacher: true })}
    <h2 class="dash-title">${T('teacher.upcoming')}</h2>
    ${upcoming.some((b) => b.kind !== 'trial') ? bookingsTable(upcoming.filter((b) => b.kind !== 'trial'), lang, { showTeacher: true }) : `<p class="muted">${T('admin.none')}</p>`}
    <h2 class="dash-title">${T('admin.schedule.teachers')}</h2>
    ${teachers.length ? `
    <div class="table-wrap">
      <table class="table">
        <tbody>
          ${teachers.map((tch) => {
            const days = Object.keys(tch.availability).map(Number).sort((a, b) => a - b);
            return `
          <tr>
            <td><b>${h(tch.name)}</b><br><span class="muted small">${h(tch.email)}</span></td>
            <td>${days.length ? days.map((d) => `<b>${h(weekdayName(d, lang, 'short'))}</b> ${h(tch.availability[d].join(', '))}`).join('<br>') : `<span class="muted">${T('admin.schedule.empty')}</span>`}</td>
          </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>` : `<p class="muted">${T('admin.none')}</p>`}`;
  return adminLayout(ctx, 'schedule', { title: T('admin.schedule.title'), content, counts });
}

module.exports = {
  home, thanks, authPage, forgot, dashboard, checkout, account, legalPage, notFound, adminOnly,
  adminOverview, adminRequests, adminOrders, adminStudents, adminTeachers, adminReviews, adminSettings,
  teacherHome, adminSchedule, schedulePage, payContact, verifyPhone,
  LEVEL_CODES, productName,
};
