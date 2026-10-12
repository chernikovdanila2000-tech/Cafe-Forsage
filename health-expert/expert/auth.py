"""Разграничение ролей. В MVP — токены из переменной окружения или kv; при интеграции — единая авторизация платформы."""
from __future__ import annotations

import json
import os

ROLES = {"operator", "validator", "admin"}
# Кто что может: администратор — всё; валидатор — проверка и FAQ; оператор — обращения.
PERMISSIONS = {
    "operator": {"process", "read", "approve"},
    "validator": {"process", "read", "approve", "review", "faq"},
    "admin": {"process", "read", "approve", "review", "faq", "admin"},
}

DEMO_TOKENS = {
    "operator-demo": {"name": "Оператор (демо)", "role": "operator"},
    "validator-demo": {"name": "Валидатор (демо)", "role": "validator"},
    "admin-demo": {"name": "Администратор (демо)", "role": "admin"},
}


def load_tokens() -> dict:
    """EXPERT_TOKENS='{"токен": {"name": "...", "role": "operator"}}'. Без настройки — демо-токены."""
    raw = os.environ.get("EXPERT_TOKENS")
    tokens = json.loads(raw) if raw else DEMO_TOKENS
    for t in tokens.values():
        if t["role"] not in ROLES:
            raise ValueError(f"неизвестная роль {t['role']}")
    return tokens


def allowed(role: str, permission: str) -> bool:
    return permission in PERMISSIONS.get(role, set())
