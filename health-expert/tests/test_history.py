from expert import db, history
from expert.demo import load_demo
from expert.search import Searcher


def test_new_edition_reindexes_only_changed_fragments():
    c = db.connect(":memory:")
    load_demo(c, up_to="2024-12-31")
    before = c.execute("SELECT COUNT(*) FROM fragments").fetchone()[0]
    load_demo(c)  # добавляется редакция 2025-07-01 документа DEMO-PMSP
    after = c.execute("SELECT COUNT(*) FROM fragments").fetchone()[0]
    assert after - before == 4  # p:7 изменён и p:9 добавлен, на двух языках
    log = c.execute("SELECT event, COUNT(*) n FROM update_log GROUP BY event").fetchall()
    assert {r["event"]: r["n"] for r in log}["changed"] == 2


def test_answer_as_of_date(conn):
    s = Searcher(conn)
    old = [h for h in s.search("приём участкового врача рабочих дней", "ru", "2024-06-01") if h.path == "ch:3/p:7"]
    new = [h for h in s.search("приём участкового врача рабочих дней", "ru", "2026-01-01") if h.path == "ch:3/p:7"]
    assert "трёх рабочих дней" in old[0].text and old[0].edition_key == "2024-01-01"
    assert "двух рабочих дней" in new[0].text and new[0].edition_key == "2025-07-01"


def test_compare_editions(conn):
    diff = history.compare(conn, "DEMO-PMSP", "ru", "2024-06-01", "2026-01-01")
    assert [c["path"] for c in diff["changed"]] == ["ch:3/p:7"]
    assert [a["path"] for a in diff["added"]] == ["ch:3/p:9"]
    assert diff["removed"] == []


def test_search_finds_kazakh_pair(conn):
    hits = Searcher(conn).search("Шағым қарау мерзімі", "kk", "2026-01-01")
    top = hits[0]
    assert top.lang == "kk" and top.pair and top.pair["lang"] == "ru" and top.pair["path"] == top.path
