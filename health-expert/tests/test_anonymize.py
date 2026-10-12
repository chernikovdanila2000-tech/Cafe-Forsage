from expert.anonymize import contains_pii, mask


def test_mask_and_restore():
    text = ("Я, Иванова Мария Петровна, ИИН 900101400123, тел. +7 701 123 45 67, e-mail maria@mail.kz, "
            "адрес ул. Абая, д. 15, кв. 3. Диагноз: сахарный диабет 2 типа (E11.9). Полис № 12345. "
            "Врач Сериков А.Б. отказал. Менің атым Асқар Нұрланұлы.")
    m = mask(text)
    for secret in ["Иванова", "900101400123", "701 123", "maria@mail.kz", "Абая", "сахарный диабет", "E11.9",
                   "12345", "Сериков", "Асқар"]:
        assert secret not in m.text, secret
    assert not contains_pii(m.text)
    assert m.restore(m.text) == text


def test_ordinary_text_untouched():
    text = "Через сколько дней должен быть приём у участкового врача?"
    assert mask(text).text == text
