// Мобильное меню
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

// Тест в конце урока: проверка ответов прямо на странице
document.querySelectorAll('[data-quiz]').forEach((form) => {
  const result = form.querySelector('.quiz-result');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const questions = [...form.querySelectorAll('.quiz-q')];
    let correct = 0;
    questions.forEach((q) => {
      const answer = q.dataset.answer;
      const chosen = q.querySelector('input:checked');
      const ok = chosen && chosen.value === answer;
      if (ok) correct++;
      q.classList.toggle('correct', !!ok);
      q.classList.toggle('wrong', !ok);
      q.querySelectorAll('.quiz-opt').forEach((opt) =>
        opt.classList.toggle('is-answer', !ok && opt.querySelector('input').value === answer)
      );
    });
    const all = correct === questions.length;
    result.textContent = all
      ? `Превосходно! ${correct} из ${questions.length} — все ответы верны.`
      : `Правильно ${correct} из ${questions.length}. Верные варианты подсвечены — попробуйте ещё раз.`;
    result.style.color = all ? 'var(--success)' : 'var(--danger)';
  });
  form.addEventListener('change', () => {
    form.querySelectorAll('.quiz-q').forEach((q) => q.classList.remove('correct', 'wrong'));
    form.querySelectorAll('.is-answer').forEach((o) => o.classList.remove('is-answer'));
    result.textContent = '';
  });
});
