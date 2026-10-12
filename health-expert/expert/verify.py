"""Самопроверка ответа до показа оператору: ссылки, цитаты, обоснованность, сверка языков, уверенность."""
from __future__ import annotations

import re
import sqlite3

from .search import fragment_at

_QUOTES = str.maketrans({"«": '"', "»": '"', "“": '"', "”": '"', "„": '"', "–": "-", "—": "-", " ": " "})


def norm_text(text: str) -> str:
    return re.sub(r"\s+", " ", text.translate(_QUOTES)).strip()


def check_refs(conn: sqlite3.Connection, fragment_ids: list[int], retrieved: set[int], as_of: str) -> dict:
    """Каждая ссылка существует, действует на дату ответа и была среди найденных норм."""
    problems = []
    for fid in fragment_ids:
        row = conn.execute("SELECT document_id, path, lang, status FROM fragments WHERE id = ?", (fid,)).fetchone()
        if row is None:
            problems.append({"fragment_id": fid, "problem": "фрагмент не существует"})
            continue
        if fid not in retrieved:
            problems.append({"fragment_id": fid, "problem": "ссылка не входит в найденные нормы"})
        current = fragment_at(conn, row["document_id"], row["path"], row["lang"], as_of)
        if current is None or current.fragment_id != fid:
            problems.append({"fragment_id": fid, "problem": f"норма не действует в этой редакции на {as_of}"})
        elif row["status"] == "repealed":
            problems.append({"fragment_id": fid, "problem": "документ утратил силу"})
    total = len(fragment_ids)
    return {"ok": not problems, "score": 1.0 if not total else 1 - len({p["fragment_id"] for p in problems}) / total,
            "total": total, "problems": problems}


def check_quotes(conn: sqlite3.Connection, points: list[dict], lang: str) -> dict:
    """Цитата должна дословно совпадать с текстом нормы на языке ответа."""
    results, checked = [], 0
    for i, p in enumerate(points):
        quote = (p.get("quote") or "").strip()
        if not quote or not p.get("fragment_ids"):
            results.append({"point": i, "ok": None, "problem": "цитата отсутствует"})
            continue
        checked += 1
        row = conn.execute("SELECT text, lang FROM fragments WHERE id = ?", (p["fragment_ids"][0],)).fetchone()
        if row is None:
            results.append({"point": i, "ok": False, "problem": "фрагмент не найден"})
        elif row["lang"] != lang:
            results.append({"point": i, "ok": False, "problem": "цитата не на языке ответа"})
        elif norm_text(quote) not in norm_text(row["text"]):
            results.append({"point": i, "ok": False, "problem": "цитата не совпадает с текстом НПА"})
        else:
            results.append({"point": i, "ok": True})
    bad = sum(1 for r in results if r["ok"] is False)
    return {"ok": bad == 0, "score": 1.0 if not checked else 1 - bad / checked, "checked": checked, "items": results}


def check_bilingual(conn: sqlite3.Connection, fragment_ids: list[int], as_of: str) -> dict:
    """У каждой нормы, на которую ссылается ответ, есть действующая версия на втором языке той же редакции."""
    problems = []
    for fid in fragment_ids:
        row = conn.execute(
            "SELECT f.document_id, f.path, f.lang, e.edition_key FROM fragments f JOIN editions e ON e.id = f.edition_id "
            "WHERE f.id = ?", (fid,)).fetchone()
        if row is None:
            continue
        other = "kk" if row["lang"] == "ru" else "ru"
        pair = fragment_at(conn, row["document_id"], row["path"], other, as_of)
        if pair is None:
            problems.append({"fragment_id": fid, "problem": f"нет действующей версии на языке {other}"})
        elif pair.edition_key != row["edition_key"]:
            problems.append({"fragment_id": fid, "problem": "редакции на двух языках различаются",
                             "editions": [row["edition_key"], pair.edition_key]})
    total = len(fragment_ids)
    return {"ok": not problems, "score": 1.0 if not total else 1 - len(problems) / total, "problems": problems}


def summarize_grounding(results: list[dict] | None) -> dict:
    if results is None:
        return {"ok": None, "score": None, "items": [], "note": "не выполнялась (быстрый режим)"}
    supported = sum(1 for r in results if r["supported"])
    return {"ok": supported == len(results), "score": supported / len(results) if results else 1.0, "items": results}


def confidence(checks: dict, retrieval: float, extractive: bool) -> float:
    """Итоговая оценка 0..1 по результатам проверок.

    Вес обоснованности самый высокий; если она не проверялась, засчитывается осторожное значение 0.75.
    """
    grounding = checks["grounding"]["score"]
    grounding = 0.75 if grounding is None else grounding
    score = (0.35 * grounding + 0.25 * checks["refs"]["score"] + 0.15 * checks["quotes"]["score"]
             + 0.10 * checks["bilingual"]["score"] + 0.15 * retrieval)
    if not checks["refs"]["ok"]:
        score = min(score, 0.6)          # недействительная ссылка — не выше «осторожно»
    if checks["grounding"]["ok"] is False:
        score = min(score, 0.65)
    if extractive:
        score = min(score, 0.65)         # без модели ответ — подборка выдержек: всегда «требует осторожности»
    return round(max(0.0, min(1.0, score)), 3)
