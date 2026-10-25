// Программа курса. Чтобы добавить урок, допишите объект в массив:
// id должен быть уникальным и не меняться (к нему привязаны оплаты и прогресс).
// theory — HTML (пишется вами, не пользователями), vocabulary — слова, exercises — тест.

module.exports = [
  {
    id: 1,
    slug: 'greetings',
    module: 'Модуль 1. Первые шаги',
    level: 'A1',
    title: 'Знакомство и приветствия',
    summary: 'Учимся здороваться, представляться и задавать простые вопросы о человеке.',
    duration: 30,
    price: 0,
    free: true,
    theory: `
      <p>В английском есть нейтральные и неформальные приветствия. С коллегами и незнакомыми людьми используйте
      <b>Hello</b> и <b>Good morning / afternoon / evening</b>, с друзьями — <b>Hi</b> или <b>Hey</b>.</p>
      <h3>Как представиться</h3>
      <ul>
        <li><b>My name is Anna.</b> / <b>I'm Anna.</b> — Меня зовут Анна.</li>
        <li><b>I'm from Moscow.</b> — Я из Москвы.</li>
        <li><b>Nice to meet you!</b> — Приятно познакомиться! Ответ: <b>Nice to meet you too.</b></li>
      </ul>
      <h3>Вопросы при знакомстве</h3>
      <ul>
        <li><b>What's your name?</b> — Как тебя зовут?</li>
        <li><b>Where are you from?</b> — Откуда ты?</li>
        <li><b>How are you?</b> — Как дела? Ответ: <b>I'm fine, thanks. And you?</b></li>
      </ul>
      <div class="note">Совет: на <i>How are you?</i> англичане почти всегда отвечают коротко и позитивно — это скорее ритуал, чем настоящий вопрос.</div>`,
    vocabulary: [
      ['hello', 'здравствуйте'],
      ['goodbye', 'до свидания'],
      ['nice to meet you', 'приятно познакомиться'],
      ['see you later', 'увидимся'],
      ['where', 'где, откуда'],
      ['thanks', 'спасибо'],
    ],
    exercises: [
      { q: 'Как вежливо поздороваться с коллегой утром?', options: ['Hey!', 'Good morning!', 'Good night!'], answer: 1 },
      { q: '— Nice to meet you! — …', options: ['Nice to meet you too.', 'Yes, I am.', 'Goodbye.'], answer: 0 },
      { q: 'Выберите правильный вопрос: «Откуда ты?»', options: ['Where you are from?', 'Where are you from?', 'From where you?'], answer: 1 },
    ],
  },
  {
    id: 2,
    slug: 'to-be',
    module: 'Модуль 1. Первые шаги',
    level: 'A1',
    title: 'Глагол to be: am, is, are',
    summary: 'Главный глагол английского языка: как сказать «я студент», «она дома», «мы готовы».',
    duration: 40,
    price: 990,
    theory: `
      <p>В русском мы говорим «Я студент», пропуская глагол. В английском так нельзя: нужен глагол <b>to be</b>.</p>
      <table class="grammar">
        <tr><th>Лицо</th><th>Утверждение</th><th>Отрицание</th><th>Вопрос</th></tr>
        <tr><td>I</td><td>I <b>am</b> (I'm)</td><td>I'm not</td><td><b>Am</b> I?</td></tr>
        <tr><td>he / she / it</td><td>She <b>is</b> (she's)</td><td>She isn't</td><td><b>Is</b> she?</td></tr>
        <tr><td>we / you / they</td><td>They <b>are</b> (they're)</td><td>They aren't</td><td><b>Are</b> they?</td></tr>
      </table>
      <h3>Примеры</h3>
      <ul>
        <li><b>I am a teacher.</b> — Я учитель.</li>
        <li><b>My sister is at home.</b> — Моя сестра дома.</li>
        <li><b>Are you ready?</b> — Yes, I am. / No, I'm not.</li>
      </ul>
      <div class="note">В вопросе глагол <i>to be</i> просто встаёт перед подлежащим: <i>You are tired → Are you tired?</i></div>`,
    vocabulary: [
      ['ready', 'готовый'],
      ['tired', 'уставший'],
      ['busy', 'занятой'],
      ['happy', 'счастливый'],
      ['at home', 'дома'],
      ['at work', 'на работе'],
    ],
    exercises: [
      { q: 'My parents … at work.', options: ['is', 'am', 'are'], answer: 2 },
      { q: '… your brother a doctor?', options: ['Is', 'Are', 'Am'], answer: 0 },
      { q: 'I … not tired.', options: ['is', 'am', 'are'], answer: 1 },
      { q: 'Как правильно: «Это мой кот»?', options: ['This my cat.', 'This is my cat.', 'This are my cat.'], answer: 1 },
    ],
  },
  {
    id: 3,
    slug: 'present-simple',
    module: 'Модуль 1. Первые шаги',
    level: 'A1',
    title: 'Present Simple: привычки и факты',
    summary: 'Рассказываем о распорядке дня, хобби и том, что происходит регулярно.',
    duration: 45,
    price: 990,
    theory: `
      <p><b>Present Simple</b> описывает регулярные действия, привычки и общеизвестные факты:
      <i>I drink coffee every morning. Water boils at 100 °C.</i></p>
      <h3>Окончание -s</h3>
      <p>С <b>he / she / it</b> к глаголу добавляется <b>-s</b> (или <b>-es</b>): <i>she work<b>s</b>, he watch<b>es</b>, it go<b>es</b></i>.</p>
      <h3>Отрицания и вопросы — с do / does</h3>
      <ul>
        <li><b>I don't like</b> tea. — <b>She doesn't like</b> tea. (после <i>doesn't</i> окончание -s пропадает)</li>
        <li><b>Do you</b> speak English? — <b>Does he</b> live here?</li>
      </ul>
      <h3>Слова-маркеры</h3>
      <p><i>always, usually, often, sometimes, never, every day, on Mondays</i></p>
      <div class="note">Наречия частоты ставятся перед основным глаголом: <i>I <b>usually</b> get up at 7.</i></div>`,
    vocabulary: [
      ['get up', 'вставать'],
      ['have breakfast', 'завтракать'],
      ['go to work', 'ходить на работу'],
      ['usually', 'обычно'],
      ['never', 'никогда'],
      ['every day', 'каждый день'],
    ],
    exercises: [
      { q: 'She … in a bank.', options: ['work', 'works', 'working'], answer: 1 },
      { q: '… they live in London?', options: ['Does', 'Are', 'Do'], answer: 2 },
      { q: 'He doesn\'t … coffee.', options: ['drinks', 'drink', 'drinking'], answer: 1 },
      { q: 'Где правильный порядок слов?', options: ['I go usually to bed at 11.', 'I usually go to bed at 11.', 'Usually I go at 11 to bed.'], answer: 1 },
    ],
  },
  {
    id: 4,
    slug: 'numbers-time',
    module: 'Модуль 1. Первые шаги',
    level: 'A1',
    title: 'Числа, время и даты',
    summary: 'Называем время, договариваемся о встрече и не путаем thirteen и thirty.',
    duration: 35,
    price: 990,
    theory: `
      <h3>Который час?</h3>
      <p><b>What time is it?</b> — <i>It's seven o'clock</i> (7:00), <i>It's half past seven</i> (7:30),
      <i>It's quarter to eight</i> (7:45), <i>It's ten past eight</i> (8:10).</p>
      <p>В разговоре часто называют просто цифры: <i>It's seven forty-five.</i></p>
      <h3>Предлоги времени</h3>
      <ul>
        <li><b>at</b> — точное время: <i>at 5 pm, at noon</i></li>
        <li><b>on</b> — дни и даты: <i>on Monday, on 5 May</i></li>
        <li><b>in</b> — месяцы, годы, части дня: <i>in June, in 2026, in the morning</i></li>
      </ul>
      <div class="note">Ударение помогает различать: thir<b>TEEN</b> (13) и <b>THIR</b>ty (30).</div>`,
    vocabulary: [
      ['o\'clock', 'ровно (о времени)'],
      ['half past', 'половина (после часа)'],
      ['quarter', 'четверть'],
      ['noon', 'полдень'],
      ['appointment', 'встреча, запись'],
      ['schedule', 'расписание'],
    ],
    exercises: [
      { q: 'The meeting is … Monday.', options: ['in', 'on', 'at'], answer: 1 },
      { q: '8:30 — это…', options: ['half past eight', 'half to eight', 'eight and half'], answer: 0 },
      { q: 'See you … 6 pm.', options: ['on', 'in', 'at'], answer: 2 },
    ],
  },
  {
    id: 5,
    slug: 'past-simple',
    module: 'Модуль 2. Уверенный старт',
    level: 'A2',
    title: 'Past Simple: рассказ о прошлом',
    summary: 'Правильные и неправильные глаголы, рассказ о выходных и путешествиях.',
    duration: 45,
    price: 990,
    theory: `
      <p><b>Past Simple</b> — завершённое действие в прошлом: <i>I visited Paris last year.</i></p>
      <h3>Правильные глаголы: + ed</h3>
      <p><i>work → work<b>ed</b>, play → play<b>ed</b>, stop → stop<b>ped</b>, study → stud<b>ied</b></i></p>
      <h3>Неправильные глаголы</h3>
      <p>Их нужно запомнить: <i>go → went, see → saw, have → had, buy → bought, eat → ate</i>.</p>
      <h3>Отрицания и вопросы — с did</h3>
      <ul>
        <li><b>I didn't go</b> to work yesterday.</li>
        <li><b>Did you see</b> the film?</li>
      </ul>
      <div class="note">После <i>did / didn't</i> глагол возвращается в начальную форму: <i>Did you <b>go</b>?</i>, а не <i>Did you went?</i></div>`,
    vocabulary: [
      ['yesterday', 'вчера'],
      ['last week', 'на прошлой неделе'],
      ['ago', 'тому назад'],
      ['went', 'пошёл (go)'],
      ['bought', 'купил (buy)'],
      ['saw', 'увидел (see)'],
    ],
    exercises: [
      { q: 'We … to the cinema last night.', options: ['go', 'went', 'goed'], answer: 1 },
      { q: 'Did you … my message?', options: ['get', 'got', 'gets'], answer: 0 },
      { q: 'She … TV yesterday.', options: ['didn\'t watched', 'didn\'t watch', 'not watched'], answer: 1 },
      { q: 'Прошедшая форма study —', options: ['studyed', 'studied', 'studed'], answer: 1 },
    ],
  },
  {
    id: 6,
    slug: 'restaurant',
    module: 'Модуль 2. Уверенный старт',
    level: 'A2',
    title: 'В кафе и ресторане',
    summary: 'Заказываем еду, просим счёт и вежливо формулируем просьбы.',
    duration: 35,
    price: 990,
    theory: `
      <p>Главная фраза для вежливой просьбы — <b>I'd like…</b> (I would like): <i>I'd like a cappuccino, please.</i>
      Она звучит мягче, чем <i>I want</i>.</p>
      <h3>Полезные фразы</h3>
      <ul>
        <li><b>Can I have the menu, please?</b> — Можно меню?</li>
        <li><b>What do you recommend?</b> — Что посоветуете?</li>
        <li><b>I'll have the soup.</b> — Я возьму суп.</li>
        <li><b>Could we have the bill, please?</b> — Можно счёт? (в США — <i>check</i>)</li>
      </ul>
      <h3>Что может спросить официант</h3>
      <ul>
        <li><i>Are you ready to order?</i> — Готовы сделать заказ?</li>
        <li><i>Anything to drink?</i> — Что будете пить?</li>
        <li><i>For here or to go?</i> — Здесь или с собой?</li>
      </ul>`,
    vocabulary: [
      ['bill / check', 'счёт'],
      ['tip', 'чаевые'],
      ['starter', 'закуска'],
      ['main course', 'основное блюдо'],
      ['to go', 'с собой'],
      ['recommend', 'рекомендовать'],
    ],
    exercises: [
      { q: 'Самая вежливая просьба:', options: ['Give me coffee.', 'I want coffee.', 'I\'d like a coffee, please.'], answer: 2 },
      { q: 'Как попросить счёт?', options: ['Could we have the bill, please?', 'Give the money.', 'How much you?'], answer: 0 },
      { q: '«For here or to go?» означает…', options: ['Вы здесь впервые?', 'Здесь или с собой?', 'Куда вы идёте?'], answer: 1 },
    ],
  },
  {
    id: 7,
    slug: 'future',
    module: 'Модуль 2. Уверенный старт',
    level: 'A2',
    title: 'Будущее: will и going to',
    summary: 'Говорим о планах, обещаниях и прогнозах — и выбираем правильную форму.',
    duration: 40,
    price: 990,
    theory: `
      <h3>going to — планы и намерения</h3>
      <p>Решение уже принято: <i>I'm <b>going to</b> visit my grandma this weekend.</i></p>
      <h3>will — спонтанные решения, обещания, прогнозы</h3>
      <ul>
        <li>Решение в момент речи: <i>It's cold. I<b>'ll</b> close the window.</i></li>
        <li>Обещание: <i>I<b>'ll</b> call you tomorrow.</i></li>
        <li>Мнение о будущем: <i>I think it <b>will</b> rain.</i></li>
      </ul>
      <h3>Отрицания</h3>
      <p><i>I <b>won't</b> be late.</i> · <i>She <b>isn't going to</b> buy a car.</i></p>
      <div class="note">Если есть явный признак в настоящем — используйте <i>going to</i>: <i>Look at those clouds! It's going to rain.</i></div>`,
    vocabulary: [
      ['plan', 'план, планировать'],
      ['promise', 'обещать'],
      ['tomorrow', 'завтра'],
      ['next year', 'в следующем году'],
      ['probably', 'вероятно'],
      ['won\'t', 'не будет (will not)'],
    ],
    exercises: [
      { q: 'The phone is ringing! — I … answer it.', options: ['\'ll', '\'m going to', 'am'], answer: 0 },
      { q: 'We bought tickets. We … fly to Rome in May.', options: ['will', 'are going to', 'go'], answer: 1 },
      { q: 'Don\'t worry, I … tell anyone.', options: ['won\'t', 'don\'t', 'am not'], answer: 0 },
    ],
  },
  {
    id: 8,
    slug: 'travel',
    module: 'Модуль 2. Уверенный старт',
    level: 'A2',
    title: 'Путешествия: аэропорт и отель',
    summary: 'Регистрация на рейс, паспортный контроль и заселение в отель без стресса.',
    duration: 40,
    price: 990,
    theory: `
      <h3>В аэропорту</h3>
      <ul>
        <li><b>Where is the check-in desk?</b> — Где стойка регистрации?</li>
        <li><b>I'd like a window / an aisle seat.</b> — Место у окна / у прохода.</li>
        <li><b>Is my flight on time?</b> — Мой рейс по расписанию?</li>
      </ul>
      <h3>Паспортный контроль</h3>
      <p><i>What's the purpose of your visit?</i> — <b>I'm here on holiday / on business.</b><br>
      <i>How long are you staying?</i> — <b>For ten days.</b></p>
      <h3>В отеле</h3>
      <ul>
        <li><b>I have a reservation under the name Ivanov.</b> — У меня бронь на имя Иванов.</li>
        <li><b>What time is check-out?</b> — Во сколько выезд?</li>
        <li><b>Is breakfast included?</b> — Завтрак включён?</li>
      </ul>`,
    vocabulary: [
      ['boarding pass', 'посадочный талон'],
      ['luggage', 'багаж'],
      ['delayed', 'задержан (о рейсе)'],
      ['reservation', 'бронь'],
      ['check-out', 'выезд из отеля'],
      ['included', 'включён'],
    ],
    exercises: [
      { q: 'Как сказать «место у прохода»?', options: ['a corridor seat', 'an aisle seat', 'a door seat'], answer: 1 },
      { q: '— What\'s the purpose of your visit? — …', options: ['I\'m here on holiday.', 'For ten days.', 'At the hotel.'], answer: 0 },
      { q: 'Your flight is … by two hours.', options: ['delayed', 'late', 'stopped'], answer: 0 },
    ],
  },
];
