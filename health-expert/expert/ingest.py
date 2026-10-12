"""Загрузка документов в базу: новые редакции, история, утрата силы, переиндексация только изменённого."""
from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from datetime import date

from . import db
from .parsing.adilet import ParsedDocument
from .parsing.structure import split_structure, text_hash


@dataclass
class IngestResult:
    event: str                 # new | changed | unchanged | repealed
    edition_id: int | None
    changed_paths: list[str]
    reindexed: int


def _fts_add(conn: sqlite3.Connection, frag_id: int, text: str, label: str, title: str) -> None:
    conn.execute("INSERT INTO fragments_fts(rowid, text, label, title) VALUES(?,?,?,?)",
                 (frag_id, text, label, title))


def _fts_remove(conn: sqlite3.Connection, frag_id: int) -> None:
    conn.execute("DELETE FROM fragments_fts WHERE rowid = ?", (frag_id,))


def _document_id(conn, doc: ParsedDocument, source: str, organ: str | None, block: str | None) -> int:
    row = conn.execute("SELECT id FROM documents WHERE code = ?", (doc.code,)).fetchone()
    if row:
        if organ or block:
            conn.execute("UPDATE documents SET organ = COALESCE(?, organ), block = COALESCE(?, block) WHERE id = ?",
                         (organ, block, row["id"]))
        return row["id"]
    cur = conn.execute("INSERT INTO documents(source, code, organ, block, status, created_at) VALUES(?,?,?,?,?,?)",
                       (source, doc.code, organ, block, doc.status, db.now()))
    return cur.lastrowid


def ingest(conn: sqlite3.Connection, doc: ParsedDocument, *, source: str = "adilet", organ: str | None = None,
           block: str | None = None, valid_from: str | None = None) -> IngestResult:
    """Сохраняет документ. Если текст изменился — создаётся новая редакция, прежняя закрывается датой."""
    valid_from = valid_from or doc.edition_key or date.today().isoformat()
    edition_key = doc.edition_key or valid_from
    doc_id = _document_id(conn, doc, source, organ, block)
    full_hash = text_hash(doc.title + "\n" + doc.text)

    current = conn.execute(
        "SELECT * FROM editions WHERE document_id = ? AND lang = ? AND valid_to IS NULL "
        "ORDER BY valid_from DESC LIMIT 1", (doc_id, doc.lang)).fetchone()

    if current and current["content_hash"] == full_hash:
        if doc.status != current["status"]:
            return _change_status(conn, doc, doc_id, current, valid_from)
        _log(conn, doc, "unchanged")
        return IngestResult("unchanged", current["id"], [], 0)

    fragments = split_structure(doc.text, doc.lang)
    cur = conn.execute(
        "INSERT INTO editions(document_id, lang, edition_key, title, number, doc_date, organ, status, valid_from, "
        "url, content_hash, related, fetched_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) "
        "ON CONFLICT(document_id, lang, edition_key) DO UPDATE SET title=excluded.title, "
        "content_hash=excluded.content_hash, status=excluded.status, fetched_at=excluded.fetched_at RETURNING id",
        (doc_id, doc.lang, edition_key, doc.title, doc.number, doc.doc_date, organ or doc.organ, doc.status,
         valid_from, doc.url, full_hash, json.dumps(doc.related), db.now()))
    edition_id = cur.fetchone()["id"]

    same_edition = current is not None and current["id"] == edition_id
    if current and not same_edition:
        conn.execute("UPDATE editions SET valid_to = ? WHERE id = ?", (valid_from, current["id"]))
    source_edition = current["id"] if current else edition_id
    old: dict[str, sqlite3.Row] = {r["path"]: r for r in conn.execute(
        "SELECT * FROM fragments WHERE edition_id = ? AND valid_to IS NULL", (source_edition,))}

    def retire(prev: sqlite3.Row) -> None:
        if same_edition:
            # Исправление в пределах той же редакции (тот же день): прежний текст не является историей.
            _fts_remove(conn, prev["id"])
            conn.execute("DELETE FROM fragments WHERE id = ?", (prev["id"],))
        else:
            # Прежняя редакция пункта остаётся в индексе: поиск «на дату» фильтрует по сроку действия.
            conn.execute("UPDATE fragments SET valid_to = ? WHERE id = ?", (valid_from, prev["id"]))

    changed: list[str] = []
    reindexed = 0
    new_paths = set()
    for frag in fragments:
        new_paths.add(frag.path)
        prev = old.get(frag.path)
        if prev is not None and prev["hash"] == frag.hash:
            # Норма не изменилась: переносим фрагмент в новую редакцию без переиндексации.
            conn.execute("UPDATE fragments SET edition_id = ? WHERE id = ?", (edition_id, prev["id"]))
            continue
        if prev is not None:
            retire(prev)
        cur = conn.execute(
            "INSERT INTO fragments(edition_id, document_id, lang, path, label, text, hash, valid_from, status) "
            "VALUES(?,?,?,?,?,?,?,?,?)",
            (edition_id, doc_id, doc.lang, frag.path, frag.label, frag.text, frag.hash, valid_from, doc.status))
        _fts_add(conn, cur.lastrowid, frag.text, frag.label, doc.title)
        reindexed += 1
        changed.append(frag.path)
    for path, prev in old.items():
        if path not in new_paths:  # пункт исключён из документа
            retire(prev)
            changed.append(path)

    conn.execute("UPDATE documents SET status = ? WHERE id = ?", (doc.status, doc_id))
    event = "changed" if current else "new"
    _log(conn, doc, event, {"edition": edition_key, "changed": changed[:50], "count": len(changed)})
    if reindexed or changed:
        db.bump_kb_version(conn)
    if current:
        mark_dependents_stale(conn, doc_id, changed)
    return IngestResult(event, edition_id, changed, reindexed)


def _change_status(conn, doc, doc_id, current, valid_from) -> IngestResult:
    conn.execute("UPDATE editions SET status = ? WHERE id = ?", (doc.status, current["id"]))
    conn.execute("UPDATE fragments SET status = ? WHERE edition_id = ?", (doc.status, current["id"]))
    conn.execute("UPDATE documents SET status = ? WHERE id = ?", (doc.status, doc_id))
    if doc.status == "repealed":
        conn.execute("UPDATE editions SET valid_to = ? WHERE id = ?", (valid_from, current["id"]))
        conn.execute("UPDATE fragments SET valid_to = ? WHERE edition_id = ? AND valid_to IS NULL",
                     (valid_from, current["id"]))
    paths = [r["path"] for r in conn.execute("SELECT path FROM fragments WHERE edition_id = ?", (current["id"],))]
    mark_dependents_stale(conn, doc_id, paths)
    db.bump_kb_version(conn)
    _log(conn, doc, "repealed" if doc.status == "repealed" else "status", {"status": doc.status})
    return IngestResult("repealed" if doc.status == "repealed" else "changed", current["id"], paths, 0)


def mark_dependents_stale(conn: sqlite3.Connection, doc_id: int, paths: list[str]) -> None:
    """Эталоны и FAQ, опирающиеся на изменённые нормы, отправляются на пересмотр."""
    if not paths:
        return
    keys = {(doc_id, p) for p in paths}
    for row in conn.execute("SELECT id, fragment_keys FROM references_qa WHERE stale = 0").fetchall():
        if keys & {tuple(k) for k in json.loads(row["fragment_keys"])}:
            conn.execute("UPDATE references_qa SET stale = 1 WHERE id = ?", (row["id"],))
    for row in conn.execute("SELECT id, fragment_keys FROM faq WHERE status = 'published'").fetchall():
        if keys & {tuple(k) for k in json.loads(row["fragment_keys"])}:
            conn.execute("UPDATE faq SET status = 'needs_revision', updated_at = ? WHERE id = ?", (db.now(), row["id"]))
            db.notify(conn, "warning", f"FAQ #{row['id']}: изменилась норма, требуется пересмотр")


def _log(conn, doc: ParsedDocument, event: str, details=None) -> None:
    conn.execute("INSERT INTO update_log(at, document_code, lang, event, details) VALUES(?,?,?,?,?)",
                 (db.now(), doc.code, doc.lang, event, json.dumps(details or {}, ensure_ascii=False)))
