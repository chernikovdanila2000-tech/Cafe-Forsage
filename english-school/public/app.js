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

// Підтвердження небезпечних дій в адмін-панелі (видалення, скидання пароля)
document.querySelectorAll('form[data-confirm]').forEach((form) => {
  form.addEventListener('submit', (event) => {
    if (!window.confirm(form.dataset.confirm)) event.preventDefault();
  });
});

// Підтвердження запису на конкретний час (кнопки годин у графіку)
document.querySelectorAll('button[data-confirm]').forEach((button) => {
  button.addEventListener('click', (event) => {
    if (!window.confirm(button.dataset.confirm)) event.preventDefault();
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
  form.addEventListener('submit', (event) => {
    const picked = boxes.filter((b) => b.checked).map((b) => b.dataset.when);
    if (!picked.length || !window.confirm(`${form.dataset.confirmMany}\n\n${picked.join('\n')}`)) event.preventDefault();
  });
  update();
});
