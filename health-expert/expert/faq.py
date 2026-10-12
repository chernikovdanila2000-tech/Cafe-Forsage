"""Формирование FAQ: группировка повторяющихся вопросов, кандидаты, публикация после подтверждения."""
from __future__ import annotations

import json
import sqlite3

from . import db
from .vectors import HashingEmbedder


def build_candidates(conn: sqlite3.Connection, min_count: int = 3, similarity: float = 0.75) -> int:
    """Группирует вопросы с подтверждёнными (или высокоуверенными) ответами и создаёт кандидатов в FAQ."""
    rows = conn.execute(
        "SELECT a.id, a.question, a.lang, a.variants, a.citations FROM answers a "
        "LEFT JOIN reviews v ON v.answer_id = a.id "
        "WHERE a.status = 'ok' AND (v.verdict IS NULL OR v.verdict = 'correct') ORDER BY a.id").fetchall()
    if not rows:
        return 0
    emb = HashingEmbedder().embed([r["question"] for r in rows])
    clusters: list[list[int]] = []
    for i in range(len(rows)):
        for cluster in clusters:
            if float(emb[cluster[0]] @ emb[i]) >= similarity and rows[cluster[0]]["lang"] == rows[i]["lang"]:
                cluster.append(i)
                break
        else:
            clusters.append([i])

    existing = {q for r in conn.execute("SELECT question_ru, question_kk FROM faq") for q in r if q}
    created = 0
    for cluster in clusters:
        if len(cluster) < min_count:
            continue
        head = rows[cluster[0]]
        if head["question"] in existing:
            continue
        citations = json.loads(head["citations"])
        keys = [[r["document_id"], r["path"]] for r in conn.execute(
            f"SELECT document_id, path FROM fragments WHERE id IN ({','.join('?' * len(citations))})",
            [c["fragment_id"] for c in citations])] if citations else []
        lang = head["lang"]
        conn.execute(
            "INSERT INTO faq(status, question_ru, question_kk, answer_ru, answer_kk, fragment_keys, edition_keys, "
            "frequency, examples, updated_at) VALUES('candidate',?,?,?,?,?,?,?,?,?)",
            (head["question"] if lang == "ru" else None, head["question"] if lang == "kk" else None,
             json.loads(head["variants"])["refs"] if lang == "ru" else None,
             json.loads(head["variants"])["refs"] if lang == "kk" else None,
             json.dumps(keys), json.dumps([c["edition"] for c in citations]), len(cluster),
             json.dumps([rows[i]["question"] for i in cluster[:5]], ensure_ascii=False), db.now()))
        created += 1
    conn.commit()
    return created


def publish(conn: sqlite3.Connection, faq_id: int, approver: str, *, question_ru=None, question_kk=None,
            answer_ru=None, answer_kk=None) -> None:
    """Публикация только после подтверждения человеком; для публикации нужны обе языковые версии."""
    row = conn.execute("SELECT * FROM faq WHERE id = ?", (faq_id,)).fetchone()
    if row is None:
        raise KeyError(faq_id)
    values = {"question_ru": question_ru or row["question_ru"], "question_kk": question_kk or row["question_kk"],
              "answer_ru": answer_ru or row["answer_ru"], "answer_kk": answer_kk or row["answer_kk"]}
    missing = [k for k, v in values.items() if not v]
    if missing:
        raise ValueError(f"для публикации нужны обе языковые версии, не заполнено: {', '.join(missing)}")
    conn.execute("UPDATE faq SET status='published', question_ru=?, question_kk=?, answer_ru=?, answer_kk=?, "
                 "approved_by=?, updated_at=? WHERE id=?",
                 (*values.values(), approver, db.now(), faq_id))
    db.audit(conn, approver, "validator", "faq_publish", faq_id)
    conn.commit()


def reject(conn: sqlite3.Connection, faq_id: int, user: str) -> None:
    conn.execute("UPDATE faq SET status='rejected', updated_at=? WHERE id=?", (db.now(), faq_id))
    db.audit(conn, user, "validator", "faq_reject", faq_id)
    conn.commit()
