// Мобільне меню
const toggle = document.querySelector('.nav-toggle');
if (toggle) {
  toggle.addEventListener('click', () => {
    const open = document.body.classList.toggle('nav-open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  document.querySelectorAll('.nav a').forEach((link) =>
    link.addEventListener('click', () => {
      document.body.classList.remove('nav-open');
      toggle.setAttribute('aria-expanded', 'false');
    })
  );
}

// Гарне вікно підтвердження замість системного confirm().
const L = document.documentElement.lang === 'en'
  ? { cancel: 'Cancel', ok: 'Confirm', yes: 'Yes' }
  : { cancel: 'Скасувати', ok: 'Підтвердити', yes: 'Так' };
const ICONS = {
  gift: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m9 16 2 2 4-4"/></svg>',
  question: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/></svg>',
  warn: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
};

function askConfirm({ title, text, list, ok, icon = 'question', danger = false }) {
  if (typeof HTMLDialogElement !== 'function') return Promise.resolve(window.confirm([title, text, ...(list || [])].filter(Boolean).join('\n')));
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = `confirm${danger ? ' confirm-danger' : ''}`;
    dialog.innerHTML = `
      <div class="confirm-icon">${ICONS[icon] || ICONS.question}</div>
      ${title ? '<h3 class="confirm-title"></h3>' : ''}
      ${text ? '<p class="confirm-text"></p>' : ''}
      ${list && list.length ? '<ul class="confirm-list"></ul>' : ''}
      <div class="confirm-actions">
        <button type="button" class="btn btn-ghost" value="cancel"></button>
        <button type="button" class="btn ${danger ? 'btn-dark' : 'btn-accent'}" value="ok"></button>
      </div>`;
    if (title) dialog.querySelector('.confirm-title').textContent = title;
    if (text) dialog.querySelector('.confirm-text').textContent = text;
    if (list && list.length) list.forEach((item) => { const li = document.createElement('li'); li.textContent = item; dialog.querySelector('.confirm-list').append(li); });
    const [no, yes] = dialog.querySelectorAll('.confirm-actions button');
    no.textContent = L.cancel;
    yes.textContent = ok || (danger ? L.yes : L.ok);
    let answer = false;
    no.addEventListener('click', () => dialog.close());
    yes.addEventListener('click', () => { answer = true; dialog.close(); });
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => { dialog.remove(); resolve(answer); });
    document.body.append(dialog);
    dialog.showModal();
    yes.focus();
  });
}

const fromData = (el) => ({
  title: el.dataset.confirmTitle,
  text: el.dataset.confirm,
  ok: el.dataset.confirmOk,
  icon: el.dataset.confirmIcon || ('confirmDanger' in el.dataset ? 'warn' : 'question'),
  danger: 'confirmDanger' in el.dataset,
});

// Форми з підтвердженням (скасування, видалення тощо).
document.querySelectorAll('form[data-confirm]').forEach((form) => {
  form.addEventListener('submit', async (event) => {
    if (form.dataset.confirmed) { delete form.dataset.confirmed; return; }
    event.preventDefault();
    if (await askConfirm(fromData(form))) { form.dataset.confirmed = '1'; form.requestSubmit ? form.requestSubmit() : form.submit(); }
  });
});

// Кнопки годин у графіку: підтвердження з датою й часом.
document.querySelectorAll('button[data-confirm]').forEach((button) => {
  button.addEventListener('click', async (event) => {
    if (button.dataset.confirmed) { delete button.dataset.confirmed; return; }
    event.preventDefault();
    if (await askConfirm(fromData(button))) { button.dataset.confirmed = '1'; button.click(); }
  });
});

// Запис одразу на кілька годин: лічильник, ліміт і підтвердження зі списком.
document.querySelectorAll('form[data-multi]').forEach((form) => {
  const max = Number(form.dataset.multi);
  const boxes = [...form.querySelectorAll('input[name="slot"]')];
  const count = form.querySelector('.slots-count');
  const submit = form.querySelector('.slots-submit button');
  const update = () => {
    const picked = boxes.filter((b) => b.checked);
    boxes.forEach((b) => {
      b.disabled = !b.checked && picked.length >= max;
      b.closest('.slot').classList.toggle('is-picked', b.checked);
    });
    if (count) count.textContent = count.dataset.template.replace('{n}', picked.length);
    if (submit) submit.disabled = picked.length === 0;
  };
  boxes.forEach((b) => b.addEventListener('change', update));
  form.addEventListener('submit', async (event) => {
    if (form.dataset.confirmed) { delete form.dataset.confirmed; return; }
    event.preventDefault();
    const picked = boxes.filter((b) => b.checked).map((b) => b.dataset.when);
    if (!picked.length) return;
    if (await askConfirm({ title: form.dataset.confirmMany, list: picked, ok: form.dataset.confirmOk, icon: 'calendar' })) {
      form.dataset.confirmed = '1';
      form.requestSubmit ? form.requestSubmit() : form.submit();
    }
  });
  update();
});
