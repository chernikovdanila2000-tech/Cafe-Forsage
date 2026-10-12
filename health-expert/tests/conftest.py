import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from expert import db  # noqa: E402
from expert.config import Settings, load_settings  # noqa: E402
from expert.demo import load_demo  # noqa: E402
from expert.lang import split_sentences  # noqa: E402
from expert.llm import LLMError  # noqa: E402


class FakeLLM:
    """Подставная модель: цитирует первое предложение лучшего фрагмента и записывает всё, что ей передали."""

    name = "fake"

    def __init__(self):
        self.seen: list[str] = []
        self.fail = False
        self.bad_quote = False
        self.unsupported = False
        self.not_found = False

    def analyze(self, text, lang):
        self.seen.append(text)
        if self.fail:
            raise LLMError("недоступна")
        questions = [s for s in split_sentences(text) if s.endswith("?")] or [text]
        kind = "complaint" if "жалоб" in text.lower() or "отказ" in text.lower() else "consultation"
        return {"kind": kind, "summary": "Резюме: " + text[:80], "questions": questions}

    def draft(self, question, lang, fragments, effort):
        self.seen.append(question + "\n" + "\n".join(f["text"] for f in fragments))
        if self.fail:
            raise LLMError("недоступна")
        if self.not_found:
            return {"summary": "нет", "simple": "нет", "not_found": True, "no_entitlement": False, "points": []}
        f = fragments[0]
        quote = split_sentences(f["text"])[0]
        if self.bad_quote:
            quote = quote.rstrip(".") + " и бесплатно."
        return {"summary": "Кратко по норме.", "simple": "Простой ответ.", "not_found": False, "no_entitlement": False,
                "points": [{"statement": "Утверждение по норме.", "fragment_ids": [f["id"]], "quote": quote}]}

    def check_grounding(self, statements, fragments, lang):
        return [{"statement": s, "supported": not self.unsupported, "fragment_ids": [fragments[0]["id"]],
                 "reason": "тест"} for s in statements]


@pytest.fixture
def settings():
    s = load_settings()
    raw = {k: dict(v) for k, v in s.raw.items()}
    raw["review"]["sample_rate"] = 0.0
    return Settings(raw)


@pytest.fixture
def conn():
    c = db.connect(":memory:")
    load_demo(c)
    return c


@pytest.fixture
def fake_llm():
    return FakeLLM()
