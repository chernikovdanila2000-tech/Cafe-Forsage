"""Обезличивание текста обращения перед отправкой во внешнюю модель.

Маскируются: ИИН/БИН, телефоны, e-mail, номера документов и полисов, даты рождения, адреса,
ФИО (рус./каз.), коды МКБ-10 и упоминания диагнозов. Таблица замен остаётся локально и
используется только для обратной подстановки в черновик на стороне заказчика.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

_UP = "А-ЯЁӘҒҚҢӨҰҮҺІ"
_LO = "а-яёәғқңөұүһі"
_NAME = rf"[{_UP}][{_LO}]+(?:-[{_UP}][{_LO}]+)?"
_PATRONYMIC = rf"[{_UP}][{_LO}]+(?:вич|вна|чна|ична|ұлы|қызы|улы|кызы)"
_SURNAME = rf"[{_UP}][{_LO}]+(?:ов|ова|ев|ева|ин|ина|ын|ына|ский|ская|цкий|цкая|енко|ук|юк|баев|баева|бекова?|ұлы|қызы)"

PATTERNS: list[tuple[str, re.Pattern]] = [
    ("EMAIL", re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")),
    ("IIN", re.compile(r"(?<!\d)\d{12}(?!\d)")),
    ("PHONE", re.compile(r"(?<!\w)(?:\+7|8)[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}(?!\d)")),
    ("DOC", re.compile(r"(?i)(?:полис\w*|удостоверени\w*|паспорт\w*|карт\w* пациента|куәлік\w*)\s*(?:№|N|#)?\s*[\w-]*\d[\w-]*")),
    ("DOB", re.compile(r"(?i)(?:дата рождения|г\.?\s*р\.?|туған күні|родил\w*)[:\s]*\d{1,2}[./]\d{1,2}[./]\d{2,4}")),
    ("ADDRESS", re.compile(rf"(?i)(?:ул\.|улица|пр\.|проспект|мкр\.?|микрорайон|көшесі|даңғылы|шағын аудан)\s*[{_UP}{_LO}\w\s.-]{{1,40}}?,?\s*(?:д\.|дом|үй)?\s*\d+[\w/]*(?:,?\s*(?:кв\.|квартира|пәтер)\s*\d+)?")),
    ("ICD", re.compile(r"(?<![\w.])[A-TV-Z]\d{2}(?:\.\d{1,2})?(?![\w])")),
    ("NAME", re.compile(rf"\b{_SURNAME}\s+{_NAME}(?:\s+{_PATRONYMIC})?\b|\b{_NAME}\s+{_PATRONYMIC}(?:\s+{_SURNAME})?\b")),
    ("NAME", re.compile(rf"\b{_SURNAME}\s+[{_UP}]\.\s?[{_UP}]\.")),
    ("NAME", re.compile(rf"\b[{_UP}]\.\s?[{_UP}]\.\s?{_SURNAME}\b")),
]

# Диагнозы: маскируется формулировка после маркера, чтобы во внешнюю модель не ушёл медицинский статус.
DIAGNOSIS = re.compile(r"(?i)(диагноз\w*|диагнозы|диагнозбен|диагнозы бар)\s*[:\-–«\"]?\s*([^.,;()\n»\"]{3,60})")


@dataclass
class Masked:
    text: str
    mapping: dict[str, str] = field(default_factory=dict)

    def restore(self, text: str) -> str:
        for token, value in sorted(self.mapping.items(), key=lambda kv: -len(kv[0])):
            text = text.replace(token, value)
        return text


def mask(text: str) -> Masked:
    mapping: dict[str, str] = {}
    reverse: dict[tuple[str, str], str] = {}
    counters: dict[str, int] = {}

    def token(kind: str, value: str) -> str:
        core = value.strip()
        key = (kind, core)
        if key not in reverse:
            counters[kind] = counters.get(kind, 0) + 1
            reverse[key] = f"[{kind}_{counters[kind]}]"
            mapping[reverse[key]] = core
        # Пробелы вокруг значения сохраняются, чтобы обратная подстановка вернула исходный текст.
        lead = value[:len(value) - len(value.lstrip())]
        trail = value[len(value.rstrip()):]
        return lead + reverse[key] + trail

    def diag(m: re.Match) -> str:
        return m.group(0)[:m.start(2) - m.start(0)] + token("DIAGNOSIS", m.group(2))

    text = DIAGNOSIS.sub(diag, text)
    for kind, pattern in PATTERNS:
        text = pattern.sub(lambda m, k=kind: token(k, m.group(0)), text)
    return Masked(text, mapping)


def contains_pii(text: str) -> bool:
    """Контрольная проверка перед отправкой: в тексте не должно остаться распознаваемых ПДн."""
    return any(p.search(text) for kind, p in PATTERNS if kind in {"EMAIL", "IIN", "PHONE"})
