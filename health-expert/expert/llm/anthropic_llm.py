"""Подключение внешней модели Claude через Anthropic API.

Во внешнюю модель передаются только обезличенный текст обращения и тексты НПА.
"""
from __future__ import annotations

import json

import anthropic

from . import prompts
from .base import LLMError


class AnthropicLLM:
    def __init__(self, settings):
        self.model = settings.get("llm", "model", "claude-opus-5-5")
        self.verifier_model = settings.get("llm", "verifier_model", self.model)
        self.server_fallback = settings.get("llm", "server_fallback", True)
        self.client = anthropic.Anthropic(timeout=settings.get("llm", "timeout_seconds", 60), max_retries=2)
        self.name = f"anthropic:{self.model}"

    def _json(self, model: str, system: str, user: str, schema: dict, effort: str, max_tokens: int = 16000) -> dict:
        kwargs = {}
        if self.server_fallback:
            kwargs.update(betas=["server-side-fallback-2026-07-01"], fallbacks="default")
        try:
            response = self.client.beta.messages.create(
                model=model,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": user}],
                output_config={"effort": effort, "format": {"type": "json_schema", "schema": schema}},
                **kwargs,
            )
        except anthropic.APIConnectionError as e:
            raise LLMError(f"модель недоступна: {e}") from e
        except anthropic.RateLimitError as e:
            raise LLMError("превышен лимит запросов к модели") from e
        except anthropic.APIStatusError as e:
            raise LLMError(f"ошибка API модели {e.status_code}: {e.message}") from e
        if response.stop_reason == "refusal":
            raise LLMError("модель отказалась отвечать на запрос")
        if response.stop_reason == "max_tokens":
            raise LLMError("ответ модели обрезан по лимиту токенов")
        text = next((b.text for b in response.content if b.type == "text"), None)
        if text is None:
            raise LLMError("пустой ответ модели")
        try:
            return json.loads(text)
        except json.JSONDecodeError as e:
            raise LLMError("модель вернула некорректный JSON") from e

    def analyze(self, text: str, lang: str) -> dict:
        user = f"Язык обращения: {lang}\n<appeal>\n{text}\n</appeal>"
        return self._json(self.model, prompts.ANALYZE_SYSTEM, user, prompts.ANALYZE_SCHEMA, effort="low")

    def draft(self, question: str, lang: str, fragments: list[dict], effort: str) -> dict:
        user = (f"Язык ответа: {lang}\n<question>\n{question}\n</question>\n<fragments>\n"
                f"{prompts.render_fragments(fragments)}\n</fragments>")
        return self._json(self.model, prompts.DRAFT_SYSTEM, user, prompts.DRAFT_SCHEMA, effort=effort)

    def check_grounding(self, statements: list[str], fragments: list[dict], lang: str) -> list[dict]:
        listed = "\n".join(f"{i + 1}. {s}" for i, s in enumerate(statements))
        user = f"<fragments>\n{prompts.render_fragments(fragments)}\n</fragments>\n<statements>\n{listed}\n</statements>"
        data = self._json(self.verifier_model, prompts.GROUNDING_SYSTEM, user, prompts.GROUNDING_SCHEMA, effort="medium")
        return data["results"]
