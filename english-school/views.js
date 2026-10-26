const config = require('./config');
const { t } = require('./i18n');

// ---------- Утиліти ----------

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const h = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

const LOCALES = { uk: 'uk-UA', en: 'en-GB' };
const money = (amount, lang) => `${Number(amount).toLocaleString(LOCALES[lang])} ${config.currency}`;

const date = (value, lang) =>
  value ? new Date(value.replace(' ', 'T') + 'Z').toLocaleDateString(LOCALES[lang], { day: 'numeric', month: 'long', year: 'numeric' }) : '';

// Назва школи й ім'я викладача можуть бути рядком або об'єктом { uk, en }.
const text = (value, lang) => (value && typeof value === 'object' ? value[lang] ?? value.uk : value);

const LEVEL_CODES = ['A1', 'A2', 'B1', 'B2', 'C1'];
const MESSAGE_TYPES = {
  registered: 'success', loggedout: 'info', login_required: 'info', request_sent: 'success',
  profile_saved: 'success', password_changed: 'success', paid: 'success', payment_pending: 'info',
  confirmed: 'success', cancelled: 'info', held: 'success', undone: 'info',
};

function levelOptions(lang, selected) {
  return LEVEL_CODES.map((k) => `<option value="${k}"${selected === k ? ' selected' : ''}>${h(t(lang, `level.${k}`))}</option>`).join('');
}

const icon = {
  check: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  lock: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  play: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
  clock: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  back: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
  globe: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/></svg>',
  user: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/></svg>',
};

// ---------- Каркас сторінки ----------

function langSwitch(lang) {
  return `
    <div class="lang-switch" role="group" aria-label="${h(t(lang, 'lang.switch'))}">
      ${icon.globe}
      <a href="/lang/uk" hreflang="uk" lang="uk"${lang === 'uk' ? ' aria-current="true"' : ''}>UA</a>
      <a href="/lang/en" hreflang="en" lang="en"${lang === 'en' ? ' aria-current="true"' : ''}>EN</a>
    </div>`;
}

function layout({ lang, title, user, body, msg, error, bodyClass = '' }) {
  const T = (key, vars) => t(lang, key, vars);
  const name = text(config.schoolName, lang);
  const flashType = MESSAGE_TYPES[msg];
  const pageTitle = title ? `${title} — ${name}` : `${name} — ${T('meta.title')}`;
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${h(pageTitle)}</title>
<meta name="description" content="${h(T('meta.description'))}">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#1e2b45"/><text x="32" y="44" font-family="Georgia,serif" font-size="34" text-anchor="middle" fill="#e9d9b8">${h(name[0])}</text></svg>`)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
</head>
<body class="${h(bodyClass)}">
<header class="site-header">
  <div class="container header-inner">
    <a class="logo" href="/">
      <span class="logo-mark">${h(name[0])}</span>
      <span>${h(name)}<small>${h(text(config.tagline, lang))}</small></span>
    </a>
    <div class="header-tools">
      ${langSwitch(lang)}
      <button class="nav-toggle" aria-label="${h(T('nav.menu'))}" aria-expanded="false"><span></span><span></span></button>
    </div>
    <nav class="nav">
      <a href="/#approach">${T('nav.approach')}</a>
      <a href="/#format">${T('nav.format')}</a>
      <a href="/#pricing">${T('nav.pricing')}</a>
      <a href="/#teachers">${T('nav.teachers')}</a>
      <a href="/#faq">${T('nav.faq')}</a>
      ${user
        ? `${user.is_admin ? `<a href="/admin">${T('nav.admin')}</a>` : ''}
           <a class="btn btn-small btn-dark" href="/dashboard">${icon.user} ${T('nav.cabinet')}</a>`
        : `<a href="/login">${T('nav.login')}</a>
           <a class="btn btn-small btn-dark" href="/register">${T('nav.start')}</a>`}
    </nav>
  </div>
</header>
${flashType ? `<div class="container"><div class="flash flash-${flashType}" role="status">${h(T(`msg.${msg}`))}</div></div>` : ''}
${error ? `<div class="container"><div class="flash flash-error" role="alert">${h(error)}</div></div>` : ''}
<main>
${body}
</main>
<footer class="site-footer">
  <div class="container footer-inner">
    <div>
      <a class="logo logo-light" href="/"><span class="logo-mark">${h(name[0])}</span><span>${h(name)}<small>${h(text(config.tagline, lang))}</small></span></a>
      <p class="muted">${T('footer.slogan')}</p>
    </div>
    <div class="footer-links">
      <a href="/#format">${T('nav.format')}</a>
      <a href="/#pricing">${T('nav.pricing')}</a>
      <a href="/#trial">${T('footer.trial')}</a>
      <a href="/dashboard">${T('nav.cabinet')}</a>
    </div>
    <div class="footer-contacts">
      <a href="tel:${h(config.phone.replace(/[^+\d]/g, ''))}">${h(config.phone)}</a>
      <a href="mailto:${h(config.email)}">${h(config.email)}</a>
    </div>
  </div>
  <div class="container footer-bottom">© ${new Date().getFullYear()} ${h(name)}. ${T('footer.rights')}</div>
</footer>
<script src="/app.js" defer></script>
</body>
</html>`;
}

// ---------- Головна ----------

function home({ lang, user, msg }) {
  const T = (key, vars) => t(lang, key, vars);
  const { single, monthly } = config.products;
  const min = config.lessonDuration;
  const teacherName = text(config.teachers[0]?.name, lang) || T('hero.card.teacher');
  const body = `
<section class="hero">
  <div class="container hero-inner">
    <div class="hero-text">
      <p class="eyebrow">${T('hero.eyebrow')}</p>
      <h1>${T('hero.title')}</h1>
      <p class="lead">${T('hero.lead')}</p>
      <div class="hero-actions">
        <a class="btn btn-dark" href="${user ? '/dashboard' : '/register'}">${user ? T('hero.continue') : T('hero.start')} ${icon.arrow}</a>
        <a class="btn btn-ghost" href="#pricing">${T('hero.pricing')}</a>
      </div>
      <ul class="hero-points">
        <li>${icon.check} ${T('hero.point1')}</li>
        <li>${icon.check} ${T('hero.point2')}</li>
      </ul>
    </div>
    <div class="hero-card" aria-hidden="true">
      <div class="hc-top">
        <span class="hc-badge">${T('hero.card.badge')}</span>
        <span class="hc-time">${icon.clock} ${min} ${T('unit.min')}</span>
      </div>
      <p class="hc-title">${T('hero.card.when')}</p>
      <div class="hc-teacher">
        <span class="hc-avatar">${h(teacherName[0])}</span>
        <span><b>${h(teacherName)}</b><small>${T('hero.card.online')}</small></span>
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
    <div><b>A1–C1</b><span>${T('stats.levels')}</span></div>
    <div><b>1:1</b><span>${T('stats.format')}</span></div>
    <div><b>${min}</b><span>${T('stats.minutes')}</span></div>
    <div><b>−${monthly.discount}%</b><span>${T('stats.discount')}</span></div>
  </div>
</section>

<section class="section" id="approach">
  <div class="container">
    <div class="section-head">
      <p class="eyebrow">${T('approach.eyebrow')}</p>
      <h2>${T('approach.title')}</h2>
      <p class="muted">${T('approach.lead')}</p>
    </div>
    <div class="features">
      <article class="feature">
        <div class="feature-icon"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/></svg></div>
        <h3>${T('approach.f1.title')}</h3>
        <p>${T('approach.f1.text')}</p>
      </article>
      <article class="feature">
        <div class="feature-icon"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6.5h16v10H9l-5 4z"/><path d="M8.5 11.5h7"/></svg></div>
        <h3>${T('approach.f2.title')}</h3>
        <p>${T('approach.f2.text')}</p>
      </article>
      <article class="feature">
        <div class="feature-icon"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V11M10 19V5M16 19v-6M22 19H2"/></svg></div>
        <h3>${T('approach.f3.title')}</h3>
        <p>${T('approach.f3.text')}</p>
      </article>
    </div>
  </div>
</section>

<section class="section section-tint" id="format">
  <div class="container">
    <div class="section-head">
      <p class="eyebrow">${T('format.eyebrow')}</p>
      <h2>${T('format.title')}</h2>
      <p class="muted">${T('format.lead')}</p>
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
      <p class="muted">${T('pricing.lead', { min })}</p>
    </div>
    <div class="pricing">
      <article class="price-card">
        <h3>${T('pricing.trial.title')}</h3>
        <p class="price">${money(0, lang)}<small> ${T('pricing.trial.per')}</small></p>
        <ul>
          <li>${icon.check} ${T('pricing.trial.f1')}</li>
          <li>${icon.check} ${T('pricing.trial.f2')}</li>
          <li>${icon.check} ${T('pricing.trial.f3')}</li>
        </ul>
        <a class="btn btn-ghost" href="#trial">${T('pricing.trial.cta')}</a>
      </article>
      <article class="price-card">
        <h3>${T('pricing.single.title')}</h3>
        <p class="price">${money(single.price, lang)}<small> ${T('pricing.single.per', { min })}</small></p>
        <ul>
          <li>${icon.check} ${T('pricing.single.f1')}</li>
          <li>${icon.check} ${T('pricing.single.f2')}</li>
          <li>${icon.check} ${T('pricing.single.f3')}</li>
        </ul>
        <a class="btn btn-ghost" href="/pay/single">${T('pricing.single.cta')}</a>
      </article>
      <article class="price-card price-card-accent">
        <span class="price-badge">${T('pricing.monthly.badge', { discount: monthly.discount })}</span>
        <h3>${T('pricing.monthly.title')}</h3>
        <p class="price-old">${money(monthly.fullPrice, lang)}</p>
        <p class="price">${money(monthly.price, lang)}<small> ${T('pricing.monthly.per', { n: monthly.lessons })}</small></p>
        <ul>
          <li>${icon.check} ${T('pricing.monthly.f1', { n: monthly.lessons, min })}</li>
          <li>${icon.check} ${T('pricing.monthly.f2', { each: money(monthly.price / monthly.lessons, lang), single: money(single.price, lang) })}</li>
          <li>${icon.check} ${T('pricing.monthly.f3', { discount: monthly.discount, save: money(monthly.fullPrice - monthly.price, lang) })}</li>
          <li>${icon.check} ${T('pricing.monthly.f4')}</li>
        </ul>
        <a class="btn btn-light" href="/pay/monthly">${T('pricing.monthly.cta')}</a>
      </article>
    </div>
  </div>
</section>

<section class="section" id="teachers">
  <div class="container">
    <div class="section-head">
      <p class="eyebrow">${T('teachers.eyebrow')}</p>
      <h2>${T('teachers.title')}</h2>
      <p class="muted">${T('teachers.lead')}</p>
    </div>
    <div class="teachers">
      ${config.teachers.map((teacher) => {
        const name = text(teacher.name, lang);
        return `
        <article class="teacher">
          <div class="avatar">${h(name[0])}</div>
          <h3>${h(name)}</h3>
          <p class="teacher-role">${h(text(teacher.role, lang))}</p>
          <p class="muted">${h(text(teacher.about, lang))}</p>
        </article>`;
      }).join('')}
    </div>
  </div>
</section>

<section class="section section-tint" id="faq">
  <div class="container container-narrow">
    <div class="section-head">
      <p class="eyebrow">${T('faq.eyebrow')}</p>
      <h2>${T('faq.title')}</h2>
    </div>
    <div class="faq">
      ${[1, 2, 3, 4, 5].map((n) => `<details><summary>${T(`faq.q${n}`)}</summary><p>${T(`faq.a${n}`, {
        n: monthly.lessons, price: money(monthly.price, lang), full: money(monthly.fullPrice, lang), discount: monthly.discount, min,
      })}</p></details>`).join('')}
    </div>
  </div>
</section>

<section class="cta" id="trial">
  <div class="container cta-inner">
    <div>
      <p class="eyebrow eyebrow-light">${T('cta.eyebrow')}</p>
      <h2>${T('cta.title')}</h2>
      <p>${T('cta.text')}</p>
    </div>
    <form class="cta-form" method="post" action="/request">
      <label>${T('cta.name')}<input name="name" required maxlength="80" autocomplete="name"></label>
      <label>${T('cta.contact')}<input name="contact" required maxlength="120"></label>
      <label>${T('cta.goal')} <span class="optional">${T('form.optional')}</span><textarea name="message" rows="3" maxlength="1000" placeholder="${h(T('cta.goalHint'))}"></textarea></label>
      <button class="btn btn-light" type="submit">${T('cta.submit')}</button>
    </form>
  </div>
</section>`;
  return layout({ lang, user, msg, body });
}

// ---------- Вхід і реєстрація ----------

function authPage({ lang, mode, error, values = {}, user, msg, next }) {
  const T = (key, vars) => t(lang, key, vars);
  const isRegister = mode === 'register';
  const nextQuery = next ? `?next=${encodeURIComponent(next)}` : '';
  const body = `
<section class="auth">
  <div class="auth-card">
    <h1>${T(isRegister ? 'auth.register.title' : 'auth.login.title')}</h1>
    <p class="muted">${T(isRegister ? 'auth.register.lead' : 'auth.login.lead')}</p>
    ${error ? `<div class="flash flash-error">${h(error)}</div>` : ''}
    <form method="post" action="/${mode}" class="form">
      ${next ? `<input type="hidden" name="next" value="${h(next)}">` : ''}
      ${isRegister ? `<label>${T('auth.name')}<input name="name" required maxlength="80" value="${h(values.name)}" autocomplete="name"></label>` : ''}
      <label>${T('auth.email')}<input type="email" name="email" required maxlength="120" value="${h(values.email)}" autocomplete="email"></label>
      ${isRegister ? `<label>${T('auth.phone')} <span class="optional">— ${T('auth.phoneHint')}</span><input type="tel" name="phone" required maxlength="30" value="${h(values.phone)}" autocomplete="tel" placeholder="+380"></label>` : ''}
      <label>${T('auth.password')}<input type="password" name="password" required minlength="${isRegister ? 8 : 1}" autocomplete="${isRegister ? 'new-password' : 'current-password'}"></label>
      ${isRegister ? `<label>${T('auth.level')}<select name="level">${levelOptions(lang, values.level)}</select></label>` : ''}
      <button class="btn btn-dark btn-block" type="submit">${T(isRegister ? 'auth.register.submit' : 'auth.login.submit')}</button>
    </form>
    <p class="auth-switch">${isRegister
      ? `${T('auth.haveAccount')} <a href="/login${nextQuery}">${T('auth.toLogin')}</a>`
      : `${T('auth.noAccount')} <a href="/register${nextQuery}">${T('auth.toRegister')}</a>`}</p>
  </div>
</section>`;
  return layout({ lang, title: T(isRegister ? 'auth.register.title' : 'auth.login.title'), user, msg, body, bodyClass: 'page-auth' });
}

// ---------- Особистий кабінет ----------

const paymentStatus = (status, lang) => (['paid', 'pending', 'cancelled'].includes(status) ? t(lang, `pay.${status}`) : status);

function productName(productId, lang) {
  return t(lang, productId === 'monthly' ? 'product.monthly' : 'product.single');
}

function lessonsLabel(n, lang) {
  return n === 1 ? t(lang, 'product.lesson1') : t(lang, 'product.lessons', { n });
}

function dashboard({ lang, user, msg, balance, orders }) {
  const T = (key, vars) => t(lang, key, vars);
  const { single, monthly } = config.products;
  const min = config.lessonDuration;
  const pendingLessons = orders.filter((o) => o.status === 'pending').reduce((s, o) => s + o.lessons, 0);

  const body = `
<section class="dash">
  <div class="container">
    <div class="dash-head">
      <div>
        <p class="eyebrow">${T('dash.eyebrow')}</p>
        <h1>${h(T('dash.hello', { name: user.name.split(' ')[0] }))}</h1>
        <p class="muted">${T('dash.level')}: ${h(T(`level.${user.level}`))} · <a href="/account">${T('dash.settings')}</a></p>
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
        : `<p class="balance-empty">${T('dash.empty')}</p>`}
        ${pendingLessons ? `<p class="pending-note">${h(T('dash.pendingNote', { n: lessonsLabel(pendingLessons, lang) }))}</p>` : ''}
      </div>

      <div class="panel buy-panel">
        <span class="panel-label">${T('dash.buy')}</span>
        <div class="buy-option">
          <div>
            <b>${T('product.single')}</b>
            <span>${lessonsLabel(1, lang)} · ${min} ${T('unit.min')}</span>
          </div>
          <div class="buy-price"><b>${money(single.price, lang)}</b></div>
          <a class="btn btn-small btn-ghost" href="/pay/single">${T('btn.pay')}</a>
        </div>
        <div class="buy-option buy-option-accent">
          <div>
            <b>${T('product.monthly')} <span class="tag tag-accent">−${monthly.discount}%</span></b>
            <span>${T('pricing.monthly.f1', { n: monthly.lessons, min })}</span>
          </div>
          <div class="buy-price"><s>${money(monthly.fullPrice, lang)}</s><b>${money(monthly.price, lang)}</b></div>
          <a class="btn btn-small btn-accent" href="/pay/monthly">${T('btn.pay')}</a>
        </div>
        <p class="muted small">${h(T('dash.buyLead', { phone: user.phone || T('dash.noPhone') }))}</p>
        <p class="muted small">${T('dash.consult')}</p>
      </div>
    </div>

    ${orders.length ? `
    <h2 class="dash-title">${T('dash.orders')}</h2>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>${T('table.product')}</th><th>${T('table.amount')}</th><th>${T('table.date')}</th><th>${T('table.status')}</th></tr></thead>
        <tbody>
          ${orders.map((o) => `
          <tr>
            <td>${h(productName(o.product, lang))}<br><span class="muted small">${h(lessonsLabel(o.lessons, lang))}</span></td>
            <td>${money(o.amount, lang)}</td>
            <td>${date(o.created_at, lang)}</td>
            <td><span class="pill pill-${h(o.status)}">${h(paymentStatus(o.status, lang))}</span></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : ''}
  </div>
</section>`;
  return layout({ lang, title: T('nav.cabinet'), user, msg, body, bodyClass: 'page-app' });
}

// ---------- Оплата ----------

function demoCheckout({ lang, user, product, order }) {
  const T = (key, vars) => t(lang, key, vars);
  const body = `
<section class="auth">
  <div class="auth-card checkout">
    <p class="eyebrow">${T('checkout.eyebrow')}</p>
    <h1>${h(productName(product.id, lang))}</h1>
    <div class="checkout-row"><span>${T('checkout.student')}</span><b>${h(user.email)}</b></div>
    <div class="checkout-row"><span>${T('checkout.number')}</span><b>№ ${order.id}</b></div>
    <div class="checkout-row"><span>${T('checkout.lessons')}</span><b>${h(lessonsLabel(order.lessons, lang))} · ${config.lessonDuration} ${T('unit.min')}</b></div>
    ${product.discount ? `<div class="checkout-row"><span>${T('checkout.discount')}</span><b>−${product.discount}% (<s>${money(product.fullPrice, lang)}</s>)</b></div>` : ''}
    <div class="checkout-row checkout-total"><span>${T('checkout.total')}</span><b>${money(order.amount, lang)}</b></div>
    <div class="flash flash-info">${T('checkout.demo')}</div>
    <form method="post" action="/pay/demo/${order.id}">
      <button class="btn btn-accent btn-block" type="submit">${T('checkout.submit', { amount: money(order.amount, lang) })}</button>
    </form>
    <p class="auth-switch"><a href="/dashboard">${T('checkout.back')}</a></p>
  </div>
</section>`;
  return layout({ lang, title: T('checkout.eyebrow'), user, body, bodyClass: 'page-auth' });
}

// ---------- Профіль ----------

function account({ lang, user, msg, error }) {
  const T = (key, vars) => t(lang, key, vars);
  const body = `
<section class="dash">
  <div class="container container-narrow">
    <a class="back-link" href="/dashboard">${icon.back} ${T('account.back')}</a>
    <h1>${T('account.title')}</h1>
    ${error ? `<div class="flash flash-error">${h(error)}</div>` : ''}
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
  return layout({ lang, title: T('account.title'), user, msg, body, bodyClass: 'page-app' });
}

// ---------- Адмін-панель ----------

function admin({ lang, user, msg, users, orders, requests }) {
  const T = (key, vars) => t(lang, key, vars);
  const pending = orders.filter((o) => o.status === 'pending');
  const revenue = orders.filter((o) => o.status === 'paid').reduce((s, o) => s + o.amount, 0);
  const tel = (phone) => (phone ? `<a href="tel:${h(phone.replace(/[^+\d]/g, ''))}">${h(phone)}</a>` : '—');
  const body = `
<section class="dash">
  <div class="container">
    <p class="eyebrow">${T('admin.eyebrow')}</p>
    <h1>${T('admin.title')}</h1>
    <div class="admin-stats">
      <div class="panel"><span class="panel-label">${T('admin.students')}</span><b>${users.filter((u) => !u.is_admin).length}</b></div>
      <div class="panel"><span class="panel-label">${T('admin.pending')}</span><b>${pending.length}</b></div>
      <div class="panel"><span class="panel-label">${T('admin.revenue')}</span><b>${money(revenue, lang)}</b></div>
      <div class="panel"><span class="panel-label">${T('admin.requests')}</span><b>${requests.length}</b></div>
    </div>

    <h2 class="dash-title">${T('admin.orders')}</h2>
    ${orders.length ? `
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>№</th><th>${T('admin.student')}</th><th>${T('auth.phone')}</th><th>${T('table.product')}</th><th>${T('table.amount')}</th><th>${T('table.date')}</th><th>${T('table.status')}</th><th></th></tr></thead>
        <tbody>
          ${orders.map((o) => `
          <tr>
            <td>${o.id}</td>
            <td>${h(o.user_name)}<br><span class="muted small">${h(o.user_email)}</span></td>
            <td>${tel(o.user_phone)}</td>
            <td>${h(productName(o.product, lang))}<br><span class="muted small">${h(lessonsLabel(o.lessons, lang))}</span></td>
            <td>${money(o.amount, lang)}</td>
            <td>${date(o.created_at, lang)}</td>
            <td><span class="pill pill-${h(o.status)}">${h(paymentStatus(o.status, lang))}</span></td>
            <td class="actions">${o.status === 'pending' ? `
              <form method="post" action="/admin/orders/${o.id}/confirm"><button class="btn btn-small btn-dark">${T('admin.confirm')}</button></form>
              <form method="post" action="/admin/orders/${o.id}/cancel"><button class="btn btn-small btn-ghost">${T('admin.cancel')}</button></form>` : ''}
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : `<p class="muted">${T('admin.noOrders')}</p>`}

    <h2 class="dash-title">${T('admin.accounts')}</h2>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>${T('admin.name')}</th><th>${T('auth.phone')}</th><th>${T('admin.level')}</th><th>${T('admin.left')}</th><th>${T('admin.held')}</th><th>${T('admin.paidTotal')}</th><th>${T('admin.registered')}</th><th></th></tr></thead>
        <tbody>
          ${users.map((u) => {
            const left = Math.max(u.lessons_bought - u.lessons_held, 0);
            return `
          <tr>
            <td>${h(u.name)}${u.is_admin ? ` <span class="pill pill-paid">${T('admin.adminTag')}</span>` : ''}<br><span class="muted small">${h(u.email)}</span></td>
            <td>${tel(u.phone)}</td>
            <td>${h(u.level)}</td>
            <td><b>${left}</b></td>
            <td>${u.lessons_held}</td>
            <td>${money(u.paid_total, lang)}</td>
            <td>${date(u.created_at, lang)}</td>
            <td class="actions">
              ${left > 0 ? `<form method="post" action="/admin/users/${u.id}/held"><button class="btn btn-small btn-dark">${T('admin.markHeld')}</button></form>` : ''}
              ${u.lessons_held > 0 ? `<form method="post" action="/admin/users/${u.id}/undo"><button class="btn btn-small btn-ghost" title="${h(T('admin.undo'))}">↶</button></form>` : ''}
            </td>
          </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>

    <h2 class="dash-title">${T('admin.consultations')}</h2>
    ${requests.length ? `
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>${T('admin.name')}</th><th>${T('admin.contact')}</th><th>${T('admin.message')}</th><th>${T('table.date')}</th></tr></thead>
        <tbody>
          ${requests.map((r) => `<tr><td>${h(r.name)}</td><td>${h(r.contact)}</td><td>${h(r.message || '—')}</td><td>${date(r.created_at, lang)}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>` : `<p class="muted">${T('admin.noRequests')}</p>`}
  </div>
</section>`;
  return layout({ lang, title: T('nav.admin'), user, msg, body, bodyClass: 'page-app' });
}

function notFound({ lang, user }) {
  const T = (key, vars) => t(lang, key, vars);
  const body = `
<section class="auth">
  <div class="auth-card" style="text-align:center">
    <p class="eyebrow">404</p>
    <h1>${T('notfound.title')}</h1>
    <p class="muted">${T('notfound.text')}</p>
    <a class="btn btn-dark" href="/">${T('notfound.home')}</a>
  </div>
</section>`;
  return layout({ lang, title: T('notfound.title'), user, body, bodyClass: 'page-auth' });
}

module.exports = { home, authPage, dashboard, demoCheckout, account, admin, notFound, LEVEL_CODES };
