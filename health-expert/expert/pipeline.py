"""Основной сценарий: обращение -> резюме, тип, вопросы -> по каждому вопросу черновик с проверкой."""
from __future__ import annotations

import json
import random
import sqlite3
from dataclasses import dataclass, field
from datetime import date

import numpy as np

from . import db, verify
from .anonymize import contains_pii, mask
from .lang import detect_language
from .llm import LLMError
from .llm.offline import OfflineLLM
from .search import Hit, Searcher, fragment_at, query_terms
from .vectors import VectorIndex

VARIANTS = ("simple", "refs", "quotes")

MESSAGES = {
    "ru": {
        "not_found": "Норма, отвечающая на этот вопрос, в базе НПА не найдена. Рекомендуется передать вопрос "
                     "коллеге или эксперту.",
        "escalate": "Уверенность системы недостаточна: черновик не сформирован, вопрос передаётся эксперту.",
        "degraded": "Языковая модель недоступна. Ниже приведены найденные нормы — подготовьте ответ вручную.",
        "sources": "Источники",
        "edition": "ред. от {}",
    },
    "kk": {
        "not_found": "Бұл сұраққа жауап беретін норма НҚА базасынан табылмады. Сұрақты әріптеске немесе "
                     "сарапшыға беру ұсынылады.",
        "escalate": "Жүйенің сенімділігі жеткіліксіз: жоба жасалмады, сұрақ сарапшыға беріледі.",
        "degraded": "Тілдік модель қолжетімсіз. Төменде табылған нормалар келтірілген — жауапты қолмен дайындаңыз.",
        "sources": "Дереккөздер",
        "edition": "{} редакциясы",
    },
}


def citation_text(hit: Hit | dict, lang: str) -> str:
    h = hit if isinstance(hit, dict) else hit.as_dict()
    parts = [h["title"]]
    if h.get("number") and h["number"] not in h["title"]:
        parts.append(f"№ {h['number']}")
    return f"{' '.join(parts)}, {h['label']} ({MESSAGES[lang]['edition'].format(h['edition_key'])})"


@dataclass
class QuestionResult:
    question: str
    lang: str
    summary: str
    variants: dict
    citations: list[dict]
    fragments: list[dict]
    checks: dict
    confidence: float
    status: str
    source: str
    needs_review: bool
    fragment_keys: list = field(default_factory=list)

    def as_dict(self) -> dict:
        return {k: getattr(self, k) for k in self.__dataclass_fields__}


class Pipeline:
    def __init__(self, conn: sqlite3.Connection, settings, llm, vectors: VectorIndex | None = None):
        self.conn = conn
        self.settings = settings
        self.llm = llm
        self.offline = OfflineLLM()
        self.vectors = vectors or VectorIndex(conn)
        self.searcher = Searcher(conn, self.vectors)
        self.rng = random.Random()

    # ---------- обращение целиком ----------
    def process(self, text: str, *, user: str | None = None, lang: str | None = None, mode: str | None = None,
                as_of: str | None = None) -> dict:
        as_of = as_of or date.today().isoformat()
        mode = mode or db.kv_get(self.conn, "mode", self.settings.get("mode", "default", "fast"))
        lang = lang or detect_language(text)
        masked = mask(text)
        if contains_pii(masked.text):
            raise ValueError("обезличивание не удалось: в тексте остались персональные данные")

        degraded = False
        try:
            analysis = self.llm.analyze(masked.text, lang)
        except LLMError:
            analysis, degraded = self.offline.analyze(masked.text, lang), True
        questions = [q for q in analysis["questions"] if q.strip()][:10] or [masked.text]

        results = [self.answer_question(q, lang, as_of, mode, kind=analysis["kind"]) for q in questions]

        cur = self.conn.execute(
            "INSERT INTO requests(created_at, user_name, lang, kind, masked_text, summary, mode, as_of, kb_version) "
            "VALUES(?,?,?,?,?,?,?,?,?)",
            (db.now(), user, lang, analysis["kind"], masked.text, analysis["summary"], mode, as_of,
             db.kb_version(self.conn)))
        request_id = cur.lastrowid
        answers = []
        for pos, r in enumerate(results):
            cur = self.conn.execute(
                "INSERT INTO answers(request_id, position, question, lang, summary, variants, citations, fragments, "
                "checks, confidence, status, source, needs_review) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (request_id, pos, r.question, r.lang, r.summary, _j(r.variants), _j(r.citations),
                 _j([f["id"] for f in r.fragments]), _j(r.checks), r.confidence, r.status, r.source,
                 int(r.needs_review)))
            answers.append({"id": cur.lastrowid, **r.as_dict()})
        db.audit(self.conn, user, None, "process_request", request_id,
                 {"questions": len(results), "mode": mode, "llm": self.llm.name, "degraded": degraded})
        self.conn.commit()

        # Обратная подстановка ПДн выполняется только в ответе оператору; в базе хранится обезличенный текст.
        restore = masked.restore
        return {
            "request_id": request_id, "lang": lang, "kind": analysis["kind"], "mode": mode, "as_of": as_of,
            "kb_version": db.kb_version(self.conn), "summary": restore(analysis["summary"]),
            "masked_text": masked.text, "degraded": degraded,
            "requires_approval": analysis["kind"] == "complaint",
            "answers": [_restore_answer(a, restore) for a in answers],
        }

    # ---------- один вопрос ----------
    def answer_question(self, question: str, lang: str, as_of: str, mode: str, kind: str = "consultation") -> QuestionResult:
        deep = mode == "accurate" or self._is_complex(question, kind)
        if mode == "fast":
            cached = self._from_reference(question, lang, as_of)
            if cached:
                return cached

        k = self.settings.get("mode", "accurate_top_k" if deep else "fast_top_k", 5)
        hits = self.searcher.search(question, lang, as_of, k=k)
        if not hits:
            return self._not_found(question, lang)

        frags = [_frag(h) for h in hits]
        extractive = False
        try:
            draft = self.llm.draft(question, lang, frags, effort="high" if deep else "low")
        except LLMError:
            return self._degraded(question, lang, hits)
        if self.llm.name.startswith("offline"):
            extractive = True
        if draft["not_found"] or not draft["points"]:
            return self._not_found(question, lang, frags)

        by_id = {h.fragment_id: h for h in hits}
        retrieved = set(by_id)
        cited_ids = list(dict.fromkeys(fid for p in draft["points"] for fid in p["fragment_ids"]))

        checks = {
            "refs": verify.check_refs(self.conn, cited_ids, retrieved, as_of),
            "quotes": verify.check_quotes(self.conn, draft["points"], lang),
            "bilingual": verify.check_bilingual(self.conn, cited_ids, as_of),
            "grounding": verify.summarize_grounding(None),
            "depth": "deep" if deep else "light",
        }
        if deep:
            statements = [p["statement"] for p in draft["points"]]
            cited = [f for f in frags if f["id"] in cited_ids]
            pairs = [f["pair"] for f in cited if f.get("pair")]
            try:
                checks["grounding"] = verify.summarize_grounding(
                    self.llm.check_grounding(statements, cited, lang))
                if pairs:
                    # Сверка языков: утверждения должны следовать и из версии нормы на втором языке.
                    other = verify.summarize_grounding(self.llm.check_grounding(statements, pairs, lang))
                    checks["bilingual"]["cross_grounding"] = other
                    if other["ok"] is False:
                        checks["bilingual"]["ok"] = False
                        checks["bilingual"]["score"] = min(checks["bilingual"]["score"], other["score"])
            except LLMError as e:
                checks["grounding"] = {"ok": None, "score": None, "items": [], "note": f"не выполнена: {e}"}

        retrieval = _retrieval_strength(question, [by_id[i] for i in cited_ids if i in by_id])
        conf = verify.confidence(checks, retrieval, extractive)
        status = self._status(conf)

        # Ссылки формирует система по метаданным фрагмента, а не модель: реквизиты не могут быть выдуманы.
        valid_points = [p for p in draft["points"] if all(fid in by_id for fid in p["fragment_ids"])]
        quote_ok = {item["point"]: item["ok"] for item in checks["quotes"]["items"]}
        citations = [_citation(by_id[fid], lang) for fid in cited_ids if fid in by_id]
        variants = self._render(draft, valid_points, by_id, quote_ok, lang, status)
        needs_review = status != "ok" or self.rng.random() < self.settings.get("review", "sample_rate", 0.1)
        return QuestionResult(question, lang, draft["summary"] if status != "escalate" else MESSAGES[lang]["escalate"],
                              variants, citations, frags, checks, conf, status, "generated", needs_review,
                              [[by_id[i].document_id, by_id[i].path] for i in cited_ids if i in by_id])

    def _is_complex(self, question: str, kind: str) -> bool:
        return kind == "complaint" or len(question) > 300 or len(query_terms(question)) > 14

    def _status(self, conf: float) -> str:
        if conf < self.settings.get("confidence", "escalate", 0.45):
            return "escalate"
        if conf < self.settings.get("confidence", "caution", 0.7):
            return "caution"
        return "ok"

    def _render(self, draft, points, by_id, quote_ok, lang, status) -> dict:
        if status == "escalate":
            msg = MESSAGES[lang]["escalate"]
            return {v: msg for v in VARIANTS}
        refs_lines, quote_lines, sources = [], [], []
        for i, p in enumerate(points):
            cites = [citation_text(by_id[fid], lang) for fid in p["fragment_ids"]]
            for c in cites:
                if c not in sources:
                    sources.append(c)
            refs_lines.append(f"{p['statement']} ({'; '.join(cites)})")
            line = f"{p['statement']} ({'; '.join(cites)})"
            if p.get("quote") and quote_ok.get(draft["points"].index(p)) is True:
                line += f"\n«{p['quote'].strip()}»"
            quote_lines.append(line)
        tail = f"\n\n{MESSAGES[lang]['sources']}:\n" + "\n".join(f"- {s}" for s in sources)
        return {"simple": draft["simple"], "refs": "\n\n".join(refs_lines) + tail,
                "quotes": "\n\n".join(quote_lines) + tail}

    def _not_found(self, question: str, lang: str, frags: list[dict] | None = None) -> QuestionResult:
        msg = MESSAGES[lang]["not_found"]
        checks = {"refs": {"ok": True, "score": 0}, "quotes": {"ok": True, "score": 0},
                  "bilingual": {"ok": True, "score": 0}, "grounding": {"ok": None, "score": None}}
        return QuestionResult(question, lang, msg, {v: msg for v in VARIANTS}, [], frags or [], checks, 0.0,
                              "not_found", "generated", True)

    def _degraded(self, question: str, lang: str, hits: list[Hit]) -> QuestionResult:
        lines = [f"{citation_text(h, lang)}\n«{h.text}»" for h in hits[:5]]
        body = MESSAGES[lang]["degraded"] + "\n\n" + "\n\n".join(lines)
        checks = {"refs": {"ok": True, "score": 1}, "quotes": {"ok": True, "score": 1},
                  "bilingual": {"ok": None, "score": None}, "grounding": {"ok": None, "score": None},
                  "note": "модель недоступна"}
        return QuestionResult(question, lang, MESSAGES[lang]["degraded"], {v: body for v in VARIANTS},
                              [_citation(h, lang) for h in hits[:5]], [_frag(h) for h in hits], checks, 0.0,
                              "caution", "degraded", True)

    # ---------- эталоны и FAQ ----------
    def _from_reference(self, question: str, lang: str, as_of: str) -> QuestionResult | None:
        threshold = self.settings.get("mode", "reference_reuse_similarity", 0.82)
        rows = self.conn.execute("SELECT * FROM references_qa WHERE stale = 0 AND lang = ?", (lang,)).fetchall()
        faq_col = "question_ru" if lang == "ru" else "question_kk"
        ans_col = "answer_ru" if lang == "ru" else "answer_kk"
        faq = self.conn.execute(f"SELECT id, {faq_col} AS question, {ans_col} AS answer, fragment_keys FROM faq "
                                f"WHERE status = 'published' AND {faq_col} IS NOT NULL").fetchall()
        candidates = [("reference", r["question"], r["answer"], r["fragment_keys"]) for r in rows] + \
                     [("faq", r["question"], r["answer"], r["fragment_keys"]) for r in faq]
        if not candidates:
            return None
        emb = self.vectors.embedder.embed([question] + [c[1] for c in candidates])
        sims = emb[1:] @ emb[0]
        best = int(np.argmax(sims))
        if sims[best] < threshold:
            return None
        source, _, answer, keys = candidates[best]
        hits = []
        for doc_id, path in json.loads(keys):
            hit = fragment_at(self.conn, doc_id, path, lang, as_of)
            if hit is None:
                return None  # норма изменилась или не действует на дату — эталон не используется
            hits.append(hit)
        citations = [_citation(h, lang) for h in hits]
        sources = "\n".join(f"- {citation_text(h, lang)}" for h in hits)
        refs = f"{answer}\n\n{MESSAGES[lang]['sources']}:\n{sources}" if hits else answer
        quotes = refs + ("\n\n" + "\n".join(f"«{h.text}»" for h in hits) if hits else "")
        checks = {"refs": {"ok": True, "score": 1.0}, "quotes": {"ok": True, "score": 1.0},
                  "bilingual": verify.check_bilingual(self.conn, [h.fragment_id for h in hits], as_of),
                  "grounding": {"ok": True, "score": 1.0, "note": f"подтверждено человеком ({source})"},
                  "similarity": round(float(sims[best]), 3)}
        return QuestionResult(question, lang, answer.split("\n")[0][:300], {"simple": answer, "refs": refs,
                              "quotes": quotes}, citations, [_frag(h) for h in hits], checks, 0.95, "ok", source,
                              False, json.loads(keys))


def _frag(h: Hit) -> dict:
    return {"id": h.fragment_id, "lang": h.lang, "title": h.title, "label": h.label, "text": h.text,
            "edition_key": h.edition_key, "code": h.code, "path": h.path, "pair": _pair_frag(h.pair)}


def _pair_frag(pair: dict | None) -> dict | None:
    if not pair:
        return None
    return {"id": pair["fragment_id"], "lang": pair["lang"], "title": pair["title"], "label": pair["label"],
            "text": pair["text"], "edition_key": pair["edition_key"]}


def _citation(h: Hit, lang: str) -> dict:
    return {"fragment_id": h.fragment_id, "code": h.code, "title": h.title, "number": h.number,
            "doc_date": h.doc_date, "label": h.label, "path": h.path, "edition": h.edition_key, "lang": h.lang,
            "text": citation_text(h, lang)}


def _retrieval_strength(question: str, hits: list[Hit]) -> float:
    terms = query_terms(question)
    if not terms or not hits:
        return 0.0
    text = " ".join(h.text.lower() for h in hits)
    return sum(1 for t in terms if t in text) / len(terms)


def _restore_answer(a: dict, restore) -> dict:
    a = dict(a)
    a["question"] = restore(a["question"])
    a["summary"] = restore(a["summary"])
    a["variants"] = {k: restore(v) for k, v in a["variants"].items()}
    return a


def _j(value) -> str:
    return json.dumps(value, ensure_ascii=False)
