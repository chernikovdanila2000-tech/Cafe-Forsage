"""Автоматическое обновление базы по реестру источников: загрузка, сравнение, журнал, уведомления."""
from __future__ import annotations

import sqlite3
import traceback

from . import db
from .config import load_registry
from .ingest import ingest
from .parsing.adilet import AdiletClient
from .vectors import VectorIndex


def run_update(conn: sqlite3.Connection, settings, client: AdiletClient | None = None,
               registry: dict | None = None, after_update=None) -> dict:
    registry = registry or load_registry()
    sources = {s["id"]: s for s in registry["sources"] if s.get("enabled", True)}
    clients: dict[str, AdiletClient] = {}
    stats = {"new": 0, "changed": 0, "unchanged": 0, "repealed": 0, "errors": 0, "reindexed": 0}

    for entry in registry["documents"]:
        source = sources.get(entry.get("source", "adilet"))
        if source is None:
            continue
        cl = client or clients.setdefault(source["id"], AdiletClient(
            source["url_ru"], source["url_kk"], settings.get("update", "user_agent", "HealthExpertBot/0.1"),
            settings.get("update", "request_delay_seconds", 1.0)))
        for lang in entry.get("langs", ["ru", "kk"]):
            try:
                doc = cl.fetch(entry["code"], lang)
                if not doc.text.strip():
                    raise ValueError("пустой текст документа — вероятно, изменилась разметка источника")
                result = ingest(conn, doc, source=source["id"], organ=entry.get("organ"), block=entry.get("block"))
                stats[result.event] = stats.get(result.event, 0) + 1
                stats["reindexed"] += result.reindexed
                conn.commit()
            except Exception as e:  # noqa: BLE001 — ошибка одного документа не останавливает обновление
                conn.rollback()
                stats["errors"] += 1
                conn.execute("INSERT INTO update_log(at, document_code, lang, event, details) VALUES(?,?,?,?,?)",
                             (db.now(), entry["code"], lang, "error", f"{e}\n{traceback.format_exc(limit=2)}"))
                conn.commit()

    VectorIndex(conn).sync()
    if stats["new"] or stats["changed"] or stats["repealed"]:
        db.notify(conn, "info", f"Обновление базы НПА: новых {stats['new']}, изменённых {stats['changed']}, "
                                f"утративших силу {stats['repealed']}, переиндексировано фрагментов {stats['reindexed']}")
    if stats["errors"]:
        db.notify(conn, "error", f"Ошибки парсинга при обновлении: {stats['errors']} (см. журнал обновлений)")
    db.kv_set(conn, "last_update", {"at": db.now(), **stats})
    conn.commit()
    if after_update and (stats["new"] or stats["changed"] or stats["repealed"]):
        after_update(stats)
    return stats
