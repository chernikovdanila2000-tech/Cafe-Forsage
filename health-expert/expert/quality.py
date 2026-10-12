"""Проверка человеком, эталоны, отчёт по качеству и регрессионные тесты."""
from __future__ import annotations

import json
import sqlite3
from collections import Counter

from . import db

VERDICTS = {"correct", "incorrect", "partial"}


def review_queue(conn: sqlite3.Connection, limit: int = 50) -> list[dict]:
    """Сначала ответы с низкой оценкой самопроверки, затем случайная выборка остальных."""
    rows = conn.execute(
        "SELECT a.*, r.kind, r.created_at FROM answers a JOIN requests r ON r.id = a.request_id "
        "WHERE a.needs_review = 1 AND NOT EXISTS (SELECT 1 FROM reviews v WHERE v.answer_id = a.id) "
        "ORDER BY CASE a.status WHEN 'escalate' THEN 0 WHEN 'not_found' THEN 1 WHEN 'caution' THEN 2 ELSE 3 END, "
        "a.confidence ASC, a.id DESC LIMIT ?", (limit,)).fetchall()
    return [answer_row(r) for r in rows]


def answer_row(r: sqlite3.Row) -> dict:
    d = dict(r)
    for key in ("variants", "citations", "fragments", "checks"):
        d[key] = json.loads(d[key])
    return d


def submit_review(conn: sqlite3.Connection, answer_id: int, reviewer: str, verdict: str,
                  corrected_text: str | None = None, comment: str | None = None, error_tags: list[str] | None = None,
                  save_as_reference: bool = True) -> int:
    if verdict not in VERDICTS:
        raise ValueError(f"verdict должен быть одним из {sorted(VERDICTS)}")
    answer = conn.execute("SELECT * FROM answers WHERE id = ?", (answer_id,)).fetchone()
    if answer is None:
        raise KeyError(answer_id)
    cur = conn.execute(
        "INSERT INTO reviews(answer_id, reviewer, verdict, corrected_text, comment, error_tags, created_at) "
        "VALUES(?,?,?,?,?,?,?)", (answer_id, reviewer, verdict, corrected_text, comment,
                                  json.dumps(error_tags or [], ensure_ascii=False), db.now()))
    # Подтверждённый или исправленный ответ становится эталоном (приоритет при повторных вопросах).
    text = corrected_text or (json.loads(answer["variants"])["simple"] if verdict == "correct" else None)
    if save_as_reference and text:
        ids = [c["fragment_id"] for c in json.loads(answer["citations"])]
        keys = [[r["document_id"], r["path"]] for r in conn.execute(
            f"SELECT document_id, path FROM fragments WHERE id IN ({','.join('?' * len(ids))})", ids)] if ids else []
        conn.execute("INSERT INTO references_qa(question, lang, answer, fragment_keys, created_at) VALUES(?,?,?,?,?)",
                     (answer["question"], answer["lang"], text, json.dumps(keys), db.now()))
    db.audit(conn, reviewer, "validator", "review", answer_id, {"verdict": verdict})
    conn.commit()
    return cur.lastrowid


def report(conn: sqlite3.Connection, caution: float = 0.7) -> dict:
    rows = conn.execute(
        "SELECT v.verdict, v.error_tags, a.confidence, a.status, a.question, a.citations FROM reviews v "
        "JOIN answers a ON a.id = v.answer_id").fetchall()
    total = len(rows)
    verdicts = Counter(r["verdict"] for r in rows)
    tags = Counter(t for r in rows for t in json.loads(r["error_tags"]))
    topics = Counter()
    disagreements = []
    for r in rows:
        for c in json.loads(r["citations"]):
            if r["verdict"] != "correct":
                topics[c["title"]] += 1
        system_ok = r["confidence"] >= caution
        human_ok = r["verdict"] == "correct"
        if system_ok != human_ok:
            disagreements.append({"question": r["question"][:200], "confidence": r["confidence"],
                                  "verdict": r["verdict"]})
    answers = conn.execute("SELECT status, COUNT(*) AS n FROM answers GROUP BY status").fetchall()
    approved = conn.execute("SELECT COUNT(*) FROM answers WHERE approved_at IS NOT NULL").fetchone()[0]
    last_reg = conn.execute("SELECT * FROM regression_runs ORDER BY id DESC LIMIT 1").fetchone()
    return {
        "reviewed": total,
        "confirmed_share": round(verdicts["correct"] / total, 3) if total else None,
        "verdicts": dict(verdicts),
        "frequent_errors": tags.most_common(10),
        "problem_topics": topics.most_common(10),
        "self_check_vs_human_disagreements": len(disagreements),
        "disagreement_examples": disagreements[:10],
        "answers_by_status": {r["status"]: r["n"] for r in answers},
        "approved_by_operator": approved,
        "last_regression": dict(last_reg) if last_reg else None,
    }


def run_regression(conn: sqlite3.Connection, pipeline, reason: str = "manual", tolerance: float = 0.02) -> dict:
    """Прогон контрольного набора: найдена ли ожидаемая норма и попала ли она в ссылки ответа."""
    gold = conn.execute("SELECT * FROM gold_set").fetchall()
    details, passed = [], 0
    for g in gold:
        expected = {tuple(x) for x in json.loads(g["expected_paths"])}
        result = pipeline.answer_question(g["question"], g["lang"], _today(), "accurate")
        cited = {(c["code"], c["path"]) for c in result.citations}
        ok = bool(expected & cited) if expected else result.status == "not_found"
        passed += ok
        details.append({"id": g["id"], "ok": ok, "status": result.status, "confidence": result.confidence,
                        "cited": sorted(cited)})
    score = passed / len(gold) if gold else None
    prev = conn.execute("SELECT score FROM regression_runs WHERE score IS NOT NULL ORDER BY id DESC LIMIT 1").fetchone()
    previous = prev["score"] if prev else None
    degraded = previous is not None and score is not None and score < previous - tolerance
    conn.execute("INSERT INTO regression_runs(at, reason, total, passed, score, previous_score, degraded, details) "
                 "VALUES(?,?,?,?,?,?,?,?)", (db.now(), reason, len(gold), passed, score, previous, int(degraded),
                                              json.dumps(details, ensure_ascii=False)))
    if degraded:
        db.notify(conn, "error", f"Регрессия качества: {score:.0%} против {previous:.0%} ({reason})")
    conn.commit()
    return {"total": len(gold), "passed": passed, "score": score, "previous": previous, "degraded": degraded,
            "details": details}


def _today() -> str:
    from datetime import date
    return date.today().isoformat()
