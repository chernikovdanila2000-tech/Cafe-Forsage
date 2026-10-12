"""Разбор текста НПА на структурные фрагменты: раздел, глава, статья, пункт (подпункты входят в пункт).

Поддерживаются русские и казахские заголовки:
  ru: «Раздел 1.», «Глава 2. ...», «Статья 7. ...», «1. ...», «1) ...»
  kk: «1-бөлім», «2-тарау. ...», «7-бап. ...», «1. ...», «1) ...»
Каждый фрагмент получает адрес path (одинаковый для ru и kk), по которому версии связываются.
"""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass

_NUM = r"(\d+(?:[-.]\d+)*)"

HEADINGS = {
    "section": [re.compile(rf"^(?:РАЗДЕЛ|Раздел)\s+{_NUM}\.?\s*(.*)$"),
                re.compile(rf"^{_NUM}\s*-\s*(?:БӨЛІМ|бөлім)\.?\s*(.*)$")],
    "chapter": [re.compile(rf"^(?:ГЛАВА|Глава)\s+{_NUM}\.?\s*(.*)$"),
                re.compile(rf"^{_NUM}\s*-\s*(?:ТАРАУ|тарау)\.?\s*(.*)$")],
    "article": [re.compile(rf"^(?:СТАТЬЯ|Статья)\s+{_NUM}\.?\s*(.*)$"),
                re.compile(rf"^{_NUM}\s*-\s*(?:БАП|бап)\.?\s*(.*)$")],
}
POINT = re.compile(rf"^{_NUM}\.\s+(\S.*)$")
SUBPOINT = re.compile(r"^(\d+(?:-\d+)?)\)\s+\S")

LABELS = {
    "ru": {"section": "Раздел {}", "chapter": "Глава {}", "article": "статья {}", "point": "пункт {}",
           "preamble": "Преамбула"},
    "kk": {"section": "{}-бөлім", "chapter": "{}-тарау", "article": "{}-бап", "point": "{}-тармақ",
           "preamble": "Кіріспе"},
}
_KEYS = {"section": "sec", "chapter": "ch", "article": "art", "point": "p"}
_LEVELS = ["section", "chapter", "article"]


@dataclass
class Fragment:
    path: str
    label: str
    text: str

    @property
    def hash(self) -> str:
        return text_hash(self.text)


def normalize_ws(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace(" ", " ")).strip()


def text_hash(text: str) -> str:
    return hashlib.sha256(normalize_ws(text).encode("utf-8")).hexdigest()[:16]


def _heading(line: str):
    for level, patterns in HEADINGS.items():
        for pattern in patterns:
            m = pattern.match(line)
            if m:
                return level, m.group(1), m.group(2).strip()
    return None


def split_structure(text: str, lang: str) -> list[Fragment]:
    """Возвращает фрагменты уровня «пункт» (или «статья», если в ней нет пунктов)."""
    labels = LABELS.get(lang, LABELS["ru"])
    lines = [normalize_ws(line) for line in text.splitlines()]
    lines = [line for line in lines if line]

    ctx: dict[str, tuple[str, str]] = {}   # уровень -> (номер, заголовок)
    fragments: list[Fragment] = []
    current: dict | None = None            # {"point": номер|None, "lines": [...]}
    preamble: list[str] = []

    def address(point: str | None) -> tuple[str, str]:
        parts, label_parts = [], []
        for level in _LEVELS:
            if level in ctx:
                parts.append(f"{_KEYS[level]}:{ctx[level][0]}")
                label_parts.append(labels[level].format(ctx[level][0]))
        if point:
            parts.append(f"p:{point}")
            label_parts.append(labels["point"].format(point))
        label = ", ".join(label_parts)
        return "/".join(parts), label[:1].upper() + label[1:]

    def flush():
        nonlocal current
        if current and current["lines"]:
            path, label = address(current["point"])
            if path:
                fragments.append(Fragment(path, label, "\n".join(current["lines"])))
        current = None

    for line in lines:
        head = _heading(line)
        if head:
            level, number, title = head
            flush()
            idx = _LEVELS.index(level)
            for lower in _LEVELS[idx:]:
                ctx.pop(lower, None)
            ctx[level] = (number, title)
            if level == "article":
                # Текст статьи без пунктов попадёт во фрагмент уровня статьи.
                current = {"point": None, "lines": [line]}
            continue
        m = POINT.match(line)
        if m and ctx:
            if current and current["point"] is None and len(current["lines"]) == 1:
                current = None  # заголовок статьи без собственного текста — не отдельный фрагмент
            flush()
            current = {"point": m.group(1), "lines": [line]}
            continue
        if current is not None:
            current["lines"].append(line)
        elif not ctx:
            preamble.append(line)
        else:
            current = {"point": None, "lines": [line]}
    flush()

    if preamble:
        fragments.insert(0, Fragment("pre", labels["preamble"], "\n".join(preamble)))
    # Дубли адресов (ошибки нумерации в источнике) получают суффикс, чтобы не терять текст.
    seen: dict[str, int] = {}
    for frag in fragments:
        if frag.path in seen:
            seen[frag.path] += 1
            frag.path = f"{frag.path}#{seen[frag.path]}"
        else:
            seen[frag.path] = 1
    return fragments
