"""Векторное представление фрагментов для гибридного поиска.

Эмбеддер подключается через интерфейс Embedder. В MVP по умолчанию используется локальный
хеш-эмбеддер символьных n-грамм (без внешних моделей). Для эксплуатации подключается
многоязычная модель (например, BGE-M3 или multilingual-e5) — база при этом не меняется,
пересчитываются только векторы (rebuild).
"""
from __future__ import annotations

import hashlib
import re
import sqlite3

import numpy as np

DIM = 512


class Embedder:
    name = "base"

    def embed(self, texts: list[str]) -> np.ndarray:
        raise NotImplementedError


class HashingEmbedder(Embedder):
    name = "hash-char-ngram-v1"

    def embed(self, texts: list[str]) -> np.ndarray:
        out = np.zeros((len(texts), DIM), dtype=np.float32)
        for i, text in enumerate(texts):
            for word in re.findall(r"\w+", text.lower()):
                w = f" {word[:8]} "
                for n in (3, 4):
                    for j in range(len(w) - n + 1):
                        h = int.from_bytes(hashlib.blake2b(w[j:j + n].encode(), digest_size=4).digest(), "little")
                        out[i, h % DIM] += 1.0
            norm = np.linalg.norm(out[i])
            if norm:
                out[i] /= norm
        return out


SCHEMA = "CREATE TABLE IF NOT EXISTS fragment_vectors (fragment_id INTEGER PRIMARY KEY, model TEXT, vec BLOB)"


class VectorIndex:
    def __init__(self, conn: sqlite3.Connection, embedder: Embedder | None = None):
        self.conn = conn
        self.embedder = embedder or HashingEmbedder()
        conn.execute(SCHEMA)
        self._cache: tuple[str, np.ndarray, np.ndarray] | None = None

    def sync(self) -> int:
        """Векторизует только фрагменты без вектора текущей модели (инкрементальная индексация).

        Исторические редакции тоже векторизуются: нужны для поиска «на дату».
        """
        rows = self.conn.execute(
            "SELECT f.id, f.text FROM fragments f LEFT JOIN fragment_vectors v ON v.fragment_id = f.id "
            "AND v.model = ? WHERE v.fragment_id IS NULL", (self.embedder.name,)).fetchall()
        for start in range(0, len(rows), 256):
            batch = rows[start:start + 256]
            vecs = self.embedder.embed([r["text"] for r in batch])
            self.conn.executemany(
                "INSERT OR REPLACE INTO fragment_vectors(fragment_id, model, vec) VALUES(?,?,?)",
                [(r["id"], self.embedder.name, v.tobytes()) for r, v in zip(batch, vecs)])
        if rows:
            self._cache = None
        return len(rows)

    def _matrix(self):
        version = self.conn.execute("SELECT COUNT(*), MAX(fragment_id) FROM fragment_vectors").fetchone()
        key = f"{version[0]}:{version[1]}"
        if not self._cache or self._cache[0] != key:
            rows = self.conn.execute("SELECT fragment_id, vec FROM fragment_vectors WHERE model = ?",
                                     (self.embedder.name,)).fetchall()
            ids = np.array([r[0] for r in rows], dtype=np.int64)
            mat = np.vstack([np.frombuffer(r[1], dtype=np.float32) for r in rows]) if rows else np.zeros((0, DIM))
            self._cache = (key, ids, mat)
        return self._cache[1], self._cache[2]

    def search(self, query: str, allowed_ids: set[int] | None = None, k: int = 20) -> list[tuple[int, float]]:
        ids, mat = self._matrix()
        if not len(ids):
            return []
        scores = mat @ self.embedder.embed([query])[0]
        order = np.argsort(-scores)
        result = []
        for idx in order:
            fid = int(ids[idx])
            if allowed_ids is None or fid in allowed_ids:
                result.append((fid, float(scores[idx])))
                if len(result) >= k:
                    break
        return result
