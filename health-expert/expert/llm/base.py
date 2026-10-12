"""Абстрактный интерфейс языковой модели. Модель заменяется без изменения базы знаний."""
from __future__ import annotations

from typing import Protocol


class LLMError(RuntimeError):
    """Модель недоступна или вернула непригодный ответ — система деградирует до показа найденных норм."""


class LLM(Protocol):
    name: str

    def analyze(self, text: str, lang: str) -> dict:
        """-> {"kind": consultation|complaint|other, "summary": str, "questions": [str]}"""

    def draft(self, question: str, lang: str, fragments: list[dict], effort: str) -> dict:
        """-> {"summary", "simple", "not_found", "no_entitlement", "points": [{"statement", "fragment_ids", "quote"}]}"""

    def check_grounding(self, statements: list[str], fragments: list[dict], lang: str) -> list[dict]:
        """-> [{"statement", "supported": bool, "fragment_ids": [int], "reason"}]"""


def get_llm(settings) -> "LLM":
    provider = settings.get("llm", "provider", "offline")
    if provider == "anthropic":
        from .anthropic_llm import AnthropicLLM
        return AnthropicLLM(settings)
    from .offline import OfflineLLM
    return OfflineLLM()
