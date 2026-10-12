import json

from expert import db, faq
from expert.parsing.adilet import ParsedDocument
from expert.updater import run_update


class FakeClient:
    def __init__(self, texts):
        self.texts = texts

    def fetch(self, code, lang):
        value = self.texts[(code, lang)]
        if isinstance(value, Exception):
            raise value
        text, status = value
        return ParsedDocument(code=code, lang=lang, title=f"Документ {code}", text=text, url="x", status=status)


REGISTRY = {"sources": [{"id": "adilet", "url_ru": "", "url_kk": ""}],
            "documents": [{"source": "adilet", "code": "A1", "langs": ["ru"]},
                          {"source": "adilet", "code": "B2", "langs": ["ru"]}]}


def test_update_cycle(settings):
    c = db.connect(":memory:")
    v1 = "Глава 1. Общее\n1. Первая норма.\n2. Вторая норма."
    texts = {("A1", "ru"): (v1, "active"), ("B2", "ru"): RuntimeError("разметка изменилась")}
    stats = run_update(c, settings, client=FakeClient(texts), registry=REGISTRY)
    assert stats["new"] == 1 and stats["errors"] == 1
    assert c.execute("SELECT COUNT(*) FROM notifications WHERE level='error'").fetchone()[0] == 1

    assert run_update(c, settings, client=FakeClient(texts), registry=REGISTRY)["unchanged"] == 1

    # Опубликованный FAQ опирается на пункт 2 — после его изменения уходит на пересмотр.
    doc_id = c.execute("SELECT id FROM documents WHERE code='A1'").fetchone()[0]
    c.execute("INSERT INTO faq(status, question_ru, fragment_keys, updated_at) VALUES('published','?',?,?)",
              (json.dumps([[doc_id, "ch:1/p:2"]]), db.now()))
    texts[("A1", "ru")] = ("Глава 1. Общее\n1. Первая норма.\n2. Вторая норма в новой редакции.", "active")
    stats = run_update(c, settings, client=FakeClient(texts), registry=REGISTRY)
    assert stats["changed"] == 1 and stats["reindexed"] == 1
    assert c.execute("SELECT status FROM faq").fetchone()[0] == "needs_revision"

    texts[("A1", "ru")] = (texts[("A1", "ru")][0], "repealed")
    assert run_update(c, settings, client=FakeClient(texts), registry=REGISTRY)["repealed"] == 1
    assert c.execute("SELECT status FROM documents WHERE code='A1'").fetchone()[0] == "repealed"


def test_faq_requires_both_languages(conn):
    conn.execute("INSERT INTO faq(status, question_ru, answer_ru, updated_at) VALUES('candidate','В?','О.',?)",
                 (db.now(),))
    fid = conn.execute("SELECT id FROM faq").fetchone()[0]
    try:
        faq.publish(conn, fid, "валидатор")
        raise AssertionError("должно требовать казахскую версию")
    except ValueError as e:
        assert "question_kk" in str(e)
    faq.publish(conn, fid, "валидатор", question_kk="С?", answer_kk="Ж.")
    assert conn.execute("SELECT status FROM faq").fetchone()[0] == "published"
