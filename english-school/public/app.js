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

// Чат: надсилання без перезавантаження, автооновлення кожні 4 секунди, вибрані файли.
const chat = document.querySelector('[data-chat]');
if (chat) {
  const list = chat.querySelector('.chat-messages');
  const form = chat.querySelector('.chat-form');
  const textarea = form.querySelector('textarea');
  const fileInput = form.querySelector('input[type=file]');
  const filesBox = form.querySelector('.chat-files');
  const sendButton = form.querySelector('.chat-send');
  const errorBox = chat.querySelector('.chat-error');
  const url = form.getAttribute('action');
  let last = Number(chat.dataset.last) || 0;
  let busy = false;

  const nearBottom = () => window.innerHeight + window.scrollY >= document.body.scrollHeight - 200;
  const toBottom = () => window.scrollTo(0, document.body.scrollHeight);
  toBottom();
  list.querySelectorAll('img').forEach((img) => img.addEventListener('load', toBottom, { once: true }));

  function showError(text) {
    errorBox.textContent = text || '';
    errorBox.hidden = !text;
  }

  function append(messages) {
    if (!messages.length) return;
    const stick = nearBottom();
    list.querySelector('.chat-empty')?.remove();
    for (const m of messages) {
      if (m.id <= last || list.querySelector(`[data-id="${m.id}"]`)) continue;
      list.insertAdjacentHTML('beforeend', m.html);
      last = Math.max(last, m.id);
    }
    if (stick) {
      toBottom();
      list.querySelectorAll('img').forEach((img) => img.addEventListener('load', toBottom, { once: true }));
    }
  }

  function autosize() {
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }
  textarea.addEventListener('input', autosize);

  const allowed = (errorBox.dataset.extensions || '').split(',').filter(Boolean);

  // Перевіряємо файли ще до надсилання: тип і розмір (до 20 МБ), не більше 5 штук.
  function fileProblem() {
    const files = [...fileInput.files];
    for (const f of files) {
      const ext = (f.name.match(/\.[^.]+$/) || [''])[0].toLowerCase();
      if (allowed.length && !allowed.includes(ext)) return errorBox.dataset.badType.replace('{name}', f.name);
      if (f.size > 20 * 1024 * 1024) return errorBox.dataset.tooBig.replace('{name}', f.name);
    }
    return '';
  }

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 5) {
      const dt = new DataTransfer();
      [...fileInput.files].slice(0, 5).forEach((f) => dt.items.add(f));
      fileInput.files = dt.files;
    }
    const names = [...fileInput.files].map((f) => `<span>${f.name.replace(/[<>&"]/g, '')}</span>`);
    filesBox.innerHTML = names.join('');
    filesBox.hidden = !names.length;
    showError(fileProblem());
  });

  // Enter — надіслати, Shift+Enter — новий рядок (на телефоні Enter просто переносить рядок).
  textarea.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && window.matchMedia('(pointer: fine)').matches) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!textarea.value.trim() && !fileInput.files.length) return showError(errorBox.dataset.empty);
    const problem = fileProblem();
    if (problem) return showError(problem);
    busy = true;
    sendButton.disabled = true;
    showError(fileInput.files.length ? errorBox.dataset.sending : '');
    try {
      const res = await fetch(url, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || errorBox.dataset.failed);
      form.reset();
      filesBox.hidden = true;
      autosize();
      showError('');
      append(data.messages || []);
      toBottom();
    } catch (err) {
      showError(err.message || errorBox.dataset.failed);
    } finally {
      busy = false;
      sendButton.disabled = false;
      textarea.focus();
    }
  });

  async function poll() {
    if (document.hidden || busy) return;
    try {
      const res = await fetch(`${url}/messages?after=${last}`, { headers: { Accept: 'application/json' } });
      if (res.ok) append((await res.json()).messages || []);
    } catch {}
  }
  setInterval(poll, 4000);
  document.addEventListener('visibilitychange', poll);
}
