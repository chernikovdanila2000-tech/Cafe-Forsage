from pathlib import Path

from expert.parsing.adilet import parse_html, parse_requisites
from expert.parsing.structure import split_structure

FIXTURES = Path(__file__).parent / "fixtures"


def test_ru_kk_structure_paths_match():
    ru = split_structure("Глава 2. Порядок\nСтатья 5. Выбор\n1. Пациент вправе.\n2. Врач обязан:\n1) принять;\n2) записать.", "ru")
    kk = split_structure("2-тарау. Тәртіп\n5-бап. Таңдау\n1. Пациент құқылы.\n2. Дәрігер міндетті:\n1) қабылдау;\n2) жазу.", "kk")
    assert [f.path for f in ru] == [f.path for f in kk] == ["ch:2/art:5/p:1", "ch:2/art:5/p:2"]
    assert ru[1].text.endswith("2) записать.")  # подпункты входят в пункт
    assert ru[0].label == "Глава 2, статья 5, пункт 1"
    assert kk[0].label == "2-тарау, 5-бап, 1-тармақ"


def test_article_without_points():
    frags = split_structure("Статья 6. Без пунктов\nТекст статьи.", "ru")
    assert [(f.path, f.text) for f in frags] == [("art:6", "Статья 6. Без пунктов\nТекст статьи.")]


def test_parse_adilet_html():
    html = (FIXTURES / "adilet_sample.html").read_text(encoding="utf-8")
    doc = parse_html(html, "V0000000001", "ru", "https://example/")
    assert doc.title == "Об утверждении учебных правил (ДЕМО)"
    assert doc.status == "active"
    assert doc.number == "ДЕМО-1/23"
    assert doc.doc_date == "2023-12-01"
    assert doc.edition_key == "2025-07-01"
    assert doc.related == ["K2000000360"]
    assert "Меню сайта" not in doc.text
    paths = [f.path for f in split_structure(doc.text, "ru")]
    assert paths == ["pre", "ch:1/p:1", "ch:1/p:2", "ch:2/p:3"]


def test_kazakh_requisites():
    number, d = parse_requisites("Қазақстан Республикасы Денсаулық сақтау министрінің 2020 жылғы 30 қазандағы № ҚР ДСМ-175/2020 бұйрығы", "kk")
    assert d == "2020-10-30"
    assert number.startswith("ҚР")
