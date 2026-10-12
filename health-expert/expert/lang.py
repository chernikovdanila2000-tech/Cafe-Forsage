"""Определение языка (ru/kk) и разбиение на предложения."""
from __future__ import annotations

import re

KK_LETTERS = set("әғқңөұүһіӘҒҚҢӨҰҮҺІ")
KK_WORDS = re.compile(r"(?i)\b(және|мен|үшін|бойынша|туралы|қалай|бола ма|жоқ|бар|емес|маған|менің|сіз|"
                      r"дәрігер|емхана|ауруха)\b")


def detect_language(text: str) -> str:
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return "ru"
    kk_share = sum(c in KK_LETTERS for c in letters) / len(letters)
    if kk_share > 0.01 or len(KK_WORDS.findall(text)) >= 2:
        return "kk"
    return "ru"


def split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?;])\s+(?=[\"«(\[]?[А-ЯЁӘҒҚҢӨҰҮҺІA-Z0-9])|\n+", text.strip())
    return [p.strip() for p in parts if p and p.strip()]
