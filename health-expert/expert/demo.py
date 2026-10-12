"""Загрузка демонстрационного набора (вымышленные документы) и контрольных вопросов."""
from __future__ import annotations

import json
import sqlite3

from .config import ROOT
from .ingest import ingest
from .parsing.adilet import ParsedDocument
from .vectors import VectorIndex

DEMO_DIR = ROOT / "data" / "demo"


def load_demo(conn: sqlite3.Connection, up_to: str | None = None) -> int:
    """Загружает редакции по порядку; up_to — загрузить только редакции до этой даты включительно."""
    data = json.loads((DEMO_DIR / "documents.json").read_text(encoding="utf-8"))
    count = 0
    for doc in data["documents"]:
        for edition in doc["editions"]:
            if up_to and edition["edition_key"] > up_to:
                continue
            for lang in ("ru", "kk"):
                e = edition[lang]
                parsed = ParsedDocument(code=doc["code"], lang=lang, title=e["title"], text=e["text"],
                                        url=f"demo://{doc['code']}/{lang}", number=e["number"],
                                        doc_date=e["doc_date"], edition_key=edition["edition_key"])
                ingest(conn, parsed, source="demo", organ=doc["organ"], block=doc["block"],
                       valid_from=edition["edition_key"])
                count += 1
    VectorIndex(conn).sync()
    load_gold(conn)
    conn.commit()
    return count


def load_gold(conn: sqlite3.Connection) -> None:
    if conn.execute("SELECT COUNT(*) FROM gold_set").fetchone()[0]:
        return
    for g in json.loads((DEMO_DIR / "gold.json").read_text(encoding="utf-8")):
        conn.execute("INSERT INTO gold_set(question, lang, expected_paths) VALUES(?,?,?)",
                     (g["question"], g["lang"], json.dumps(g["expected"])))
