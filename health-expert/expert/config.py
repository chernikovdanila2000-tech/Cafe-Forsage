"""Загрузка настроек из settings.toml и реестра источников из sources.toml."""
from __future__ import annotations

import os
import tomllib
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


@dataclass
class Settings:
    raw: dict = field(default_factory=dict)

    def get(self, section: str, key: str, default=None):
        return self.raw.get(section, {}).get(key, default)

    @property
    def db_path(self) -> Path:
        path = Path(os.environ.get("EXPERT_DB", self.get("storage", "db_path", "var/expert.db")))
        return path if path.is_absolute() or str(path) == ":memory:" else ROOT / path


def load_settings(path: Path | None = None) -> Settings:
    path = path or Path(os.environ.get("EXPERT_SETTINGS", ROOT / "settings.toml"))
    with open(path, "rb") as f:
        return Settings(tomllib.load(f))


def load_registry(path: Path | None = None) -> dict:
    path = path or ROOT / "sources.toml"
    with open(path, "rb") as f:
        data = tomllib.load(f)
    return {"sources": data.get("source", []), "documents": data.get("document", [])}
