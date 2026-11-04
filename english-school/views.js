const config = require('./config');
const { t } = require('./i18n');

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
  password_changed: 'success', paid: 'success', payment_pending: 'success', too_many: 'error',
  'admin.saved': 'success', 'admin.deleted': 'info', 'admin.held': 'success', 'admin.undone': 'info',
  'admin.confirmed': 'success', 'admin.cancelled': 'info', 'admin.settings.tgTestSent': 'success',
};

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
  const flashText = flashType && (msg.startsWith('admin.') ? T(msg) : T(`msg.${msg}`));
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
<meta name="theme-color" content="#1e2b45">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css?v=5">
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
           <a class="btn btn-small btn-dark" href="/dashboard">${icon.user} ${T('nav.cabinet')}</a>`
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
<script src="/app.js?v=5" defer></script>
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
    price, n: monthly.lessons, pkg: money(monthly.price, lang), full: money(monthly.fullPrice, lang), discount: monthly.discount,
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
        <li>${icon.check} ${T('hero.point2', { discount: monthly.discount })}</li>
        <li>${icon.check} ${T('hero.point3')}</li>
      </ul>
    </div>
    <div class="hero-card" aria-hidden="true">
      <div class="hc-top">
        <span class="hc-badge">${T('hero.card.badge')}</span>
        <span class="hc-time">${icon.clock} 60 ${T('unit.min')}</span>
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
    <div><b>60</b><span>${T('stats.minutes')}</span></div>
    <div><b>${price}</b><span>${T('stats.price')}</span></div>
    <div><b>−${monthly.discount}%</b><span>${T('stats.discount')}</span></div>
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
        <p class="price">${money(0, lang)}<small> ${T('pricing.trial.per', { min: config.consultationMinutes })}</small></p>
        <ul>
          <li>${icon.check} ${T('pricing.trial.f1')}</li>
          <li>${icon.check} ${T('pricing.trial.f2')}</li>
          <li>${icon.check} ${T('pricing.trial.f3')}</li>
        </ul>
        <a class="btn btn-ghost" href="#trial">${T('pricing.trial.cta')}</a>
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
        ${monthly.discount ? `<span class="price-badge">${T('pricing.monthly.badge', { discount: monthly.discount })}</span>` : ''}
        <h3>${T('pricing.monthly.title')}</h3>
        ${monthly.discount ? `<p class="price-old">${money(monthly.fullPrice, lang)}</p>` : ''}
        <p class="price">${money(monthly.price, lang)}<small> ${T('pricing.monthly.per', { n: monthly.lessons })}</small></p>
        <ul>
          <li>${icon.check} ${T('pricing.monthly.f1', { n: monthly.lessons })}</li>
          <li>${icon.check} ${T('pricing.monthly.f2', { each: money(monthly.price / monthly.lessons, lang), single: price })}</li>
          ${monthly.discount ? `<li>${icon.check} ${T('pricing.monthly.f3', { save: money(monthly.fullPrice - monthly.price, lang) })}</li>` : ''}
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

function dashboard(ctx, { balance, orders }) {
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
          <a class="btn btn-small btn-ghost" href="/pay/${h(pending[0].product)}">${T('dash.payPending')}</a>` : ''}
      </div>

      <div class="panel buy-panel">
        <span class="panel-label">${T('dash.buy')}</span>
        <div class="buy-option">
          <div>
            <b>${T('product.single')}</b>
            <span>${lessonsLabel(1, lang)} · 60 ${T('unit.min')}</span>
          </div>
          <div class="buy-price"><b>${money(single.price, lang)}</b></div>
          <a class="btn btn-small btn-ghost" href="/pay/single">${T('btn.pay')}</a>
        </div>
        <div class="buy-option buy-option-accent">
          <div>
            <b>${T('product.monthly')} ${monthly.discount ? `<span class="tag tag-accent">−${monthly.discount}%</span>` : ''}</b>
            <span>${T('pricing.monthly.f1', { n: monthly.lessons })}</span>
          </div>
          <div class="buy-price">${monthly.discount ? `<s>${money(monthly.fullPrice, lang)}</s>` : ''}<b>${money(monthly.price, lang)}</b></div>
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
        <thead><tr><th>${T('table.product')}</th><th>${T('table.amount')}</th><th>${T('table.date')}</th><th>${T('table.status')}</th></tr></thead>
        <tbody>
          ${orders.map((o) => `
          <tr>
            <td>${h(productName(o.product, lang))}<br><span class="muted small">№ ${o.id} · ${h(lessonsLabel(o.lessons, lang))}</span></td>
            <td>${money(o.amount, lang)}</td>
            <td>${date(o.created_at, lang)}</td>
            <td><span class="pill pill-${h(o.status)}">${h(paymentStatus(o.status, lang))}</span></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : ''}
  </div>
</section>`;
  return layout(ctx, { title: T('nav.cabinet'), body, bodyClass: 'page-app', events, noindex: true });
}

// ---------- Оплата ----------

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
    <div class="checkout-row"><span>${T('checkout.lessons')}</span><b>${h(lessonsLabel(order.lessons, lang))} · 60 ${T('unit.min')}</b></div>
    ${product.discount && product.id === 'monthly' ? `<div class="checkout-row"><span>${T('checkout.discount')}</span><b>−${product.discount}% (<s>${money(product.fullPrice, lang)}</s>)</b></div>` : ''}
    <div class="checkout-row checkout-total"><span>${T('checkout.total')}</span><b>${money(order.amount, lang)}</b></div>
    ${action}
    <p class="legal-note">${T('checkout.legal')}</p>
    <p class="auth-switch"><a href="/dashboard">${T('checkout.back')}</a></p>
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
    <article class="legal" lang="uk">${html}</article>
  </div>
</section>`;
  return layout(ctx, { title, body, bodyClass: 'page-app' });
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

const ADMIN_SECTIONS = ['overview', 'requests', 'students', 'orders', 'teachers', 'reviews', 'settings'];

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

const del = (action, lang) => `<form method="post" action="${action}" data-confirm="${h(t(lang, 'admin.confirmDelete'))}"><button class="btn btn-small btn-ghost">${t(lang, 'admin.delete')}</button></form>`;

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
            <td class="nowrap">${tel(o.user_phone)}</td>
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

function adminStudents(ctx, { users, counts, notice }) {
  const { lang } = ctx;
  const T = (key) => t(lang, key);
  const content = `
    <p class="admin-hint">${T('admin.students.hint')}</p>
    ${users.length ? `
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>${T('admin.col.name')}</th><th>${T('admin.col.phone')}</th><th>${T('admin.col.level')}</th><th>${T('admin.col.left')}</th><th>${T('admin.col.held')}</th><th>${T('admin.col.paid')}</th><th>${T('admin.col.source')}</th><th>${T('admin.col.date')}</th><th></th></tr></thead>
        <tbody>
          ${users.map((u) => {
            const left = Math.max(u.lessons_bought - u.lessons_held, 0);
            return `
          <tr>
            <td><b>${h(u.name)}</b>${u.is_admin ? ` <span class="pill pill-paid">${T('admin.adminTag')}</span>` : ''}<br><span class="muted small">${h(u.email)}</span></td>
            <td class="nowrap">${tel(u.phone)}</td>
            <td>${h(LEVEL_CODES.includes(u.level) && u.level !== 'unknown' ? u.level : '—')}</td>
            <td><b class="big-num">${left}</b></td>
            <td>${u.lessons_held}</td>
            <td class="nowrap">${money(u.paid_total, lang)}</td>
            <td class="muted small">${h(u.source || '—')}</td>
            <td class="nowrap">${date(u.created_at, lang)}</td>
            <td class="actions">
              ${left > 0 ? `<form method="post" action="/admin/users/${u.id}/held"><button class="btn btn-small btn-dark">${T('admin.markHeld')}</button></form>` : ''}
              ${u.lessons_held > 0 ? `<form method="post" action="/admin/users/${u.id}/undo"><button class="btn btn-small btn-ghost" title="${h(T('admin.undo'))}" aria-label="${h(T('admin.undo'))}">↶</button></form>` : ''}
              ${u.is_admin ? '' : `<form method="post" action="/admin/users/${u.id}/reset" data-confirm="${h(T('admin.confirmReset'))}"><button class="btn btn-small btn-ghost">${T('admin.resetPassword')}</button></form>`}
            </td>
          </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>` : `<p class="muted">${T('admin.none')}</p>`}`;
  return adminLayout(ctx, 'students', { title: T('admin.students.title'), content, counts, notice });
}

function teacherFields(lang, teacher = {}) {
  const T = (key) => t(lang, key);
  return `
    <label>${T('admin.teachers.name')}<input name="name" required maxlength="80" value="${h(teacher.name)}"></label>
    <label>${T('admin.teachers.role')} <span class="optional">${T('form.optional')}</span><input name="role" maxlength="120" value="${h(teacher.role)}" placeholder="${h(T('admin.teachers.roleHint'))}"></label>
    <label>${T('admin.teachers.about')} <span class="optional">${T('form.optional')}</span><textarea name="about" rows="2" maxlength="400" placeholder="${h(T('admin.teachers.aboutHint'))}">${h(teacher.about)}</textarea></label>
    <label>${T('admin.teachers.photo')} <span class="optional">— ${T('admin.teachers.photoHint')}</span><input type="file" name="photo" accept="image/jpeg,image/png,image/webp"></label>`;
}

function adminTeachers(ctx, { teachers, counts, error }) {
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
            ${teacherFields(lang, teacher)}
            <div class="form-actions"><button class="btn btn-small btn-dark">${T('admin.teachers.save')}</button></div>
          </form>
          ${del(`/admin/teachers/${teacher.id}/delete`, lang)}
        </div>`).join('')}
      <div class="panel admin-card admin-card-new">
        <h2 class="panel-title">${T('admin.teachers.add')}</h2>
        <form method="post" action="/admin/teachers" enctype="multipart/form-data" class="form">
          ${teacherFields(lang)}
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
        : `<input type="${type}" name="${key}" value="${h(values[key])}" maxlength="600" placeholder="${h(placeholder || '')}"${type === 'number' ? ' min="0" step="1"' : ''}>`}
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
          ${field('packageDiscount', { type: 'number' })}
        </div>
        <p class="muted small">${T('admin.settings.pricePreview', { single: money(single.price, lang), pkg: money(monthly.price, lang), full: money(monthly.fullPrice, lang) })}</p>
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
          ${field('tgBotToken', { type: 'password', placeholder: '123456789:AA…' })}
        </div>
      </div>

      <div class="settings-actions">
        <button class="btn btn-dark" type="submit">${T('admin.settings.save')}</button>
      </div>
    </form>
    ${tg.token ? `
    <div class="tg-actions">
      <form method="post" action="/admin/telegram/connect"><button class="btn btn-ghost">${T('admin.settings.tgConnect')}</button></form>
      ${tg.chatId ? `<form method="post" action="/admin/telegram/test"><button class="btn btn-ghost">${T('admin.settings.tgTest')}</button></form>` : ''}
    </div>` : ''}`;
  return adminLayout(ctx, 'settings', { title: T('admin.settings.title'), content, counts, notice, error });
}

module.exports = {
  home, thanks, authPage, forgot, dashboard, checkout, account, legalPage, notFound,
  adminOverview, adminRequests, adminOrders, adminStudents, adminTeachers, adminReviews, adminSettings,
  LEVEL_CODES, productName,
};
