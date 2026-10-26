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
