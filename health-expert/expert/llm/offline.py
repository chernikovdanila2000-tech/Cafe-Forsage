"""Локальный экстрактивный режим без языковой модели.

Используется для демонстрации, автотестов и как деградация. Не формулирует ответ «своими словами»:
утверждения — это выдержки из найденных норм, поэтому оценка уверенности в этом режиме ниже.
"""
from __future__ import annotations

import re

from ..lang import detect_language, split_sentences
from ..search import query_terms

COMPLAINT = re.compile(r"(?i)(жалоб|жалуюсь|отказал|отказыва|наруш|груб|хамств|не оказал|не принял|возмущ|"
                       r"требую|шағым|бас тартт|дөрекі|наразы|қабылдамады|талап етемін)")
QUESTION = re.compile(r"(?i)(\?|подскажите|имею ли|положен|можно ли|как получить|какие|куда|сколько|"
                      r"қалай|бола ма|қандай|қайда|қанша|құқығым бар ма)")

TEXT = {
    "ru": {"intro": "По вашему вопросу сообщаем следующее.", "none": "Норма, отвечающая на вопрос, не найдена.",
           "summary": "Ответ основан на найденных нормах: {}."},
    "kk": {"intro": "Сіздің сұрағыңыз бойынша мынаны хабарлаймыз.", "none": "Сұраққа жауап беретін норма табылмады.",
           "summary": "Жауап табылған нормаларға негізделген: {}."},
}


def _strip_number(sentence: str) -> str:
    return re.sub(r"^(\d+(?:[-.]\d+)*[.)]|Статья \d+\.|\d+-бап\.)\s*", "", sentence).strip()


class OfflineLLM:
    name = "offline-extractive"

    def analyze(self, text: str, lang: str) -> dict:
        sentences = split_sentences(text)
        kind = "complaint" if COMPLAINT.search(text) else "consultation" if QUESTION.search(text) else "other"
        questions = [s for s in sentences if QUESTION.search(s) or COMPLAINT.search(s)]
        if not questions:
            questions = [text.strip()]
        summary = " ".join(sentences[:2])[:400]
        return {"kind": kind, "summary": summary, "questions": questions}

    def draft(self, question: str, lang: str, fragments: list[dict], effort: str) -> dict:
        lang = lang if lang in TEXT else detect_language(question)
        terms = query_terms(question)
        points = []
        need = 1 if len(terms) <= 2 else max(2, round(len(terms) * 0.34))
        for frag in fragments[:3]:
            overlap = sum(1 for t in terms if t in frag["text"].lower())
            if overlap < need:
                continue
            sentences = [s for s in split_sentences(frag["text"]) if len(s) > 20] or [frag["text"]]
            best = max(sentences, key=lambda s: sum(1 for t in terms if t in s.lower()))
            points.append({"statement": _strip_number(best), "fragment_ids": [frag["id"]], "quote": best})
            if len(points) == 2:
                break
        if not points:
            return {"summary": TEXT[lang]["none"], "simple": TEXT[lang]["none"], "not_found": True,
                    "no_entitlement": False, "points": []}
        labels = "; ".join(f["label"] for f in fragments if any(f["id"] in p["fragment_ids"] for p in points))
        simple = TEXT[lang]["intro"] + " " + " ".join(p["statement"] for p in points)
        return {"summary": TEXT[lang]["summary"].format(labels), "simple": simple, "not_found": False,
                "no_entitlement": False, "points": points}

    def check_grounding(self, statements: list[str], fragments: list[dict], lang: str) -> list[dict]:
        results = []
        for s in statements:
            words = [w for w in query_terms(s)]
            best, best_id = 0.0, []
            for f in fragments:
                ratio = sum(1 for w in words if w in f["text"].lower()) / max(1, len(words))
                if ratio > best:
                    best, best_id = ratio, [f["id"]]
            results.append({"statement": s, "supported": best >= 0.6, "fragment_ids": best_id,
                            "reason": f"лексическое совпадение {best:.0%}"})
        return results
