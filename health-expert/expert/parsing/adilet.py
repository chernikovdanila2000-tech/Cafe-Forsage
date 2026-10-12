"""Загрузка и разбор документов с adilet.zan.kz (Эталонный контрольный банк НПА РК).

Разметка сайта может меняться, поэтому селекторы вынесены в SELECTORS и у каждого есть
запасные варианты. Перед промышленной загрузкой селекторы сверяются с живым сайтом
(см. docs/ANALYSIS.md, раздел «Парсинг»).
"""
from __future__ import annotations

import re
import time
from dataclasses import dataclass, field
from datetime import date

import httpx
from bs4 import BeautifulSoup

from .structure import normalize_ws

SELECTORS = {
    "title": ["h1", ".document-title", "title"],
    "body": ["#doc_text", ".container_gamma.text", ".document-text", "article", "body"],
    "status": [".status", ".doc-status", ".document-status"],
    "history_links": ["a[href*='/history']", ".history a", ".redactions a"],
}

STATUS_PATTERNS = {
    "repealed": re.compile(r"(Утративш\w* силу|Күшін жойған|Күші жойылған)", re.I),
    "not_in_force": re.compile(r"(Не введен\w* в действие|Қолданысқа енгізілмеген)", re.I),
    "active": re.compile(r"(Действующ\w*|Қолданыстағы)", re.I),
}
NUMBER_RE = re.compile(r"№\s*([\w\-/.]+)")
RU_MONTHS = {m: i + 1 for i, m in enumerate(
    "января февраля марта апреля мая июня июля августа сентября октября ноября декабря".split())}
KK_MONTHS = {m: i + 1 for i, m in enumerate(
    "қаңтардағы ақпандағы наурыздағы сәуірдегі мамырдағы маусымдағы шілдедегі тамыздағы "
    "қыркүйектегі қазандағы қарашадағы желтоқсандағы".split())}
RU_DATE_RE = re.compile(r"от\s+(\d{1,2})\s+(" + "|".join(RU_MONTHS) + r")\s+(\d{4})")
KK_DATE_RE = re.compile(r"(\d{4})\s+жылғы\s+(\d{1,2})\s+(" + "|".join(KK_MONTHS) + r")")
NUM_DATE_RE = re.compile(r"(\d{2})\.(\d{2})\.(\d{4})")
RELATED_RE = re.compile(r"/(?:rus|kaz)/docs/([A-Z]\d{6,}[A-Z0-9_]*)")


@dataclass
class ParsedDocument:
    code: str
    lang: str
    title: str
    text: str
    url: str
    number: str | None = None
    doc_date: str | None = None
    organ: str | None = None
    status: str = "active"
    related: list[str] = field(default_factory=list)
    edition_key: str | None = None   # дата редакции, если указана на странице


def _first(soup: BeautifulSoup, selectors: list[str]):
    for sel in selectors:
        node = soup.select_one(sel)
        if node and node.get_text(strip=True):
            return node
    return None


def _block_text(node) -> str:
    """Текст с сохранением границ абзацев (нужно для разбора структуры)."""
    for br in node.find_all("br"):
        br.replace_with("\n")
    for tag in node.find_all(["script", "style", "nav", "header", "footer"]):
        tag.decompose()
    blocks = []
    for el in node.find_all(["p", "div", "li", "h1", "h2", "h3", "h4", "tr"]):
        if el.find(["p", "div", "li", "tr"]):
            continue  # берём только «листовые» блоки
        txt = normalize_ws(el.get_text(" "))
        if txt:
            blocks.append(txt)
    if not blocks:
        blocks = [normalize_ws(line) for line in node.get_text("\n").splitlines() if line.strip()]
    return "\n".join(blocks)


def parse_requisites(text: str, lang: str) -> tuple[str | None, str | None]:
    head = text[:1500]
    number = NUMBER_RE.search(head)
    doc_date = None
    if lang == "kk" and (m := KK_DATE_RE.search(head)):
        doc_date = date(int(m.group(1)), KK_MONTHS[m.group(3)], int(m.group(2))).isoformat()
    elif (m := RU_DATE_RE.search(head)):
        doc_date = date(int(m.group(3)), RU_MONTHS[m.group(2)], int(m.group(1))).isoformat()
    elif (m := NUM_DATE_RE.search(head)):
        doc_date = date(int(m.group(3)), int(m.group(2)), int(m.group(1))).isoformat()
    return (number.group(1).rstrip(".") if number else None), doc_date


def detect_status(text: str) -> str:
    for status in ("repealed", "not_in_force", "active"):
        if STATUS_PATTERNS[status].search(text):
            return status
    return "active"


def parse_html(html: str, code: str, lang: str, url: str) -> ParsedDocument:
    soup = BeautifulSoup(html, "lxml")
    title_node = _first(soup, SELECTORS["title"])
    title = normalize_ws(title_node.get_text(" ")) if title_node else code
    status_node = _first(soup, SELECTORS["status"])
    status = detect_status(status_node.get_text(" ") if status_node else title)

    related = sorted({m for a in soup.find_all("a", href=True)
                      for m in RELATED_RE.findall(a["href"]) if m != code})
    edition_key = None
    meta = soup.find("meta", attrs={"name": "redaction-date"})
    if meta and (m := NUM_DATE_RE.search(meta.get("content", ""))):
        edition_key = f"{m.group(3)}-{m.group(2)}-{m.group(1)}"

    body = _first(soup, SELECTORS["body"])
    text = _block_text(body) if body else ""
    if title and text.startswith(title):
        text = text[len(title):].lstrip()
    number, doc_date = parse_requisites(title + "\n" + text, lang)
    return ParsedDocument(code=code, lang=lang, title=title, text=text, url=url, number=number,
                          doc_date=doc_date, status=status, related=related, edition_key=edition_key)


class AdiletClient:
    """HTTP-клиент с паузой между запросами (бережная нагрузка на источник)."""

    def __init__(self, url_ru: str, url_kk: str, user_agent: str, delay: float = 1.0, timeout: float = 30.0):
        self.urls = {"ru": url_ru, "kk": url_kk}
        self.delay = delay
        self.client = httpx.Client(headers={"User-Agent": user_agent}, timeout=timeout, follow_redirects=True)
        self._last = 0.0

    def fetch(self, code: str, lang: str) -> ParsedDocument:
        wait = self.delay - (time.monotonic() - self._last)
        if wait > 0:
            time.sleep(wait)
        url = self.urls[lang].format(code=code)
        resp = self.client.get(url)
        self._last = time.monotonic()
        resp.raise_for_status()
        return parse_html(resp.text, code, lang, url)
