"""Хранилище: документы, редакции, фрагменты, индекс, журналы, ответы, проверки, FAQ.

SQLite выбран для MVP (локально, без внешних зависимостей). Схема переносится на PostgreSQL
без изменения логики: полнотекстовый индекс FTS5 заменяется на tsvector/pgvector.
"""
from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY,
    source TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,          -- код документа в источнике, общий для ru/kk
    organ TEXT,
    block TEXT,                          -- health | social | fsms | other
    status TEXT NOT NULL DEFAULT 'active', -- active | repealed
    created_at TEXT NOT NULL
);

-- Редакция документа на конкретном языке. Версии ru/kk связаны через edition_key.
CREATE TABLE IF NOT EXISTS editions (
    id INTEGER PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES documents(id),
    lang TEXT NOT NULL,                  -- ru | kk
    edition_key TEXT NOT NULL,           -- идентификатор редакции (обычно дата), общий для языков
    title TEXT NOT NULL,
    number TEXT,
    doc_date TEXT,
    organ TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    valid_from TEXT NOT NULL,
    valid_to TEXT,                       -- NULL — действует
    url TEXT,
    content_hash TEXT NOT NULL,
    related TEXT NOT NULL DEFAULT '[]',  -- JSON: ссылки на связанные акты
    fetched_at TEXT NOT NULL,
    UNIQUE(document_id, lang, edition_key)
);

-- Структурный фрагмент (статья/пункт) редакции.
CREATE TABLE IF NOT EXISTS fragments (
    id INTEGER PRIMARY KEY,
    edition_id INTEGER NOT NULL REFERENCES editions(id),
    document_id INTEGER NOT NULL,
    lang TEXT NOT NULL,
    path TEXT NOT NULL,                  -- нормализованный адрес: "ch:2/art:7/p:3"
    label TEXT NOT NULL,                 -- человекочитаемо: "Глава 2, статья 7, пункт 3"
    text TEXT NOT NULL,
    hash TEXT NOT NULL,
    valid_from TEXT NOT NULL,
    valid_to TEXT,
    status TEXT NOT NULL,
    UNIQUE(edition_id, path)
);
CREATE INDEX IF NOT EXISTS ix_fragments_doc_path ON fragments(document_id, path, lang);

CREATE VIRTUAL TABLE IF NOT EXISTS fragments_fts USING fts5(
    text, label, title, content='', contentless_delete=1, tokenize='unicode61 remove_diacritics 2'
);

CREATE TABLE IF NOT EXISTS update_log (
    id INTEGER PRIMARY KEY,
    at TEXT NOT NULL,
    document_code TEXT,
    lang TEXT,
    event TEXT NOT NULL,                 -- new | changed | unchanged | repealed | error
    details TEXT
);

CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY,
    created_at TEXT NOT NULL,
    user_name TEXT,
    lang TEXT NOT NULL,
    kind TEXT NOT NULL,                  -- consultation | complaint | other
    masked_text TEXT NOT NULL,           -- обезличенный текст; исходный текст не хранится
    summary TEXT,
    mode TEXT NOT NULL,
    as_of TEXT NOT NULL,
    kb_version TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' -- draft | approved
);

CREATE TABLE IF NOT EXISTS answers (
    id INTEGER PRIMARY KEY,
    request_id INTEGER NOT NULL REFERENCES requests(id),
    position INTEGER NOT NULL,
    question TEXT NOT NULL,
    lang TEXT NOT NULL,
    summary TEXT,
    variants TEXT NOT NULL,              -- JSON {simple, refs, quotes}
    citations TEXT NOT NULL,             -- JSON список ссылок
    fragments TEXT NOT NULL,             -- JSON id найденных фрагментов
    checks TEXT NOT NULL,                -- JSON результаты самопроверки
    confidence REAL NOT NULL,
    status TEXT NOT NULL,                -- ok | caution | escalate | not_found
    source TEXT NOT NULL,                -- generated | reference | faq | degraded
    needs_review INTEGER NOT NULL DEFAULT 0,
    operator_text TEXT,                  -- правка оператора
    approved_by TEXT,
    approved_at TEXT
);

CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY,
    answer_id INTEGER NOT NULL REFERENCES answers(id),
    reviewer TEXT NOT NULL,
    verdict TEXT NOT NULL,               -- correct | incorrect | partial
    corrected_text TEXT,
    comment TEXT,
    error_tags TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL
);

-- Эталоны: подтверждённые/исправленные человеком ответы, приоритетные при повторных вопросах.
CREATE TABLE IF NOT EXISTS references_qa (
    id INTEGER PRIMARY KEY,
    question TEXT NOT NULL,
    lang TEXT NOT NULL,
    answer TEXT NOT NULL,
    fragment_keys TEXT NOT NULL,         -- JSON [[document_id, path]]
    created_at TEXT NOT NULL,
    stale INTEGER NOT NULL DEFAULT 0     -- норма изменилась — нужен пересмотр
);

CREATE TABLE IF NOT EXISTS faq (
    id INTEGER PRIMARY KEY,
    status TEXT NOT NULL,                -- candidate | published | needs_revision | rejected
    question_ru TEXT, question_kk TEXT,
    answer_ru TEXT, answer_kk TEXT,
    fragment_keys TEXT NOT NULL DEFAULT '[]',
    edition_keys TEXT NOT NULL DEFAULT '[]',
    frequency INTEGER NOT NULL DEFAULT 1,
    examples TEXT NOT NULL DEFAULT '[]',
    approved_by TEXT,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS gold_set (
    id INTEGER PRIMARY KEY,
    question TEXT NOT NULL,
    lang TEXT NOT NULL,
    expected_paths TEXT NOT NULL,        -- JSON [[document_code, path]]
    expected_answer TEXT
);

CREATE TABLE IF NOT EXISTS regression_runs (
    id INTEGER PRIMARY KEY,
    at TEXT NOT NULL,
    reason TEXT,
    total INTEGER, passed INTEGER,
    score REAL, previous_score REAL,
    degraded INTEGER NOT NULL DEFAULT 0,
    details TEXT
);

CREATE TABLE IF NOT EXISTS audit (
    id INTEGER PRIMARY KEY,
    at TEXT NOT NULL,
    user_name TEXT,
    role TEXT,
    action TEXT NOT NULL,
    target TEXT,
    details TEXT
);

CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY,
    at TEXT NOT NULL,
    level TEXT NOT NULL,                 -- info | warning | error
    message TEXT NOT NULL,
    read INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
"""


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def connect(path: Path | str) -> sqlite3.Connection:
    if str(path) != ":memory:":
        Path(path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(SCHEMA)
    return conn


def kv_get(conn: sqlite3.Connection, key: str, default=None):
    row = conn.execute("SELECT value FROM kv WHERE key = ?", (key,)).fetchone()
    return json.loads(row["value"]) if row else default


def kv_set(conn: sqlite3.Connection, key: str, value) -> None:
    conn.execute(
        "INSERT INTO kv(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (key, json.dumps(value, ensure_ascii=False)),
    )


def kb_version(conn: sqlite3.Connection) -> str:
    """Версия базы знаний: счётчик, увеличивается при каждом изменении индекса."""
    return str(kv_get(conn, "kb_version", 0))


def bump_kb_version(conn: sqlite3.Connection) -> None:
    kv_set(conn, "kb_version", int(kv_get(conn, "kb_version", 0)) + 1)


def audit(conn: sqlite3.Connection, user: str | None, role: str | None, action: str, target=None, details=None):
    conn.execute(
        "INSERT INTO audit(at, user_name, role, action, target, details) VALUES(?,?,?,?,?,?)",
        (now(), user, role, action, None if target is None else str(target),
         None if details is None else json.dumps(details, ensure_ascii=False)),
    )


def notify(conn: sqlite3.Connection, level: str, message: str) -> None:
    conn.execute("INSERT INTO notifications(at, level, message) VALUES(?,?,?)", (now(), level, message))
