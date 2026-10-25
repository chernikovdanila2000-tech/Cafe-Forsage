const config = require('./config');
const { t } = require('./i18n');
const { localize } = require('./lessons');

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
  completed: 'success', confirmed: 'success', cancelled: 'info',
};

function groupByModule(lessons) {
  const groups = new Map();
  for (const lesson of lessons) {
    if (!groups.has(lesson.module)) groups.set(lesson.module, []);
    groups.get(lesson.module).push(lesson);
  }
  return [...groups];
}

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
      <a href="/#program">${T('nav.program')}</a>
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
      <a href="/#program">${T('nav.program')}</a>
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
<script>window.I18N=${JSON.stringify({ allRight: T('quiz.allRight'), some: T('quiz.some') }).replace(/</g, '\\u003c')}</script>
<script src="/app.js" defer></script>
</body>
</html>`;
}

// ---------- Головна ----------

function home({ lang, user, msg, lessons }) {
  const T = (key, vars) => t(lang, key, vars);
  const items = lessons.map((l) => localize(l, lang));
  const firstFree = items.find((l) => l.is_free);
  const body = `
<section class="hero">
  <div class="container hero-inner">
    <div class="hero-text">
      <p class="eyebrow">${T('hero.eyebrow')}</p>
      <h1>${T('hero.title')}</h1>
      <p class="lead">${T('hero.lead')}</p>
      <div class="hero-actions">
        <a class="btn btn-dark" href="${user ? '/dashboard' : '/register'}">${user ? T('hero.continue') : T('hero.start')} ${icon.arrow}</a>
        <a class="btn btn-ghost" href="#program">${T('hero.program')}</a>
      </div>
      <ul class="hero-points">
        <li>${icon.check} ${T('hero.point1')}</li>
        <li>${icon.check} ${T('hero.point2')}</li>
      </ul>
    </div>
    <div class="hero-card" aria-hidden="true">
      <div class="hc-top">
        <span class="hc-badge">${T('hero.card.badge')}</span>
        <span class="hc-time">${icon.clock} ${config.lessonDuration} ${T('unit.min')}</span>
      </div>
      <p class="hc-title">${T('hero.card.title')}</p>
      <div class="hc-progress"><span style="width:62%"></span></div>
      <p class="hc-caption">${T('hero.card.progress')}</p>
      <div class="hc-word">
        <span class="hc-label">${T('hero.card.word')}</span>
        <span class="hc-en">serendipity</span>
        <span class="hc-ru">${T('hero.card.translation')}</span>
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
    <div><b>A1–C1</b><span>${T('stats.levels')}</span></div>
    <div><b>${items.length}</b><span>${T('stats.lessons')}</span></div>
    <div><b>${config.lessonDuration}</b><span>${T('stats.minutes')}</span></div>
    <div><b>24/7</b><span>${T('stats.access')}</span></div>
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
        <div class="feature-icon"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"/></svg></div>
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

<section class="section section-tint" id="program">
  <div class="container">
    <div class="section-head">
      <p class="eyebrow">${T('program.eyebrow')}</p>
      <h2>${T('program.title')}</h2>
      <p class="muted">${T('program.lead')} ${firstFree ? h(T('program.free', { title: firstFree.title })) : ''}</p>
    </div>
    <div class="program">
      ${groupByModule(items).map(([module, group]) => `
        <div class="module">
          <h3>${h(module)}</h3>
          <ol class="program-list">
            ${group.map((l) => `
              <li>
                <span class="pl-num">${String(l.position + 1).padStart(2, '0')}</span>
                <span class="pl-body"><b>${h(l.title)}</b><span>${h(l.summary)}</span></span>
                <span class="pl-meta">${l.is_free ? `<span class="tag tag-free">${T('program.freeTag')}</span>` : money(l.price, lang)}</span>
              </li>`).join('')}
          </ol>
        </div>`).join('')}
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
    </div>
    <div class="pricing pricing-2">
      <article class="price-card">
        <h3>${T('pricing.trial.title')}</h3>
        <p class="price">${money(0, lang)}</p>
        <ul>
          <li>${icon.check} ${T('pricing.trial.f1')}</li>
          <li>${icon.check} ${T('pricing.trial.f2')}</li>
          <li>${icon.check} ${T('pricing.trial.f3')}</li>
        </ul>
        <a class="btn btn-ghost" href="${user ? '/dashboard' : '/register'}">${T('pricing.trial.cta')}</a>
      </article>
      <article class="price-card price-card-accent">
        <span class="price-badge">${T('pricing.tutor.badge')}</span>
        <h3>${T('pricing.tutor.title')}</h3>
        <p class="price">${money(config.lessonPrice, lang)}<small> ${T('pricing.tutor.per', { min: config.lessonDuration })}</small></p>
        <ul>
          <li>${icon.check} ${T('pricing.tutor.f1')}</li>
          <li>${icon.check} ${T('pricing.tutor.f2')}</li>
          <li>${icon.check} ${T('pricing.tutor.f3')}</li>
          <li>${icon.check} ${T('pricing.tutor.f4')}</li>
        </ul>
        <a class="btn btn-light" href="${user ? '/dashboard' : '/register'}">${T('pricing.tutor.cta')}</a>
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
        const teacherName = text(teacher.name, lang);
        return `
        <article class="teacher">
          <div class="avatar">${h(teacherName[0])}</div>
          <h3>${h(teacherName)}</h3>
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
      ${[1, 2, 3, 4, 5].map((n) => `<details><summary>${T(`faq.q${n}`)}</summary><p>${T(`faq.a${n}`)}</p></details>`).join('')}
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
      ? `${T('auth.haveAccount')} <a href="/login">${T('auth.toLogin')}</a>`
      : `${T('auth.noAccount')} <a href="/register">${T('auth.toRegister')}</a>`}</p>
  </div>
</section>`;
  return layout({ lang, title: T(isRegister ? 'auth.register.title' : 'auth.login.title'), user, msg, body, bodyClass: 'page-auth' });
}

// ---------- Особистий кабінет ----------

function lessonStatus(l, user, lang) {
  if (l.completed) return { cls: 'done', label: t(lang, 'status.done') };
  if (l.is_free) return { cls: 'open', label: t(lang, 'status.free') };
  if (l.paid) return { cls: 'open', label: t(lang, 'status.paid') };
  if (user.is_admin) return { cls: 'open', label: t(lang, 'status.admin') };
  if (l.pending) return { cls: 'pending', label: t(lang, 'status.pending') };
  return { cls: 'locked', label: `${money(l.price, lang)} · ${t(lang, 'status.withTutor')}` };
}

const paymentStatus = (status, lang) => (['paid', 'pending', 'cancelled'].includes(status) ? t(lang, `pay.${status}`) : status);

function dashboard({ lang, user, msg, lessons, payments }) {
  const T = (key, vars) => t(lang, key, vars);
  const items = lessons.map((l) => localize(l, lang));
  const unlocked = (l) => l.is_free || l.paid || user.is_admin;
  const done = items.filter((l) => l.completed).length;
  const percent = items.length ? Math.round((done / items.length) * 100) : 0;
  const next = items.find((l) => !l.completed && unlocked(l)) || items.find((l) => !l.completed);

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
      <div class="panel progress-panel">
        <span class="panel-label">${T('dash.progress')}</span>
        <div class="ring" style="--p:${percent}"><span>${percent}%</span></div>
        <p>${T('dash.progressText', { done, total: items.length })}</p>
      </div>
      ${next ? `
      <div class="panel next-panel">
        <span class="panel-label">${T(done ? 'dash.continue' : 'dash.startHere')}</span>
        <h2>${h(next.title)}</h2>
        <p class="muted">${h(next.summary)}</p>
        <a class="btn btn-dark" href="/lessons/${next.id}">${icon.play} ${T(unlocked(next) ? 'dash.open' : 'dash.goTo')}</a>
      </div>` : `
      <div class="panel next-panel">
        <span class="panel-label">🎉</span>
        <h2>${T('dash.allDone')}</h2>
        <p class="muted">${T('dash.allDoneText')}</p>
        <a class="btn btn-dark" href="/#trial">${T('dash.signUp')}</a>
      </div>`}
    </div>

    <h2 class="dash-title">${T('dash.lessons')}</h2>
    <p class="dash-note">${T('dash.tutorNote', { price: money(config.lessonPrice, lang), min: config.lessonDuration })}</p>
    ${groupByModule(items).map(([module, group]) => `
      <div class="module">
        <h3>${h(module)}</h3>
        <div class="lesson-list">
          ${group.map((l) => {
            const s = lessonStatus(l, user, lang);
            return `
            <div class="lesson-row status-${s.cls}">
              <span class="lr-icon">${s.cls === 'done' ? icon.check : unlocked(l) ? icon.play : icon.lock}</span>
              <a class="lr-body" href="/lessons/${l.id}">
                <b>${h(l.title)}</b>
                <span>${h(l.level)} · ${l.duration} ${T('unit.min')}</span>
              </a>
              <span class="lr-status">${h(s.label)}</span>
              ${unlocked(l)
                ? `<a class="btn btn-small btn-ghost" href="/lessons/${l.id}">${T(l.completed ? 'btn.repeat' : 'btn.open')}</a>`
                : `<a class="btn btn-small btn-accent" href="/pay/${l.id}">${T('btn.pay')}</a>`}
            </div>`;
          }).join('')}
        </div>
      </div>`).join('')}

    ${payments.length ? `
    <h2 class="dash-title">${T('dash.payments')}</h2>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>${T('table.lesson')}</th><th>${T('table.amount')}</th><th>${T('table.date')}</th><th>${T('table.status')}</th></tr></thead>
        <tbody>
          ${payments.map((p) => `
          <tr>
            <td>${h(localize({ id: p.lesson_id, title: p.lesson_title }, lang).title)}</td>
            <td>${money(p.amount, lang)}</td>
            <td>${date(p.created_at, lang)}</td>
            <td><span class="pill pill-${h(p.status)}">${h(paymentStatus(p.status, lang))}</span></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : ''}
  </div>
</section>`;
  return layout({ lang, title: T('nav.cabinet'), user, msg, body, bodyClass: 'page-app' });
}

// ---------- Урок ----------

function lessonPage({ lang, user, msg, lesson: row, hasAccess, completed, prev, next, pending }) {
  const T = (key, vars) => t(lang, key, vars);
  const lesson = localize(row, lang);
  const prevItem = prev && localize(prev, lang);
  const nextItem = next && localize(next, lang);
  const paidTutorLesson = hasAccess && !lesson.is_free && !user.is_admin;

  const header = `
    <a class="back-link" href="/dashboard">${icon.back} ${T('lesson.all')}</a>
    <p class="eyebrow">${h(lesson.module)}</p>
    <h1>${h(lesson.title)}</h1>
    <div class="lesson-meta">
      <span class="tag">${h(lesson.level)}</span>
      <span>${icon.clock} ${lesson.duration} ${T('unit.min')}${lesson.is_free ? '' : ` · ${T('status.withTutor')}`}</span>
      ${completed ? `<span class="tag tag-free">${icon.check} ${T('lesson.done')}</span>` : ''}
    </div>
    <p class="lead">${h(lesson.summary)}</p>`;

  const content = hasAccess
    ? `
    ${paidTutorLesson ? `<div class="flash flash-success">${T('lesson.tutorBooked')}</div>` : ''}
    <article class="lesson-body">
      <h2>${T('lesson.theory')}</h2>
      <div class="prose">${lesson.theory}</div>

      <h2>${T('lesson.vocab')}</h2>
      <div class="vocab">
        ${lesson.vocabulary.map(([en, uk]) => `<div class="vocab-item"><b lang="en">${h(en)}</b><span lang="uk">${h(uk)}</span></div>`).join('')}
      </div>

      <h2>${T('lesson.quiz')}</h2>
      <form class="quiz" data-quiz>
        ${lesson.exercises.map((ex, i) => `
          <fieldset class="quiz-q" data-answer="${ex.answer}">
            <legend><span>${i + 1}.</span> ${h(ex.q)}</legend>
            ${ex.options.map((opt, j) => `<label class="quiz-opt"><input type="radio" name="q${i}" value="${j}"> <span>${h(opt)}</span></label>`).join('')}
          </fieldset>`).join('')}
        <div class="quiz-actions">
          <button class="btn btn-ghost" type="submit">${T('lesson.check')}</button>
          <p class="quiz-result" aria-live="polite"></p>
        </div>
      </form>

      <div class="lesson-finish">
        ${completed
          ? `<p>${icon.check} ${T('lesson.alreadyDone')}</p>`
          : `<form method="post" action="/lessons/${lesson.id}/complete"><button class="btn btn-dark" type="submit">${icon.check} ${T('lesson.markDone')}</button></form>`}
      </div>
    </article>`
    : `
    <div class="paywall">
      <div class="paywall-icon">${icon.user}</div>
      <h2>${T('lesson.paywall.title')}</h2>
      <p class="muted">${T('lesson.paywall.text', { min: lesson.duration, words: lesson.vocabulary.length, questions: lesson.exercises.length })}</p>
      <p class="paywall-price">${money(lesson.price, lang)}</p>
      <a class="btn btn-accent" href="/pay/${lesson.id}">${T('lesson.paywall.cta')} ${icon.arrow}</a>
      ${pending ? `<p class="muted small">${T('lesson.paywall.pending')}</p>` : ''}
    </div>`;

  const body = `
<section class="lesson">
  <div class="container container-narrow">
    ${header}
    ${content}
    <nav class="lesson-nav">
      ${prevItem ? `<a href="/lessons/${prevItem.id}">${icon.back} ${h(prevItem.title)}</a>` : '<span></span>'}
      ${nextItem ? `<a href="/lessons/${nextItem.id}">${h(nextItem.title)} ${icon.arrow}</a>` : ''}
    </nav>
  </div>
</section>`;
  return layout({ lang, title: lesson.title, user, msg, body, bodyClass: 'page-app' });
}

// ---------- Оплата ----------

function demoCheckout({ lang, user, lesson: row, payment }) {
  const T = (key, vars) => t(lang, key, vars);
  const lesson = localize(row, lang);
  const body = `
<section class="auth">
  <div class="auth-card checkout">
    <p class="eyebrow">${T('checkout.eyebrow')}</p>
    <h1>${h(lesson.title)}</h1>
    <div class="checkout-row"><span>${T('checkout.student')}</span><b>${h(user.email)}</b></div>
    <div class="checkout-row"><span>${T('checkout.number')}</span><b>№ ${payment.id}</b></div>
    <div class="checkout-row"><span>${T('table.lesson')}</span><b>${lesson.duration} ${T('unit.min')} · ${T('status.withTutor')}</b></div>
    <div class="checkout-row checkout-total"><span>${T('checkout.total')}</span><b>${money(payment.amount, lang)}</b></div>
    <div class="flash flash-info">${T('checkout.demo')}</div>
    <form method="post" action="/pay/demo/${payment.id}">
      <button class="btn btn-accent btn-block" type="submit">${T('checkout.submit', { amount: money(payment.amount, lang) })}</button>
    </form>
    <p class="auth-switch"><a href="/lessons/${lesson.id}">${T('checkout.back')}</a></p>
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

function admin({ lang, user, msg, users, payments, requests }) {
  const T = (key, vars) => t(lang, key, vars);
  const pending = payments.filter((p) => p.status === 'pending');
  const revenue = payments.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
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

    <h2 class="dash-title">${T('admin.payments')}</h2>
    ${payments.length ? `
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>№</th><th>${T('admin.student')}</th><th>${T('auth.phone')}</th><th>${T('table.lesson')}</th><th>${T('table.amount')}</th><th>${T('table.date')}</th><th>${T('table.status')}</th><th></th></tr></thead>
        <tbody>
          ${payments.map((p) => `
          <tr>
            <td>${p.id}</td>
            <td>${h(p.user_name)}<br><span class="muted small">${h(p.user_email)}</span></td>
            <td>${p.user_phone ? `<a href="tel:${h(p.user_phone.replace(/[^+\d]/g, ''))}">${h(p.user_phone)}</a>` : '—'}</td>
            <td>${h(localize({ id: p.lesson_id, title: p.lesson_title }, lang).title)}</td>
            <td>${money(p.amount, lang)}</td>
            <td>${date(p.created_at, lang)}</td>
            <td><span class="pill pill-${h(p.status)}">${h(paymentStatus(p.status, lang))}</span></td>
            <td class="actions">${p.status === 'pending' ? `
              <form method="post" action="/admin/payments/${p.id}/confirm"><button class="btn btn-small btn-dark">${T('admin.confirm')}</button></form>
              <form method="post" action="/admin/payments/${p.id}/cancel"><button class="btn btn-small btn-ghost">${T('admin.cancel')}</button></form>` : ''}
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : `<p class="muted">${T('admin.noPayments')}</p>`}

    <h2 class="dash-title">${T('admin.accounts')}</h2>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>${T('admin.name')}</th><th>${T('auth.email')}</th><th>${T('auth.phone')}</th><th>${T('admin.level')}</th><th>${T('admin.completed')}</th><th>${T('admin.paidTotal')}</th><th>${T('admin.registered')}</th></tr></thead>
        <tbody>
          ${users.map((u) => `
          <tr>
            <td>${h(u.name)}${u.is_admin ? ` <span class="pill pill-paid">${T('admin.adminTag')}</span>` : ''}</td>
            <td>${h(u.email)}</td>
            <td>${h(u.phone || '—')}</td>
            <td>${h(u.level)}</td>
            <td>${u.completed}</td>
            <td>${money(u.paid_total, lang)}</td>
            <td>${date(u.created_at, lang)}</td>
          </tr>`).join('')}
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

module.exports = { home, authPage, dashboard, lessonPage, demoCheckout, account, admin, notFound, LEVEL_CODES };
