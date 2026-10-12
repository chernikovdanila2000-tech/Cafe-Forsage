import json

from expert import quality
from expert.pipeline import Pipeline

APPEAL = ("Здравствуйте, я Иванова Мария Петровна, ИИН 900101400123, тел. +7 701 123 45 67. "
          "Через сколько рабочих дней должен быть приём участкового врача по записи?")


def test_good_draft_is_ok_and_pii_never_reaches_model(conn, settings, fake_llm):
    r = Pipeline(conn, settings, fake_llm).process(APPEAL, as_of="2026-01-01", mode="accurate")
    a = r["answers"][0]
    assert a["status"] == "ok", a["checks"]
    assert a["checks"]["refs"]["ok"] and a["checks"]["quotes"]["ok"] and a["checks"]["grounding"]["ok"]
    assert a["checks"]["bilingual"]["ok"]
    assert "ред. от 2025-07-01" in a["variants"]["refs"]
    assert "«" in a["variants"]["quotes"]
    for sent in fake_llm.seen:
        assert "Иванова" not in sent and "900101400123" not in sent and "701 123" not in sent
    assert "Иванова" not in conn.execute("SELECT masked_text FROM requests").fetchone()[0]
    assert "Иванова" in r["summary"]  # оператору показывается восстановленный текст


def test_wrong_quote_is_caught(conn, settings, fake_llm):
    fake_llm.bad_quote = True
    a = Pipeline(conn, settings, fake_llm).process(APPEAL, as_of="2026-01-01")["answers"][0]
    assert a["checks"]["quotes"]["ok"] is False
    assert "и бесплатно" not in a["variants"]["quotes"]  # неверная цитата не попадает в черновик


def test_unsupported_claims_lower_confidence(conn, settings, fake_llm):
    fake_llm.unsupported = True
    a = Pipeline(conn, settings, fake_llm).process(APPEAL, as_of="2026-01-01", mode="accurate")["answers"][0]
    assert a["status"] in {"caution", "escalate"}
    assert a["needs_review"]


def test_not_found_offers_escalation(conn, settings, fake_llm):
    fake_llm.not_found = True
    a = Pipeline(conn, settings, fake_llm).process("Положена ли мне путёвка в санаторий?")["answers"][0]
    assert a["status"] == "not_found" and "эксперту" in a["variants"]["simple"]


def test_model_unavailable_shows_found_norms(conn, settings, fake_llm):
    fake_llm.fail = True
    r = Pipeline(conn, settings, fake_llm).process(APPEAL, as_of="2026-01-01")
    a = r["answers"][0]
    assert r["degraded"] and a["source"] == "degraded"
    assert "двух рабочих дней" in a["variants"]["quotes"]


def test_complaint_requires_approval_and_multiple_points(conn, settings, fake_llm):
    text = ("Пишу жалобу: мне отказали в прикреплении к поликлинике. Вправе ли поликлиника отказать в прикреплении? "
            "В какой срок рассмотрят мою жалобу?")
    r = Pipeline(conn, settings, fake_llm).process(text, as_of="2026-01-01")
    assert r["kind"] == "complaint" and r["requires_approval"]
    assert len(r["answers"]) == 2


def test_kazakh_question_answered_in_kazakh(conn, settings, fake_llm):
    r = Pipeline(conn, settings, fake_llm).process("Шағым қанша жұмыс күнінде қаралады?", as_of="2026-01-01")
    a = r["answers"][0]
    assert r["lang"] == "kk"
    assert all(c["lang"] == "kk" for c in a["citations"])
    assert "редакциясы" in a["variants"]["refs"]


def test_review_creates_reference_used_in_fast_mode(conn, settings, fake_llm):
    p = Pipeline(conn, settings, fake_llm)
    a = p.process(APPEAL, as_of="2026-01-01")["answers"][0]
    quality.submit_review(conn, a["id"], "эксперт", "partial", corrected_text="Исправленный эталонный ответ.")
    again = p.answer_question("Через сколько рабочих дней должен быть приём участкового врача по записи?",
                              "ru", "2026-01-01", "fast")
    assert again.source == "reference" and again.variants["simple"] == "Исправленный эталонный ответ."
    rep = quality.report(conn)
    assert rep["reviewed"] == 1 and rep["verdicts"] == {"partial": 1}


def test_regression_reports_degradation(conn, settings, fake_llm):
    p = Pipeline(conn, settings, fake_llm)
    first = quality.run_regression(conn, p, "baseline")
    assert first["total"] == 7
    fake_llm.not_found = True
    second = quality.run_regression(conn, p, "worse model")
    assert second["degraded"]
    assert conn.execute("SELECT COUNT(*) FROM notifications WHERE level = 'error'").fetchone()[0] == 1
    assert json.loads(conn.execute("SELECT details FROM regression_runs ORDER BY id DESC").fetchone()[0])
