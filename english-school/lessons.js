// Програма курсу двома мовами (uk / en). Щоб додати урок, допишіть об'єкт у масив:
// id має бути унікальним і не змінюватися (до нього прив'язані оплати й прогрес).
// Перший урок безкоштовний (пробний), решта — індивідуальні заняття з викладачем за ціною LESSON_PRICE.
// theory — HTML (пишете ви, не користувачі), vocabulary — [англійською, українською], exercises — тест.

const config = require('./config');

const MODULE_1 = { uk: 'Модуль 1. Перші кроки', en: 'Module 1. First steps' };
const MODULE_2 = { uk: 'Модуль 2. Впевнений старт', en: 'Module 2. Confident start' };

const lessons = [
  {
    id: 1,
    slug: 'greetings',
    module: MODULE_1,
    level: 'A1',
    free: true,
    duration: 30,
    title: { uk: 'Знайомство та привітання', en: 'Greetings and introductions' },
    summary: {
      uk: 'Вчимося вітатися, представлятися й ставити прості запитання про людину.',
      en: 'Learn to say hello, introduce yourself and ask simple questions about people.',
    },
    theory: {
      uk: `
      <p>В англійській є нейтральні й неформальні привітання. З колегами та незнайомими людьми кажіть
      <b>Hello</b> або <b>Good morning / afternoon / evening</b>, з друзями — <b>Hi</b> чи <b>Hey</b>.</p>
      <h3>Як представитися</h3>
      <ul>
        <li><b>My name is Olena.</b> / <b>I'm Olena.</b> — Мене звати Олена.</li>
        <li><b>I'm from Kyiv.</b> — Я з Києва.</li>
        <li><b>Nice to meet you!</b> — Приємно познайомитися! Відповідь: <b>Nice to meet you too.</b></li>
      </ul>
      <h3>Запитання при знайомстві</h3>
      <ul>
        <li><b>What's your name?</b> — Як тебе звати?</li>
        <li><b>Where are you from?</b> — Звідки ти?</li>
        <li><b>How are you?</b> — Як справи? Відповідь: <b>I'm fine, thanks. And you?</b></li>
      </ul>
      <div class="note">Порада: на <i>How are you?</i> англійці майже завжди відповідають коротко й позитивно — це радше ритуал, ніж справжнє запитання.</div>`,
      en: `
      <p>English has neutral and informal greetings. With colleagues and strangers say
      <b>Hello</b> or <b>Good morning / afternoon / evening</b>; with friends — <b>Hi</b> or <b>Hey</b>.</p>
      <h3>Introducing yourself</h3>
      <ul>
        <li><b>My name is Olena.</b> / <b>I'm Olena.</b></li>
        <li><b>I'm from Kyiv.</b></li>
        <li><b>Nice to meet you!</b> — the reply is <b>Nice to meet you too.</b></li>
      </ul>
      <h3>Questions when you meet someone</h3>
      <ul>
        <li><b>What's your name?</b></li>
        <li><b>Where are you from?</b></li>
        <li><b>How are you?</b> — <b>I'm fine, thanks. And you?</b></li>
      </ul>
      <div class="note">Tip: people almost always answer <i>How are you?</i> briefly and positively — it's more of a ritual than a real question.</div>`,
    },
    vocabulary: [
      ['hello', 'привіт, добрий день'],
      ['goodbye', 'до побачення'],
      ['nice to meet you', 'приємно познайомитися'],
      ['see you later', 'побачимося'],
      ['where', 'де, звідки'],
      ['thanks', 'дякую'],
    ],
    exercises: [
      {
        q: { uk: 'Як ввічливо привітатися з колегою вранці?', en: 'How do you politely greet a colleague in the morning?' },
        options: ['Hey!', 'Good morning!', 'Good night!'],
        answer: 1,
      },
      { q: '— Nice to meet you! — …', options: ['Nice to meet you too.', 'Yes, I am.', 'Goodbye.'], answer: 0 },
      {
        q: { uk: 'Оберіть правильне запитання «Звідки ти?»', en: 'Choose the correct question: "Where are you from?"' },
        options: ['Where you are from?', 'Where are you from?', 'From where you?'],
        answer: 1,
      },
    ],
  },
  {
    id: 2,
    slug: 'to-be',
    module: MODULE_1,
    level: 'A1',
    title: { uk: 'Дієслово to be: am, is, are', en: 'The verb to be: am, is, are' },
    summary: {
      uk: 'Головне дієслово англійської: як сказати «я студент», «вона вдома», «ми готові».',
      en: 'The most important English verb: how to say "I am a student", "she is at home", "we are ready".',
    },
    theory: {
      uk: `
      <p>Українською ми кажемо «Я студент», пропускаючи дієслово. В англійській так не можна: потрібне дієслово <b>to be</b>.</p>
      <table class="grammar">
        <tr><th>Особа</th><th>Ствердження</th><th>Заперечення</th><th>Запитання</th></tr>
        <tr><td>I</td><td>I <b>am</b> (I'm)</td><td>I'm not</td><td><b>Am</b> I?</td></tr>
        <tr><td>he / she / it</td><td>She <b>is</b> (she's)</td><td>She isn't</td><td><b>Is</b> she?</td></tr>
        <tr><td>we / you / they</td><td>They <b>are</b> (they're)</td><td>They aren't</td><td><b>Are</b> they?</td></tr>
      </table>
      <h3>Приклади</h3>
      <ul>
        <li><b>I am a teacher.</b> — Я вчитель.</li>
        <li><b>My sister is at home.</b> — Моя сестра вдома.</li>
        <li><b>Are you ready?</b> — Yes, I am. / No, I'm not.</li>
      </ul>
      <div class="note">У запитанні дієслово <i>to be</i> просто стає перед підметом: <i>You are tired → Are you tired?</i></div>`,
      en: `
      <p>Many languages drop the verb in sentences like "I — a student". English never does: you need the verb <b>to be</b>.</p>
      <table class="grammar">
        <tr><th>Person</th><th>Positive</th><th>Negative</th><th>Question</th></tr>
        <tr><td>I</td><td>I <b>am</b> (I'm)</td><td>I'm not</td><td><b>Am</b> I?</td></tr>
        <tr><td>he / she / it</td><td>She <b>is</b> (she's)</td><td>She isn't</td><td><b>Is</b> she?</td></tr>
        <tr><td>we / you / they</td><td>They <b>are</b> (they're)</td><td>They aren't</td><td><b>Are</b> they?</td></tr>
      </table>
      <h3>Examples</h3>
      <ul>
        <li><b>I am a teacher.</b></li>
        <li><b>My sister is at home.</b></li>
        <li><b>Are you ready?</b> — Yes, I am. / No, I'm not.</li>
      </ul>
      <div class="note">In a question, <i>to be</i> simply moves in front of the subject: <i>You are tired → Are you tired?</i></div>`,
    },
    vocabulary: [
      ['ready', 'готовий'],
      ['tired', 'втомлений'],
      ['busy', 'зайнятий'],
      ['happy', 'щасливий'],
      ['at home', 'вдома'],
      ['at work', 'на роботі'],
    ],
    exercises: [
      { q: 'My parents … at work.', options: ['is', 'am', 'are'], answer: 2 },
      { q: '… your brother a doctor?', options: ['Is', 'Are', 'Am'], answer: 0 },
      { q: 'I … not tired.', options: ['is', 'am', 'are'], answer: 1 },
      {
        q: { uk: 'Як правильно: «Це мій кіт»?', en: 'Which is correct?' },
        options: ['This my cat.', 'This is my cat.', 'This are my cat.'],
        answer: 1,
      },
    ],
  },
  {
    id: 3,
    slug: 'present-simple',
    module: MODULE_1,
    level: 'A1',
    title: { uk: 'Present Simple: звички та факти', en: 'Present Simple: habits and facts' },
    summary: {
      uk: 'Розповідаємо про розпорядок дня, хобі та те, що відбувається регулярно.',
      en: 'Talk about your daily routine, hobbies and things that happen regularly.',
    },
    theory: {
      uk: `
      <p><b>Present Simple</b> описує регулярні дії, звички й загальновідомі факти:
      <i>I drink coffee every morning. Water boils at 100 °C.</i></p>
      <h3>Закінчення -s</h3>
      <p>З <b>he / she / it</b> до дієслова додається <b>-s</b> (або <b>-es</b>): <i>she work<b>s</b>, he watch<b>es</b>, it go<b>es</b></i>.</p>
      <h3>Заперечення й запитання — з do / does</h3>
      <ul>
        <li><b>I don't like</b> tea. — <b>She doesn't like</b> tea. (після <i>doesn't</i> закінчення -s зникає)</li>
        <li><b>Do you</b> speak English? — <b>Does he</b> live here?</li>
      </ul>
      <h3>Слова-маркери</h3>
      <p><i>always, usually, often, sometimes, never, every day, on Mondays</i></p>
      <div class="note">Прислівники частотності ставимо перед основним дієсловом: <i>I <b>usually</b> get up at 7.</i></div>`,
      en: `
      <p><b>Present Simple</b> describes regular actions, habits and general facts:
      <i>I drink coffee every morning. Water boils at 100 °C.</i></p>
      <h3>The -s ending</h3>
      <p>With <b>he / she / it</b> the verb takes <b>-s</b> (or <b>-es</b>): <i>she work<b>s</b>, he watch<b>es</b>, it go<b>es</b></i>.</p>
      <h3>Negatives and questions use do / does</h3>
      <ul>
        <li><b>I don't like</b> tea. — <b>She doesn't like</b> tea. (no -s after <i>doesn't</i>)</li>
        <li><b>Do you</b> speak English? — <b>Does he</b> live here?</li>
      </ul>
      <h3>Signal words</h3>
      <p><i>always, usually, often, sometimes, never, every day, on Mondays</i></p>
      <div class="note">Adverbs of frequency go before the main verb: <i>I <b>usually</b> get up at 7.</i></div>`,
    },
    vocabulary: [
      ['get up', 'вставати'],
      ['have breakfast', 'снідати'],
      ['go to work', 'ходити на роботу'],
      ['usually', 'зазвичай'],
      ['never', 'ніколи'],
      ['every day', 'щодня'],
    ],
    exercises: [
      { q: 'She … in a bank.', options: ['work', 'works', 'working'], answer: 1 },
      { q: '… they live in London?', options: ['Does', 'Are', 'Do'], answer: 2 },
      { q: 'He doesn\'t … coffee.', options: ['drinks', 'drink', 'drinking'], answer: 1 },
      {
        q: { uk: 'Де правильний порядок слів?', en: 'Which word order is correct?' },
        options: ['I go usually to bed at 11.', 'I usually go to bed at 11.', 'Usually I go at 11 to bed.'],
        answer: 1,
      },
    ],
  },
  {
    id: 4,
    slug: 'numbers-time',
    module: MODULE_1,
    level: 'A1',
    title: { uk: 'Числа, час і дати', en: 'Numbers, time and dates' },
    summary: {
      uk: 'Називаємо час, домовляємося про зустріч і не плутаємо thirteen та thirty.',
      en: 'Tell the time, arrange a meeting and stop mixing up thirteen and thirty.',
    },
    theory: {
      uk: `
      <h3>Котра година?</h3>
      <p><b>What time is it?</b> — <i>It's seven o'clock</i> (7:00), <i>It's half past seven</i> (7:30),
      <i>It's quarter to eight</i> (7:45), <i>It's ten past eight</i> (8:10).</p>
      <p>У розмові часто називають просто цифри: <i>It's seven forty-five.</i></p>
      <h3>Прийменники часу</h3>
      <ul>
        <li><b>at</b> — точний час: <i>at 5 pm, at noon</i></li>
        <li><b>on</b> — дні й дати: <i>on Monday, on 5 May</i></li>
        <li><b>in</b> — місяці, роки, частини дня: <i>in June, in 2026, in the morning</i></li>
      </ul>
      <div class="note">Наголос допомагає розрізняти: thir<b>TEEN</b> (13) і <b>THIR</b>ty (30).</div>`,
      en: `
      <h3>What time is it?</h3>
      <p><i>It's seven o'clock</i> (7:00), <i>It's half past seven</i> (7:30),
      <i>It's quarter to eight</i> (7:45), <i>It's ten past eight</i> (8:10).</p>
      <p>In everyday speech people often just say the numbers: <i>It's seven forty-five.</i></p>
      <h3>Prepositions of time</h3>
      <ul>
        <li><b>at</b> — exact time: <i>at 5 pm, at noon</i></li>
        <li><b>on</b> — days and dates: <i>on Monday, on 5 May</i></li>
        <li><b>in</b> — months, years, parts of the day: <i>in June, in 2026, in the morning</i></li>
      </ul>
      <div class="note">Stress tells them apart: thir<b>TEEN</b> (13) and <b>THIR</b>ty (30).</div>`,
    },
    vocabulary: [
      ['o\'clock', 'рівно (про час)'],
      ['half past', 'пів на (після години)'],
      ['quarter', 'чверть'],
      ['noon', 'полудень'],
      ['appointment', 'зустріч, запис'],
      ['schedule', 'розклад'],
    ],
    exercises: [
      { q: 'The meeting is … Monday.', options: ['in', 'on', 'at'], answer: 1 },
      {
        q: { uk: '8:30 — це…', en: '8:30 is…' },
        options: ['half past eight', 'half to eight', 'eight and half'],
        answer: 0,
      },
      { q: 'See you … 6 pm.', options: ['on', 'in', 'at'], answer: 2 },
    ],
  },
  {
    id: 5,
    slug: 'past-simple',
    module: MODULE_2,
    level: 'A2',
    title: { uk: 'Past Simple: розповідь про минуле', en: 'Past Simple: talking about the past' },
    summary: {
      uk: 'Правильні й неправильні дієслова, розповідь про вихідні та подорожі.',
      en: 'Regular and irregular verbs, telling stories about weekends and trips.',
    },
    theory: {
      uk: `
      <p><b>Past Simple</b> — завершена дія в минулому: <i>I visited Paris last year.</i></p>
      <h3>Правильні дієслова: + ed</h3>
      <p><i>work → work<b>ed</b>, play → play<b>ed</b>, stop → stop<b>ped</b>, study → stud<b>ied</b></i></p>
      <h3>Неправильні дієслова</h3>
      <p>Їх треба запам'ятати: <i>go → went, see → saw, have → had, buy → bought, eat → ate</i>.</p>
      <h3>Заперечення й запитання — з did</h3>
      <ul>
        <li><b>I didn't go</b> to work yesterday.</li>
        <li><b>Did you see</b> the film?</li>
      </ul>
      <div class="note">Після <i>did / didn't</i> дієслово повертається в початкову форму: <i>Did you <b>go</b>?</i>, а не <i>Did you went?</i></div>`,
      en: `
      <p><b>Past Simple</b> describes a finished action in the past: <i>I visited Paris last year.</i></p>
      <h3>Regular verbs: + ed</h3>
      <p><i>work → work<b>ed</b>, play → play<b>ed</b>, stop → stop<b>ped</b>, study → stud<b>ied</b></i></p>
      <h3>Irregular verbs</h3>
      <p>These need to be learned: <i>go → went, see → saw, have → had, buy → bought, eat → ate</i>.</p>
      <h3>Negatives and questions use did</h3>
      <ul>
        <li><b>I didn't go</b> to work yesterday.</li>
        <li><b>Did you see</b> the film?</li>
      </ul>
      <div class="note">After <i>did / didn't</i> the verb goes back to its base form: <i>Did you <b>go</b>?</i>, not <i>Did you went?</i></div>`,
    },
    vocabulary: [
      ['yesterday', 'учора'],
      ['last week', 'минулого тижня'],
      ['ago', 'тому'],
      ['went', 'пішов (go)'],
      ['bought', 'купив (buy)'],
      ['saw', 'побачив (see)'],
    ],
    exercises: [
      { q: 'We … to the cinema last night.', options: ['go', 'went', 'goed'], answer: 1 },
      { q: 'Did you … my message?', options: ['get', 'got', 'gets'], answer: 0 },
      { q: 'She … TV yesterday.', options: ['didn\'t watched', 'didn\'t watch', 'not watched'], answer: 1 },
      {
        q: { uk: 'Минула форма study —', en: 'The past form of study is…' },
        options: ['studyed', 'studied', 'studed'],
        answer: 1,
      },
    ],
  },
  {
    id: 6,
    slug: 'restaurant',
    module: MODULE_2,
    level: 'A2',
    title: { uk: 'У кафе та ресторані', en: 'At a café and restaurant' },
    summary: {
      uk: 'Замовляємо їжу, просимо рахунок і ввічливо формулюємо прохання.',
      en: 'Order food, ask for the bill and make polite requests.',
    },
    theory: {
      uk: `
      <p>Головна фраза для ввічливого прохання — <b>I'd like…</b> (I would like): <i>I'd like a cappuccino, please.</i>
      Вона звучить м'якше, ніж <i>I want</i>.</p>
      <h3>Корисні фрази</h3>
      <ul>
        <li><b>Can I have the menu, please?</b> — Можна меню?</li>
        <li><b>What do you recommend?</b> — Що порадите?</li>
        <li><b>I'll have the soup.</b> — Я візьму суп.</li>
        <li><b>Could we have the bill, please?</b> — Можна рахунок? (у США — <i>check</i>)</li>
      </ul>
      <h3>Що може запитати офіціант</h3>
      <ul>
        <li><i>Are you ready to order?</i> — Готові замовити?</li>
        <li><i>Anything to drink?</i> — Що питимете?</li>
        <li><i>For here or to go?</i> — Тут чи з собою?</li>
      </ul>`,
      en: `
      <p>The key phrase for a polite request is <b>I'd like…</b> (I would like): <i>I'd like a cappuccino, please.</i>
      It sounds softer than <i>I want</i>.</p>
      <h3>Useful phrases</h3>
      <ul>
        <li><b>Can I have the menu, please?</b></li>
        <li><b>What do you recommend?</b></li>
        <li><b>I'll have the soup.</b></li>
        <li><b>Could we have the bill, please?</b> (in the US — <i>check</i>)</li>
      </ul>
      <h3>What a waiter might ask</h3>
      <ul>
        <li><i>Are you ready to order?</i></li>
        <li><i>Anything to drink?</i></li>
        <li><i>For here or to go?</i></li>
      </ul>`,
    },
    vocabulary: [
      ['bill / check', 'рахунок'],
      ['tip', 'чайові'],
      ['starter', 'закуска'],
      ['main course', 'основна страва'],
      ['to go', 'з собою'],
      ['recommend', 'радити, рекомендувати'],
    ],
    exercises: [
      {
        q: { uk: 'Найввічливіше прохання:', en: 'The most polite request:' },
        options: ['Give me coffee.', 'I want coffee.', 'I\'d like a coffee, please.'],
        answer: 2,
      },
      {
        q: { uk: 'Як попросити рахунок?', en: 'How do you ask for the bill?' },
        options: ['Could we have the bill, please?', 'Give the money.', 'How much you?'],
        answer: 0,
      },
      {
        q: { uk: '«For here or to go?» означає…', en: '"For here or to go?" means…' },
        options: {
          uk: ['Ви тут уперше?', 'Тут чи з собою?', 'Куди ви йдете?'],
          en: ['Is this your first time here?', 'Will you eat here or take it away?', 'Where are you going?'],
        },
        answer: 1,
      },
    ],
  },
  {
    id: 7,
    slug: 'future',
    module: MODULE_2,
    level: 'A2',
    title: { uk: 'Майбутнє: will і going to', en: 'The future: will and going to' },
    summary: {
      uk: 'Говоримо про плани, обіцянки й прогнози — і обираємо правильну форму.',
      en: 'Talk about plans, promises and predictions — and pick the right form.',
    },
    theory: {
      uk: `
      <h3>going to — плани й наміри</h3>
      <p>Рішення вже ухвалене: <i>I'm <b>going to</b> visit my grandma this weekend.</i></p>
      <h3>will — спонтанні рішення, обіцянки, прогнози</h3>
      <ul>
        <li>Рішення в момент мовлення: <i>It's cold. I<b>'ll</b> close the window.</i></li>
        <li>Обіцянка: <i>I<b>'ll</b> call you tomorrow.</i></li>
        <li>Думка про майбутнє: <i>I think it <b>will</b> rain.</i></li>
      </ul>
      <h3>Заперечення</h3>
      <p><i>I <b>won't</b> be late.</i> · <i>She <b>isn't going to</b> buy a car.</i></p>
      <div class="note">Якщо є явна ознака в теперішньому — використовуйте <i>going to</i>: <i>Look at those clouds! It's going to rain.</i></div>`,
      en: `
      <h3>going to — plans and intentions</h3>
      <p>The decision has already been made: <i>I'm <b>going to</b> visit my grandma this weekend.</i></p>
      <h3>will — instant decisions, promises, predictions</h3>
      <ul>
        <li>Deciding at the moment of speaking: <i>It's cold. I<b>'ll</b> close the window.</i></li>
        <li>A promise: <i>I<b>'ll</b> call you tomorrow.</i></li>
        <li>An opinion about the future: <i>I think it <b>will</b> rain.</i></li>
      </ul>
      <h3>Negatives</h3>
      <p><i>I <b>won't</b> be late.</i> · <i>She <b>isn't going to</b> buy a car.</i></p>
      <div class="note">When there is clear evidence now, use <i>going to</i>: <i>Look at those clouds! It's going to rain.</i></div>`,
    },
    vocabulary: [
      ['plan', 'план, планувати'],
      ['promise', 'обіцяти'],
      ['tomorrow', 'завтра'],
      ['next year', 'наступного року'],
      ['probably', 'ймовірно'],
      ['won\'t', 'не буде (will not)'],
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
    module: MODULE_2,
    level: 'A2',
    title: { uk: 'Подорожі: аеропорт і готель', en: 'Travel: airport and hotel' },
    summary: {
      uk: 'Реєстрація на рейс, паспортний контроль і заселення в готель без стресу.',
      en: 'Check-in, passport control and checking into a hotel without stress.',
    },
    theory: {
      uk: `
      <h3>В аеропорту</h3>
      <ul>
        <li><b>Where is the check-in desk?</b> — Де стійка реєстрації?</li>
        <li><b>I'd like a window / an aisle seat.</b> — Місце біля вікна / біля проходу.</li>
        <li><b>Is my flight on time?</b> — Мій рейс за розкладом?</li>
      </ul>
      <h3>Паспортний контроль</h3>
      <p><i>What's the purpose of your visit?</i> — <b>I'm here on holiday / on business.</b><br>
      <i>How long are you staying?</i> — <b>For ten days.</b></p>
      <h3>У готелі</h3>
      <ul>
        <li><b>I have a reservation under the name Shevchenko.</b> — У мене бронювання на ім'я Шевченко.</li>
        <li><b>What time is check-out?</b> — О котрій виїзд?</li>
        <li><b>Is breakfast included?</b> — Сніданок включено?</li>
      </ul>`,
      en: `
      <h3>At the airport</h3>
      <ul>
        <li><b>Where is the check-in desk?</b></li>
        <li><b>I'd like a window / an aisle seat.</b></li>
        <li><b>Is my flight on time?</b></li>
      </ul>
      <h3>Passport control</h3>
      <p><i>What's the purpose of your visit?</i> — <b>I'm here on holiday / on business.</b><br>
      <i>How long are you staying?</i> — <b>For ten days.</b></p>
      <h3>At the hotel</h3>
      <ul>
        <li><b>I have a reservation under the name Shevchenko.</b></li>
        <li><b>What time is check-out?</b></li>
        <li><b>Is breakfast included?</b></li>
      </ul>`,
    },
    vocabulary: [
      ['boarding pass', 'посадковий талон'],
      ['luggage', 'багаж'],
      ['delayed', 'затриманий (про рейс)'],
      ['reservation', 'бронювання'],
      ['check-out', 'виїзд із готелю'],
      ['included', 'включено'],
    ],
    exercises: [
      {
        q: { uk: 'Як сказати «місце біля проходу»?', en: 'How do you ask for a seat next to the aisle?' },
        options: ['a corridor seat', 'an aisle seat', 'a door seat'],
        answer: 1,
      },
      { q: '— What\'s the purpose of your visit? — …', options: ['I\'m here on holiday.', 'For ten days.', 'At the hotel.'], answer: 0 },
      { q: 'Your flight is … by two hours.', options: ['delayed', 'late', 'stopped'], answer: 0 },
    ],
  },
];

// Платні уроки — індивідуальні заняття з викладачем: одна ціна й тривалість для всіх.
for (const lesson of lessons) {
  lesson.price = lesson.free ? 0 : config.lessonPrice;
  if (!lesson.free) lesson.duration = config.lessonDuration;
}

const pick = (value, lang) => (value && typeof value === 'object' && !Array.isArray(value) ? value[lang] ?? value.uk : value);

// Повертає урок (або рядок із бази зі статусами) з текстами потрібною мовою.
function localize(row, lang) {
  const source = lessons.find((l) => l.id === row.id);
  if (!source) return row;
  return {
    ...row,
    module: pick(source.module, lang),
    title: pick(source.title, lang),
    summary: pick(source.summary, lang),
    theory: pick(source.theory, lang),
    vocabulary: source.vocabulary,
    exercises: source.exercises.map((ex) => ({ q: pick(ex.q, lang), options: pick(ex.options, lang), answer: ex.answer })),
  };
}

module.exports = lessons;
module.exports.localize = localize;
