"""История редакций: список, сравнение, выбор редакции «на дату»."""
from __future__ import annotations

import difflib
import sqlite3


def editions(conn: sqlite3.Connection, code: str, lang: str | None = None) -> list[dict]:
    q = ("SELECT e.id, e.lang, e.edition_key, e.title, e.number, e.doc_date, e.status, e.valid_from, e.valid_to, e.url "
         "FROM editions e JOIN documents d ON d.id = e.document_id WHERE d.code = ?")
    args: list = [code]
    if lang:
        q += " AND e.lang = ?"
        args.append(lang)
    return [dict(r) for r in conn.execute(q + " ORDER BY e.valid_from, e.lang", args)]


def fragments_as_of(conn: sqlite3.Connection, document_id: int, lang: str, as_of: str) -> dict[str, sqlite3.Row]:
    rows = conn.execute(
        "SELECT * FROM fragments WHERE document_id = ? AND lang = ? AND valid_from <= ? "
        "AND (valid_to IS NULL OR valid_to > ?)", (document_id, lang, as_of, as_of))
    return {r["path"]: r for r in rows}


def edition_as_of(conn: sqlite3.Connection, document_id: int, lang: str, as_of: str):
    return conn.execute(
        "SELECT * FROM editions WHERE document_id = ? AND lang = ? AND valid_from <= ? "
        "AND (valid_to IS NULL OR valid_to > ?) ORDER BY valid_from DESC LIMIT 1",
        (document_id, lang, as_of, as_of)).fetchone()


def compare(conn: sqlite3.Connection, code: str, lang: str, date_a: str, date_b: str) -> dict:
    """Что изменилось между состояниями документа на две даты (по пунктам)."""
    doc = conn.execute("SELECT id FROM documents WHERE code = ?", (code,)).fetchone()
    if not doc:
        raise KeyError(code)
    a = fragments_as_of(conn, doc["id"], lang, date_a)
    b = fragments_as_of(conn, doc["id"], lang, date_b)
    result = {"added": [], "removed": [], "changed": []}
    for path in sorted(set(a) | set(b)):
        if path not in a:
            result["added"].append({"path": path, "label": b[path]["label"], "text": b[path]["text"]})
        elif path not in b:
            result["removed"].append({"path": path, "label": a[path]["label"], "text": a[path]["text"]})
        elif a[path]["hash"] != b[path]["hash"]:
            diff = difflib.unified_diff(a[path]["text"].split(), b[path]["text"].split(), lineterm="", n=3)
            result["changed"].append({"path": path, "label": b[path]["label"],
                                      "before": a[path]["text"], "after": b[path]["text"],
                                      "diff": " ".join(list(diff)[2:])})
    return result
