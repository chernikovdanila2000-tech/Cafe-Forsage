"use strict";
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const KIND = { consultation: "Консультация", complaint: "Жалоба", other: "Иное" };
const STATUS = { ok: "Уверенный ответ", caution: "Требует осторожности", escalate: "Передать эксперту", not_found: "Норма не найдена" };
const VARIANT = { simple: "Простой", refs: "Со ссылками", quotes: "Со ссылками и цитатами" };
const SOURCE = { generated: "сформирован", reference: "эталон", faq: "FAQ", degraded: "без модели" };
const PERMS = { operator: ["process"], validator: ["process", "review", "faq"], admin: ["process", "review", "faq", "admin"] };

let token = null;
let me = null;
try { token = localStorage.getItem("expert-token"); } catch (_) { /* хранилище недоступно */ }

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401) { logout(); throw new Error("требуется вход"); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail ? (typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail)) : res.statusText);
  return data;
}

function logout() {
  token = null; me = null;
  try { localStorage.removeItem("expert-token"); } catch (_) {}
  $("#app").hidden = true; $("#login").hidden = false; $("#who").textContent = "";
}

async function login(t) {
  token = t;
  me = await api("/api/me");
  try { localStorage.setItem("expert-token", t); } catch (_) {}
  $("#who").textContent = `${me.name} · ${me.role}`;
  $("#login").hidden = true; $("#app").hidden = false;
  $$("[data-perm]").forEach((el) => { el.hidden = !PERMS[me.role].includes(el.dataset.perm); });
  showTab("request");
}

function showTab(name) {
  $$("#tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  $$(".tab").forEach((t) => { t.hidden = t.id !== `tab-${name}`; });
  ({ review: loadReview, faq: loadFaq, docs: loadDocs, admin: loadAdmin })[name]?.();
}

// ---------- обращение ----------
async function runRequest() {
  const text = $("#appeal").value.trim();
  if (!text) return;
  const btn = $("#run"); btn.disabled = true; btn.textContent = "Готовлю…";
  $("#result").innerHTML = "";
  try {
    const body = { text };
    if ($("#lang").value) body.lang = $("#lang").value;
    if ($("#mode").value) body.mode = $("#mode").value;
    if ($("#as-of").value) body.as_of = $("#as-of").value;
    renderResult(await api("/api/requests", { method: "POST", body }));
  } catch (e) {
    $("#result").innerHTML = `<div class="panel notice">Ошибка: ${esc(e.message)}</div>`;
  } finally { btn.disabled = false; btn.textContent = "Подготовить черновик"; }
}

function checksHtml(c) {
  const mark = (v) => v === true ? '<span class="check-ok">✓</span>' : v === false ? '<span class="check-bad">✗</span>' : '<span class="check-na">—</span>';
  const rows = [
    ["Ссылки существуют и действуют на дату", c.refs?.ok, (c.refs?.problems || []).map((p) => p.problem).join("; ")],
    ["Цитаты дословно совпадают с НПА", c.quotes?.ok, (c.quotes?.items || []).filter((i) => i.ok === false).map((i) => i.problem).join("; ")],
    ["Обоснованность (независимая проверка)", c.grounding?.ok, c.grounding?.note || (c.grounding?.items || []).filter((i) => !i.supported).map((i) => i.reason).join("; ")],
    ["Сверка русской и казахской версий", c.bilingual?.ok, (c.bilingual?.problems || []).map((p) => p.problem).join("; ")],
  ];
  return `<table>${rows.map(([n, v, d]) => `<tr><td>${mark(v)}</td><td>${n}${d ? `<div class="muted small">${esc(d)}</div>` : ""}</td></tr>`).join("")}</table>
    ${c.depth ? `<div class="muted small">Глубина проверки: ${c.depth === "deep" ? "расширенная" : "базовая"}</div>` : ""}`;
}

function renderResult(r) {
  const wrap = document.createElement("div");
  wrap.className = "panel";
  wrap.innerHTML = `
    <div class="row" style="margin-top:0"><h2 class="grow" style="margin:0">Обращение №${r.request_id}</h2>
      <span class="badge">${KIND[r.kind] || r.kind}</span><span class="badge">${r.lang === "kk" ? "қазақша" : "русский"}</span>
      <span class="badge">нормы на ${esc(r.as_of)}</span><span class="badge">база v${esc(r.kb_version)}</span></div>
    <div class="summary"><b>Резюме:</b> ${esc(r.summary)}</div>
    ${r.degraded ? '<div class="notice">Модель недоступна: разбор выполнен в упрощённом режиме.</div>' : ""}
    ${r.requires_approval ? '<div class="notice">Жалоба: перед отправкой заявителю каждый ответ должен быть проверен и подтверждён сотрудником.</div>' : ""}
    <details><summary>Обезличенный текст, переданный на обработку</summary><pre>${esc(r.masked_text)}</pre></details>
    <div id="answers"></div>`;
  const list = $("#answers", wrap);
  r.answers.forEach((a, i) => list.appendChild(answerCard(a, i, r)));
  $("#result").replaceChildren(wrap);
}

function answerCard(a, i, r) {
  const el = document.createElement("div");
  el.className = "answer";
  const def = "refs";
  el.innerHTML = `
    <h3>Вопрос ${i + 1}. ${esc(a.question)}</h3>
    <div><span class="badge ${a.status}">${STATUS[a.status] || a.status}</span>
      <span class="badge">уверенность ${(a.confidence * 100).toFixed(0)}%</span>
      <span class="badge">${SOURCE[a.source] || a.source}</span></div>
    <div class="summary"><b>Кратко:</b> ${esc(a.summary)}</div>
    <div class="variants">${Object.entries(VARIANT).map(([k, v]) => `<button data-v="${k}" class="${k === def ? "active" : ""}">${v}</button>`).join("")}</div>
    <textarea rows="9" class="draft">${esc(a.variants[def])}</textarea>
    <div class="row">
      <button class="copy">Скопировать</button>
      <button class="approve primary">${r.requires_approval ? "Проверено, подтверждаю" : "Отметить как проверенный"}</button>
      <span class="state muted small"></span>
    </div>
    <details><summary>Самопроверка</summary>${checksHtml(a.checks)}</details>
    <details><summary>Источники (${a.citations.length})</summary>
      ${a.citations.map((c) => `<div class="small">• ${esc(c.text)}</div>`).join("") || '<div class="muted small">нет</div>'}</details>
    ${PERMS[me.role].includes("review") ? reviewForm(a) : ""}`;
  let variant = def;
  $$(".variants button", el).forEach((b) => b.addEventListener("click", () => {
    variant = b.dataset.v;
    $$(".variants button", el).forEach((x) => x.classList.toggle("active", x === b));
    $(".draft", el).value = a.variants[variant];
  }));
  $(".copy", el).addEventListener("click", async () => {
    try { await navigator.clipboard.writeText($(".draft", el).value); $(".state", el).textContent = "скопировано"; }
    catch (_) { $(".draft", el).select(); }
  });
  $(".approve", el).addEventListener("click", async () => {
    try {
      await api(`/api/answers/${a.id}/approve`, { method: "POST", body: { variant, text: $(".draft", el).value } });
      $(".state", el).textContent = `подтверждено: ${me.name}`;
    } catch (e) { $(".state", el).textContent = e.message; }
  });
  bindReview(el, a);
  return el;
}

function reviewForm(a) {
  return `<details class="review"><summary>Оценка валидатора</summary>
    <div class="row"><select class="verdict"><option value="correct">верно</option><option value="partial">частично</option><option value="incorrect">неверно</option></select>
      <input class="tags grow" placeholder="Теги ошибок через запятую (ссылка, цитата, смысл…)"></div>
    <textarea class="corrected" rows="4" placeholder="Исправленный ответ (станет эталоном)"></textarea>
    <input class="comment" placeholder="Комментарий" style="width:100%;margin-top:6px">
    <div class="row"><button class="send-review">Сохранить оценку</button><span class="rstate muted small"></span></div></details>`;
}

function bindReview(el, a) {
  const btn = $(".send-review", el);
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const body = { verdict: $(".verdict", el).value, corrected_text: $(".corrected", el).value || null,
      comment: $(".comment", el).value || null, error_tags: $(".tags", el).value.split(",").map((s) => s.trim()).filter(Boolean) };
    try { await api(`/api/answers/${a.id}/review`, { method: "POST", body }); $(".rstate", el).textContent = "сохранено"; }
    catch (e) { $(".rstate", el).textContent = e.message; }
  });
}

// ---------- проверка ----------
async function loadReview() {
  const [queue, report] = await Promise.all([api("/api/reviews/queue"), api("/api/quality/report")]);
  $("#queue").replaceChildren(...(queue.length ? queue.map((a, i) => answerCard(a, i, { requires_approval: a.kind === "complaint" })) : [Object.assign(document.createElement("p"), { className: "muted", textContent: "Очередь пуста" })]));
  const pct = (v) => v == null ? "—" : `${(v * 100).toFixed(0)}%`;
  $("#report").innerHTML = `<div class="table-wrap"><table>
    <tr><td>Проверено ответов</td><td>${report.reviewed}</td></tr>
    <tr><td>Доля подтверждённых</td><td>${pct(report.confirmed_share)}</td></tr>
    <tr><td>Вердикты</td><td>${esc(JSON.stringify(report.verdicts))}</td></tr>
    <tr><td>Частые ошибки</td><td>${report.frequent_errors.map(([t, n]) => `${esc(t)} (${n})`).join(", ") || "—"}</td></tr>
    <tr><td>Проблемные темы</td><td>${report.problem_topics.map(([t, n]) => `${esc(t)} (${n})`).join("<br>") || "—"}</td></tr>
    <tr><td>Расхождения самопроверки и человека</td><td>${report.self_check_vs_human_disagreements}</td></tr>
    <tr><td>Ответы по статусам</td><td>${esc(JSON.stringify(report.answers_by_status))}</td></tr>
    <tr><td>Последний регрессионный тест</td><td>${report.last_regression ? `${pct(report.last_regression.score)} (${report.last_regression.passed}/${report.last_regression.total})${report.last_regression.degraded ? " — ухудшение!" : ""}` : "—"}</td></tr>
  </table></div>`;
}

// ---------- FAQ ----------
async function loadFaq() {
  const items = await api("/api/faq");
  const canEdit = PERMS[me.role].includes("faq");
  $("#faq").innerHTML = items.length ? items.map((f) => `
    <div class="answer" data-id="${f.id}">
      <div><span class="badge ${f.status === "published" ? "ok" : f.status === "needs_revision" ? "caution" : ""}">${esc(f.status)}</span><span class="badge">повторов: ${f.frequency}</span></div>
      <div class="row"><textarea class="grow qru" rows="2" placeholder="Вопрос (рус.)" ${canEdit ? "" : "readonly"}>${esc(f.question_ru)}</textarea>
        <textarea class="grow qkk" rows="2" placeholder="Сұрақ (қаз.)" ${canEdit ? "" : "readonly"}>${esc(f.question_kk)}</textarea></div>
      <div class="row"><textarea class="grow aru" rows="5" placeholder="Ответ (рус.)" ${canEdit ? "" : "readonly"}>${esc(f.answer_ru)}</textarea>
        <textarea class="grow akk" rows="5" placeholder="Жауап (қаз.)" ${canEdit ? "" : "readonly"}>${esc(f.answer_kk)}</textarea></div>
      ${canEdit ? '<div class="row"><button class="pub primary">Подтвердить и опубликовать</button><button class="rej">Отклонить</button><span class="fstate muted small"></span></div>' : ""}
    </div>`).join("") : '<p class="muted">Пока нет вопросов. Кандидаты появятся после накопления повторяющихся обращений.</p>';
  $$("#faq .answer").forEach((el) => {
    $(".pub", el)?.addEventListener("click", async () => {
      try {
        await api(`/api/faq/${el.dataset.id}/publish`, { method: "POST", body: { question_ru: $(".qru", el).value, question_kk: $(".qkk", el).value, answer_ru: $(".aru", el).value, answer_kk: $(".akk", el).value } });
        loadFaq();
      } catch (e) { $(".fstate", el).textContent = e.message; }
    });
    $(".rej", el)?.addEventListener("click", async () => { await api(`/api/faq/${el.dataset.id}/reject`, { method: "POST" }); loadFaq(); });
  });
}

// ---------- база НПА ----------
async function loadDocs() {
  const docs = await api("/api/documents");
  $("#docs").innerHTML = `<div class="table-wrap"><table><tr><th>Код</th><th>Документ</th><th class="hide-sm">Орган</th><th>Статус</th><th>Редакций</th><th></th></tr>
    ${docs.map((d) => `<tr><td>${esc(d.code)}</td><td>${esc(d.title_ru)}<div class="muted small">${esc(d.title_kk)}</div></td><td class="hide-sm">${esc(d.organ)}</td><td>${esc(d.status)}</td><td>${d.editions}</td>
      <td><button class="link hist" data-code="${esc(d.code)}">история</button></td></tr><tr hidden><td colspan="6" class="hist-body"></td></tr>`).join("")}</table></div>`;
  $$("#docs .hist").forEach((b) => b.addEventListener("click", async () => {
    const tr = b.closest("tr").nextElementSibling;
    tr.hidden = !tr.hidden;
    if (tr.hidden) return;
    const eds = await api(`/api/documents/${encodeURIComponent(b.dataset.code)}/editions?lang=ru`);
    const keys = [...new Set(eds.map((e) => e.valid_from))];
    let html = `<div class="small">${eds.map((e) => `${esc(e.lang)}: редакция ${esc(e.edition_key)} — действует с ${esc(e.valid_from)}${e.valid_to ? ` по ${esc(e.valid_to)}` : " (текущая)"}`).join("<br>")}</div>`;
    if (keys.length > 1) {
      const diff = await api(`/api/documents/${encodeURIComponent(b.dataset.code)}/compare?lang=ru&date_a=${keys[keys.length - 2]}&date_b=${keys[keys.length - 1]}`);
      html += `<h3 style="margin-top:10px">Что изменилось (${esc(keys[keys.length - 2])} → ${esc(keys[keys.length - 1])})</h3>`
        + diff.changed.map((c) => `<div class="small"><b>${esc(c.label)}</b><br>было: ${esc(c.before)}<br>стало: ${esc(c.after)}</div>`).join("")
        + diff.added.map((c) => `<div class="small"><b>добавлено — ${esc(c.label)}</b>: ${esc(c.text)}</div>`).join("")
        + diff.removed.map((c) => `<div class="small"><b>исключено — ${esc(c.label)}</b>: ${esc(c.text)}</div>`).join("");
    }
    $(".hist-body", tr).innerHTML = html;
  }));
}

async function runSearch() {
  const q = $("#q").value.trim();
  if (!q) return;
  const params = new URLSearchParams({ q, lang: $("#q-lang").value });
  if ($("#q-date").value) params.set("as_of", $("#q-date").value);
  const hits = await api(`/api/search?${params}`);
  $("#hits").innerHTML = hits.map((h) => `<div class="answer"><b>${esc(h.title)}</b>, ${esc(h.label)} <span class="muted small">(ред. ${esc(h.edition_key)})</span><pre>${esc(h.text)}</pre>${h.pair ? `<details><summary>${h.pair.lang === "kk" ? "Қазақша" : "На русском"}</summary><pre>${esc(h.pair.text)}</pre></details>` : ""}</div>`).join("") || '<p class="muted">Ничего не найдено</p>';
}

// ---------- администрирование ----------
async function loadAdmin() {
  const s = await api("/api/admin/status");
  $("#admin-mode").value = s.mode;
  $("#status").innerHTML = `<div class="table-wrap"><table>
    <tr><td>Документов</td><td>${s.documents}</td></tr><tr><td>Действующих фрагментов</td><td>${s.fragments_active}</td></tr>
    <tr><td>Версия базы</td><td>${esc(s.kb_version)}</td></tr><tr><td>Модель</td><td>${esc(s.llm)}</td></tr>
    <tr><td>Последнее обновление</td><td>${s.last_update ? esc(JSON.stringify(s.last_update)) : "—"}</td></tr></table></div>`;
  $("#log").innerHTML = `<h3>Уведомления</h3>${s.notifications.map((n) => `<div class="small"><span class="badge ${n.level === "error" ? "escalate" : n.level === "warning" ? "caution" : "ok"}">${esc(n.level)}</span>${esc(n.at)} — ${esc(n.message)}</div>`).join("") || '<p class="muted small">нет</p>'}
    <h3 style="margin-top:12px">Журнал обновлений</h3><div class="table-wrap"><table>${s.update_log.map((l) => `<tr><td class="small">${esc(l.at)}</td><td>${esc(l.document_code)}</td><td>${esc(l.lang)}</td><td>${esc(l.event)}</td><td class="small muted">${esc((l.details || "").slice(0, 200))}</td></tr>`).join("")}</table></div>`;
}

async function adminAction(btn, fn) {
  btn.disabled = true;
  try { const r = await fn(); alert(JSON.stringify(r, null, 2).slice(0, 1500)); loadAdmin(); }
  catch (e) { alert(e.message); } finally { btn.disabled = false; }
}

// ---------- события ----------
$("#login-form").addEventListener("submit", (e) => { e.preventDefault(); login($("#token").value.trim()).catch((err) => alert(err.message)); });
$("#logout").addEventListener("click", logout);
$$("#tabs button").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
$("#run").addEventListener("click", runRequest);
$("#q-run").addEventListener("click", runSearch);
$("#faq-build").addEventListener("click", async () => { await api("/api/faq/build", { method: "POST" }); loadFaq(); });
$("#save-mode").addEventListener("click", (e) => adminAction(e.target, () => api("/api/admin/settings", { method: "POST", body: { mode: $("#admin-mode").value } })));
$("#run-update").addEventListener("click", (e) => adminAction(e.target, () => api("/api/admin/update", { method: "POST" })));
$("#run-regression").addEventListener("click", (e) => adminAction(e.target, () => api("/api/quality/regression", { method: "POST" })));

if (token) login(token).catch(logout); else logout();
