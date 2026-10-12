"""Гибридный поиск норм: полнотекстовый (BM25) + векторный, по обеим языковым версиям, «на дату»."""
from __future__ import annotations

import re
import sqlite3
from dataclasses import dataclass, field

from .vectors import VectorIndex

STOPWORDS = set("""
и в во не что он на я с со как а то все она так его но да ты к у же вы за бы по только ее мне было вот от меня еще
нет о из ему теперь когда даже ну вдруг ли если уже или ни быть был него до вас нибудь опять уж вам ведь там потом
себя ничего ей может они тут где есть надо ней для мы тебя их чем была сам чтобы без будто чего раз тоже себе под
будет ж тогда кто этот того потому этого какой совсем ним здесь этом один почти мой тем чтобы нее сейчас были куда
зачем всех никогда можно при наконец два об другой хоть после над больше тот через эти нас про всего них какая
много разве три эту моя впрочем хорошо свою этой перед иногда лучше чуть том нельзя такой им более всегда конечно
всю между мой моё мою мои моего здравствуйте пожалуйста спасибо прошу подскажите скажите который которая которое
которые которых должен должна должно должны году года нужно также хочу узнать ли
және мен бен пен да де та те ма ме ба бе па пе ол бұл осы сол не неге қалай қашан бар жоқ үшін туралы сияқты
болып болды бола еді деп маған менің сіз сіздің біз біздің олар оның сәлеметсіз рахмет өтінемін
""".split())


@dataclass
class Hit:
    fragment_id: int
    document_id: int
    code: str
    path: str
    lang: str
    label: str
    text: str
    title: str
    number: str | None
    doc_date: str | None
    edition_key: str
    valid_from: str
    status: str
    score: float
    pair: dict | None = field(default=None)   # та же норма на другом языке

    def key(self) -> tuple[int, str]:
        return (self.document_id, self.path)

    def as_dict(self) -> dict:
        return {k: getattr(self, k) for k in self.__dataclass_fields__}


def query_terms(text: str) -> list[str]:
    words = re.findall(r"[\wӘәҒғҚқҢңӨөҰұҮүҺһІі]+", text.lower())
    terms = []
    for w in words:
        if w in STOPWORDS or len(w) < 3 or w.isdigit():
            continue
        # Грубая нормализация словоформ: префикс слова с подстановкой (рус./каз. морфология).
        stem = w[:min(len(w) - 2, 7)] if len(w) >= 6 else w[:-1] if len(w) == 5 else w
        terms.append(stem)
    return list(dict.fromkeys(terms))


def fts_query(text: str) -> str | None:
    terms = query_terms(text)
    if not terms:
        return None
    return " OR ".join(f'"{t}"*' for t in terms)


_FRAG_SQL = """
SELECT f.id, f.document_id, f.path, f.lang, f.label, f.text, f.valid_from, f.status,
       d.code, e.title, e.number, e.doc_date, e.edition_key
FROM fragments f JOIN documents d ON d.id = f.document_id
JOIN editions e ON e.document_id = f.document_id AND e.lang = f.lang
     AND e.valid_from <= :as_of AND (e.valid_to IS NULL OR e.valid_to > :as_of)
WHERE f.valid_from <= :as_of AND (f.valid_to IS NULL OR f.valid_to > :as_of)
"""


def _row_hit(row, score: float) -> Hit:
    return Hit(fragment_id=row["id"], document_id=row["document_id"], code=row["code"], path=row["path"],
               lang=row["lang"], label=row["label"], text=row["text"], title=row["title"], number=row["number"],
               doc_date=row["doc_date"], edition_key=row["edition_key"], valid_from=row["valid_from"],
               status=row["status"], score=score)


def fragment_at(conn: sqlite3.Connection, document_id: int, path: str, lang: str, as_of: str):
    row = conn.execute(_FRAG_SQL + " AND f.document_id = :doc AND f.path = :path AND f.lang = :lang",
                       {"as_of": as_of, "doc": document_id, "path": path, "lang": lang}).fetchone()
    return _row_hit(row, 0.0) if row else None


class Searcher:
    def __init__(self, conn: sqlite3.Connection, vectors: VectorIndex | None = None, vector_weight: float = 0.5):
        self.conn = conn
        self.vectors = vectors
        # Вес векторного поиска в слиянии рангов (RRF). Для хеш-эмбеддера ниже, для многоязычной модели — 1.0.
        self.vector_weight = vector_weight

    def _fts(self, query: str, as_of: str, limit: int) -> list[tuple[int, float]]:
        q = fts_query(query)
        if not q:
            return []
        rows = self.conn.execute(
            "SELECT rowid, bm25(fragments_fts, 1.0, 0.3, 0.2) AS s FROM fragments_fts WHERE fragments_fts MATCH ? "
            "ORDER BY s LIMIT ?", (q, limit * 4)).fetchall()
        return [(r["rowid"], -r["s"]) for r in rows]

    def search(self, query: str, lang: str, as_of: str, k: int = 5, include_repealed: bool = False) -> list[Hit]:
        """Возвращает до k норм. Ищет по обеим языковым версиям; результат — на языке вопроса, с парой."""
        ranked: dict[int, float] = {}
        for rank, (fid, _) in enumerate(self._fts(query, as_of, k * 3)):
            ranked[fid] = ranked.get(fid, 0) + 1.0 / (60 + rank)
        if self.vectors is not None:
            for rank, (fid, score) in enumerate(self.vectors.search(query, k=k * 6)):
                if score > 0.15:
                    ranked[fid] = ranked.get(fid, 0) + self.vector_weight / (60 + rank)
        if not ranked:
            return []

        ids = list(ranked)
        marks = ",".join("?" * len(ids))
        rows = self.conn.execute(
            _FRAG_SQL.replace(":as_of", "?") + f" AND f.id IN ({marks})",
            [as_of] * 4 + ids).fetchall()
        by_key: dict[tuple[int, str], Hit] = {}
        for row in rows:
            if row["status"] == "repealed" and not include_repealed:
                continue
            hit = _row_hit(row, ranked[row["id"]])
            key = hit.key()
            if key in by_key:
                by_key[key].score += hit.score  # норма найдена на обоих языках — повышаем вес
                if by_key[key].lang != lang and hit.lang == lang:
                    hit.score = by_key[key].score
                    by_key[key] = hit
            else:
                by_key[key] = hit
        hits = sorted(by_key.values(), key=lambda h: -h.score)[:k]

        result = []
        other = "kk" if lang == "ru" else "ru"
        for hit in hits:
            if hit.lang != lang:
                same = fragment_at(self.conn, hit.document_id, hit.path, lang, as_of)
                if same:
                    same.score, same.pair, hit = hit.score, hit.as_dict(), same
            else:
                pair = fragment_at(self.conn, hit.document_id, hit.path, other, as_of)
                hit.pair = pair.as_dict() if pair else None
            result.append(hit)
        return result
