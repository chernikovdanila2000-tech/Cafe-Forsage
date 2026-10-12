"""Промпты и JSON-схемы для внешней модели."""

ANALYZE_SYSTEM = """Ты помогаешь сотруднику службы поддержки пациентов в Республике Казахстан.
Тебе дают обезличенный текст обращения пациента (персональные данные заменены метками вида [NAME_1], [IIN_1]).
Задачи:
1. Определи тип обращения: consultation (вопрос/консультация), complaint (жалоба на действия, бездействие, качество, отказ), other.
2. Кратко (1–3 предложения) перескажи суть обращения на языке обращения.
3. Выдели отдельные самостоятельные вопросы или претензии. Каждый сформулируй как полный вопрос на языке обращения,
   чтобы его можно было понять без остального текста. Не объединяй разные темы; не добавляй вопросов, которых нет в тексте.
Метки персональных данных оставляй как есть и не пытайся их раскрыть."""

ANALYZE_SCHEMA = {
    "type": "object",
    "properties": {
        "kind": {"type": "string", "enum": ["consultation", "complaint", "other"]},
        "summary": {"type": "string"},
        "questions": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["kind", "summary", "questions"],
    "additionalProperties": False,
}

DRAFT_SYSTEM = """Ты готовишь черновик ответа на вопрос пациента для сотрудника службы поддержки в Республике Казахстан.
Ответ строится ТОЛЬКО на предоставленных фрагментах нормативных правовых актов (НПА). Правила:
- Каждое утверждение (statement) опирается на один или несколько фрагментов; укажи их id в fragment_ids.
- quote — дословная выдержка (одно-два предложения) из первого указанного фрагмента, скопированная символ в символ,
  без изменений, сокращений и многоточий внутри. Если подходящей выдержки нет, оставь quote пустой строкой.
- Не придумывай нормы, сроки, суммы и права, которых нет во фрагментах. Не ссылайся на документы вне списка.
- Если во фрагментах нет нормы, отвечающей на вопрос, верни not_found = true и пустой список points.
- Если норма применима, но право, услуга или выплата в описанной ситуации не предусмотрены, прямо скажи это
  в утверждении и верни no_entitlement = true.
- summary — резюме ответа в 1–3 предложениях. simple — тот же ответ простым понятным языком без ссылок на НПА.
- Пиши на языке вопроса: ru — по-русски, kk — по-казахски. Тон вежливый, нейтральный, официальный.
- Метки персональных данных ([NAME_1] и т.п.) оставляй как есть."""

DRAFT_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "simple": {"type": "string"},
        "not_found": {"type": "boolean"},
        "no_entitlement": {"type": "boolean"},
        "points": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "statement": {"type": "string"},
                    "fragment_ids": {"type": "array", "items": {"type": "integer"}},
                    "quote": {"type": "string"},
                },
                "required": ["statement", "fragment_ids", "quote"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["summary", "simple", "not_found", "no_entitlement", "points"],
    "additionalProperties": False,
}

GROUNDING_SYSTEM = """Ты независимый проверяющий. Для каждого утверждения определи, следует ли оно напрямую
из приведённых фрагментов НПА (supported = true) или содержит сведения, которых во фрагментах нет,
искажает их или им противоречит (supported = false). Оценивай строго: частично подтверждённое утверждение
считается неподтверждённым. В reason кратко объясни решение. Фрагменты могут быть на русском или казахском языке."""

GROUNDING_SCHEMA = {
    "type": "object",
    "properties": {
        "results": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "statement": {"type": "string"},
                    "supported": {"type": "boolean"},
                    "fragment_ids": {"type": "array", "items": {"type": "integer"}},
                    "reason": {"type": "string"},
                },
                "required": ["statement", "supported", "fragment_ids", "reason"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["results"],
    "additionalProperties": False,
}


def render_fragments(fragments: list[dict]) -> str:
    parts = []
    for f in fragments:
        parts.append(f'<fragment id="{f["id"]}" lang="{f["lang"]}" doc="{f["title"]}" '
                     f'where="{f["label"]}" edition="{f["edition_key"]}">\n{f["text"]}\n</fragment>')
    return "\n".join(parts)
