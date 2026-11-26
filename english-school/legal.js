// Публічна оферта й політика конфіденційності.
// Юридичну силу має українська версія; англійська — переклад для зручності, з тими самими пунктами.
// Поки ФОП не зареєстровано, виконавцем зазначено школу; реквізити ФОП з адмін-панелі підставляються автоматично.
// Бажано показати текст юристу.
// Змінюючи пункт в одній мові, змініть його й в іншій.

const config = require('./config');

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const h = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
const fill = (value, hint) => (value ? h(value) : `<mark class="fill">[${h(hint)}]</mark>`);
const uah = (amount) => `${Number(amount).toLocaleString('uk-UA', { maximumFractionDigits: 2 })} грн`;
const UAH = (amount) => `UAH ${Number(amount).toLocaleString('en-GB', { maximumFractionDigits: 2 })}`;

// Хто надає послуги: ФОП із налаштувань, а поки його немає — школа під своїм брендом.
function provider(lang = 'uk') {
  const { legal } = config;
  if (legal.seller) return h(legal.seller);
  return lang === 'en' ? `the online English school "${h(config.schoolName)}"` : `Онлайн-школа англійської мови «${h(config.schoolName)}»`;
}

const site = () => h(config.legal.site || 'https://inkwell.academy');

// Реквізити: показуємо лише заповнені рядки (податковий номер і адреса з'являться, щойно буде ФОП).
function details(lang = 'uk') {
  const { legal, phone, email, telegram } = config;
  const L = lang === 'en'
    ? { provider: 'Provider', tax: 'Tax ID', address: 'Address', phone: 'Phone', telegram: 'Telegram', email: 'Email', site: 'Website' }
    : { provider: 'Виконавець', tax: 'РНОКПП / ЄДРПОУ', address: 'Адреса', phone: 'Телефон', telegram: 'Telegram', email: 'Email', site: 'Сайт' };
  const rows = [
    [L.provider, legal.seller ? h(legal.seller) : h(config.schoolName)],
    [L.tax, legal.taxId && h(legal.taxId)],
    [L.address, legal.address && h(legal.address)],
    [L.phone, phone && h(phone)],
    [L.telegram, telegram && h(telegram)],
    [L.email, email && h(email)],
    [L.site, site()],
  ];
  return `
    <ul class="legal-details">
      ${rows.filter(([, v]) => v).map(([k, v]) => `<li><b>${k}:</b> ${v}</li>`).join('\n      ')}
    </ul>`;
}

function offerUk() {
  const { legal, products, lessonDuration: min } = config;
  const { single, monthly } = products;
  const school = config.schoolName;
  return `
<h1>Публічний договір (оферта) про надання освітніх послуг</h1>
<p class="legal-updated">Редакція від ${h(legal.updated)}</p>

<h2>1. Загальні положення</h2>
<p>1.1. Цей договір є публічною офертою відповідно до статей 633, 641 Цивільного кодексу України. ${provider('uk')} (далі — «Виконавець»)${legal.seller ? `, що діє під брендом «${h(school)}»,` : ''} пропонує будь-якій дієздатній фізичній особі (далі — «Замовник») укласти договір про надання послуг на умовах, викладених нижче.</p>
<p>1.2. Повним і беззастережним прийняттям (акцептом) цієї оферти відповідно до статті 642 Цивільного кодексу України є оплата Замовником послуг, замовлених на сайті ${site()} (далі — «Сайт»). З моменту оплати договір вважається укладеним.</p>
<p>1.3. Якщо Замовник не досяг 18 років, договір укладає і послуги оплачує його батько, мати або інший законний представник.</p>

<h2>2. Терміни</h2>
<p><b>Заняття</b> — індивідуальне онлайн-заняття з англійської мови тривалістю ${min} хвилин, яке проводить викладач Виконавця для одного Замовника.</p>
<p><b>Разове заняття</b> — оплата одного Заняття.</p>
<p><b>Абонемент</b> — передоплачений пакет із ${monthly.lessons} Занять, розрахований на один календарний місяць (орієнтовно 2 Заняття на тиждень), за зниженою ціною одного Заняття.</p>
<p><b>Особистий кабінет</b> — розділ Сайту, де Замовник оплачує послуги й бачить кількість оплачених і проведених Занять.</p>

<h2>3. Предмет договору</h2>
<p>3.1. Виконавець зобов'язується надати Замовнику послуги з навчання англійської мови у формі індивідуальних онлайн-занять, а Замовник — оплатити ці послуги.</p>
<p>3.2. Зміст навчання (розмовна практика, граматика, лексика, вимова, аудіювання, письмо) викладач визначає індивідуально з урахуванням рівня та цілей Замовника.</p>
<p>3.3. Заняття проводяться дистанційно через Zoom, Google Meet або інший сервіс відеозв'язку, погоджений сторонами.</p>
<p>3.4. Послуги не є освітньою діяльністю, що завершується видачею документа про освіту державного зразка.</p>

<h2>4. Вартість і порядок оплати</h2>
<p>4.1. Вартість послуг на дату цієї редакції:</p>
<ul>
  <li>Разове заняття (${min} хв) — <b>${uah(single.price)}</b>;</li>
  <li>Абонемент (${monthly.lessons} занять по ${min} хв) — <b>${uah(monthly.price)}</b> замість ${uah(monthly.fullPrice)} за ${monthly.lessons} разових занять по ${uah(single.price)}.</li>
</ul>
<p>4.2. Актуальні ціни зазначені на Сайті. Виконавець може змінювати ціни; зміна не стосується вже оплачених Занять.</p>
<p>4.3. Оплата здійснюється в гривнях, на умовах 100% передоплати — через платіжний сервіс на Сайті або переказом за реквізитами, які Замовник бачить на сторінці оплати чи отримує від Виконавця. Обов'язок Замовника з оплати виконано з моменту зарахування коштів Виконавцю.</p>
<p>4.4. Безкоштовна консультація для визначення рівня не є Заняттям і не потребує оплати.</p>

<h2>5. Порядок надання послуг</h2>
<p>5.1. Після оплати викладач зв'язується із Замовником за телефоном або email, указаним в Особистому кабінеті, і погоджує розклад Занять.</p>
<p>5.2. Абонемент діє 30 календарних днів з дати оплати. Невикористані з поважних причин Заняття (хвороба, перенесення з ініціативи Виконавця тощо) можуть бути перенесені за погодженням сторін.</p>
<p>5.3. Замовник може перенести Заняття, повідомивши викладача не пізніше ніж за 24 години до його початку. Якщо Замовник не попередив вчасно або не з'явився, Заняття вважається проведеним.</p>
<p>5.4. Якщо Заняття переносить Виконавець, воно проводиться в інший погоджений час без додаткової оплати.</p>
<p>5.5. Якщо Замовник запізнився, Заняття закінчується в запланований час. Якщо запізнився викладач, час Заняття продовжується або компенсується на наступному Занятті.</p>
<p>5.6. Факт проведення Заняття фіксується в Особистому кабінеті (кількість проведених і залишок оплачених Занять).</p>

<h2>6. Права та обов'язки сторін</h2>
<p>6.1. Виконавець зобов'язується: надавати послуги якісно та у погоджений час; забезпечити Заняття кваліфікованим викладачем; зберігати конфіденційність персональних даних Замовника.</p>
<p>6.2. Виконавець має право: змінювати викладача, повідомивши про це Замовника; відмовити в наданні послуг у разі грубої поведінки Замовника, повернувши вартість непроведених Занять.</p>
<p>6.3. Замовник зобов'язується: надати достовірні контактні дані; своєчасно оплачувати послуги; приходити на Заняття вчасно, зі стабільним інтернетом, камерою та мікрофоном.</p>
<p>6.4. Замовник має право: отримувати послуги відповідно до цього договору; переносити Заняття згідно з п. 5.3; відмовитися від договору згідно з розділом 7.</p>

<h2>7. Відмова від договору та повернення коштів</h2>
<p>7.1. Замовник може будь-коли відмовитися від договору, надіславши заяву на email ${fill(config.email, 'email школи')}${config.telegram ? ` або в Telegram ${h(config.telegram)}` : ''}.</p>
<p>7.2. У такому разі Виконавець повертає вартість непроведених Занять. Для Абонемента вартість одного Заняття — ${uah(monthly.each)} (ціна Абонемента, поділена на кількість Занять у ньому).</p>
<p>7.3. Кошти повертаються тим самим способом, яким було здійснено оплату, протягом 7 робочих днів з дня отримання заяви. Строк зарахування залежить від банку Замовника.</p>
<p>7.4. Проведені Заняття, а також Заняття, що вважаються проведеними згідно з п. 5.3, поверненню не підлягають.</p>

<h2>8. Відповідальність сторін</h2>
<p>8.1. Сторони несуть відповідальність за невиконання цього договору відповідно до законодавства України.</p>
<p>8.2. Виконавець не відповідає за неможливість проведення Заняття через технічні проблеми на боці Замовника (інтернет, обладнання, програмне забезпечення).</p>
<p>8.3. Результат навчання залежить зокрема від регулярності занять і виконання домашніх завдань Замовником, тому Виконавець не гарантує досягнення певного рівня у визначений строк.</p>

<h2>9. Форс-мажор</h2>
<p>Сторони звільняються від відповідальності за невиконання зобов'язань, якщо воно спричинене обставинами непереборної сили (зокрема воєнним станом, повітряними тривогами, тривалими відключеннями електроенергії чи зв'язку). Заняття, які не відбулися з цих причин, переносяться на інший погоджений час.</p>

<h2>10. Персональні дані</h2>
<p>Оплачуючи послуги, Замовник надає згоду на обробку своїх персональних даних відповідно до Закону України «Про захист персональних даних» на умовах <a href="/privacy">Політики конфіденційності</a>.</p>

<h2>11. Строк дії та зміна договору</h2>
<p>11.1. Договір діє до повного виконання сторонами своїх зобов'язань.</p>
<p>11.2. Виконавець може змінювати умови оферти, публікуючи нову редакцію на Сайті. Нова редакція не стосується вже оплачених послуг.</p>
<p>11.3. Усі спори сторони вирішують шляхом переговорів, а в разі недосягнення згоди — відповідно до законодавства України.</p>

<h2>12. Реквізити Виконавця</h2>
${details()}`;
}

// Абзац про аналітику з'являється, лише коли в налаштуваннях підключено Meta Pixel або Google Analytics.
function analyticsText() {
  const tools = [config.metaPixelId && 'Meta Pixel (Meta Platforms)', config.gaId && 'Google Analytics (Google)'].filter(Boolean);
  if (!tools.length) return '';
  return `<p>Також використовуються аналітичні й рекламні cookie сервісів ${tools.join(' та ')}: вони допомагають оцінити ефективність реклами й показувати її тим, кому вона може бути цікава. Ви можете заборонити такі cookie в налаштуваннях браузера.</p>`;
}

function privacyUk() {
  const { legal } = config;
  return `
<h1>Політика конфіденційності</h1>
<p class="legal-updated">Редакція від ${h(legal.updated)}</p>

<h2>1. Хто обробляє дані</h2>
<p>Володільцем персональних даних, зібраних на сайті ${site()}, є ${legal.seller ? h(legal.seller) : `онлайн-школа англійської мови «${h(config.schoolName)}»`}. Дані обробляються відповідно до Закону України «Про захист персональних даних».</p>

<h2>2. Які дані ми збираємо</h2>
<ul>
  <li>під час реєстрації: ім'я, email, номер телефону, рівень англійської;</li>
  <li>у заявці на консультацію: ім'я, телефон або email, мету навчання;</li>
  <li>історію оплат і кількість проведених занять;</li>
  <li>джерело, з якого ви перейшли на сайт (наприклад, рекламна кампанія).</li>
</ul>
<p>Дані банківських карток ми не отримуємо й не зберігаємо — оплату обробляє платіжний сервіс.</p>
<p>Пароль зберігається лише у вигляді криптографічного хешу, тож його не бачить навіть адміністратор.</p>

<h2>3. Навіщо ми їх використовуємо</h2>
<ul>
  <li>щоб створити й підтримувати ваш особистий кабінет;</li>
  <li>щоб викладач міг зв'язатися з вами й погодити розклад занять;</li>
  <li>щоб обліковувати оплати й проведені заняття;</li>
  <li>щоб відповісти на заявку на консультацію.</li>
</ul>
<p>Ми не продаємо й не передаємо ваші дані третім особам для реклами.</p>

<h2>4. Кому можуть бути передані дані</h2>
<p>Лише в обсязі, потрібному для надання послуг: викладачу, який веде ваші заняття; платіжному сервісу для проведення оплати; хостинг-провайдеру, на серверах якого працює сайт; сервісу Telegram, через який адміністратор отримує сповіщення про заявки; а також державним органам у випадках, передбачених законом.</p>

<h2>5. Файли cookie</h2>
<p>Сайт використовує необхідні cookie: для входу в особистий кабінет, запам'ятовування вибраної мови та джерела переходу на сайт (наприклад, з реклами).</p>
${analyticsText()}

<h2>6. Скільки зберігаються дані</h2>
<p>Поки існує ваш акаунт і протягом строку, потрібного для виконання вимог законодавства щодо обліку розрахунків. Після видалення акаунта дані знищуються.</p>

<h2>7. Ваші права</h2>
<p>Відповідно до статті 8 Закону України «Про захист персональних даних» ви можете дізнатися, які дані про вас зберігаються, вимагати їх виправлення чи видалення, відкликати згоду на обробку. Для цього напишіть на ${fill(config.email, 'email школи')}.</p>

<h2>8. Контакти</h2>
${details()}`;
}

// ---------- English translation ----------

function offerEn() {
  const { legal, products, lessonDuration: min } = config;
  const { single, monthly } = products;
  const school = config.schoolName;
  return `
<h1>Public Offer Agreement for Educational Services</h1>
<p class="legal-updated">Version of ${h(legal.updated)}</p>

<h2>1. General provisions</h2>
<p>1.1. This agreement is a public offer under Articles 633 and 641 of the Civil Code of Ukraine. ${legal.seller ? h(legal.seller) : `The online English school "${h(school)}"`} (the "Provider")${legal.seller ? `, operating under the brand "${h(school)}",` : ''} offers any legally capable individual (the "Customer") to enter into a service agreement on the terms set out below.</p>
<p>1.2. Under Article 642 of the Civil Code of Ukraine, the Customer's payment for services ordered on the website ${site()} (the "Website") constitutes full and unconditional acceptance of this offer. The agreement is concluded at the moment of payment.</p>
<p>1.3. If the Customer is under 18, the agreement is concluded and the services are paid for by their parent or other legal guardian.</p>

<h2>2. Definitions</h2>
<p><b>Lesson</b> — a one-to-one online English lesson lasting ${min} minutes, taught by the Provider's teacher to one Customer.</p>
<p><b>Single lesson</b> — payment for one Lesson.</p>
<p><b>Package</b> — a prepaid bundle of ${monthly.lessons} Lessons intended for one calendar month (about 2 Lessons a week) at a reduced price per Lesson.</p>
<p><b>Personal account</b> — the section of the Website where the Customer pays for services and sees the number of paid and completed Lessons.</p>

<h2>3. Subject of the agreement</h2>
<p>3.1. The Provider undertakes to provide the Customer with English language tuition in the form of one-to-one online lessons, and the Customer undertakes to pay for these services.</p>
<p>3.2. The content of the lessons (speaking, grammar, vocabulary, pronunciation, listening, writing) is determined by the teacher individually, based on the Customer's level and goals.</p>
<p>3.3. Lessons are held remotely via Zoom, Google Meet or another video service agreed by the parties.</p>
<p>3.4. The services do not lead to a state-recognised educational certificate.</p>

<h2>4. Prices and payment</h2>
<p>4.1. Prices as of the date of this version:</p>
<ul>
  <li>Single lesson (${min} min) — <b>${UAH(single.price)}</b>;</li>
  <li>Package (${monthly.lessons} lessons of ${min} min) — <b>${UAH(monthly.price)}</b> instead of ${UAH(monthly.fullPrice)} for ${monthly.lessons} single lessons at ${UAH(single.price)}.</li>
</ul>
<p>4.2. Current prices are shown on the Website. The Provider may change prices; changes do not apply to Lessons already paid for.</p>
<p>4.3. Payment is made in Ukrainian hryvnias, 100% in advance — via the payment service on the Website or by bank transfer using the details shown on the payment page or sent by the Provider. The Customer's payment obligation is fulfilled when the funds are received by the Provider.</p>
<p>4.4. The free level-check consultation is not a Lesson and requires no payment.</p>

<h2>5. Provision of services</h2>
<p>5.1. After payment, the teacher contacts the Customer by the phone number or email given in the Personal account and agrees on the lesson schedule.</p>
<p>5.2. A Package is valid for 30 calendar days from the date of payment. Lessons missed for good reason (illness, rescheduling by the Provider, etc.) may be rescheduled by agreement of the parties.</p>
<p>5.3. The Customer may reschedule a Lesson by notifying the teacher at least 24 hours before it starts. If the Customer does not give timely notice or does not attend, the Lesson is considered completed.</p>
<p>5.4. If the Provider reschedules a Lesson, it is held at another agreed time at no extra cost.</p>
<p>5.5. If the Customer is late, the Lesson ends at the scheduled time. If the teacher is late, the Lesson is extended or the time is made up in the next Lesson.</p>
<p>5.6. Completed Lessons are recorded in the Personal account (number of completed Lessons and remaining paid Lessons).</p>

<h2>6. Rights and obligations of the parties</h2>
<p>6.1. The Provider shall: provide services properly and at the agreed time; ensure Lessons are taught by a qualified teacher; keep the Customer's personal data confidential.</p>
<p>6.2. The Provider may: change the teacher after notifying the Customer; refuse to provide services in case of abusive behaviour by the Customer, refunding the cost of Lessons not yet held.</p>
<p>6.3. The Customer shall: provide accurate contact details; pay for services on time; attend Lessons on time with a stable internet connection, a camera and a microphone.</p>
<p>6.4. The Customer may: receive services under this agreement; reschedule Lessons under clause 5.3; withdraw from the agreement under section 7.</p>

<h2>7. Withdrawal and refunds</h2>
<p>7.1. The Customer may withdraw from the agreement at any time by sending a request to ${fill(config.email, 'school email')}${config.telegram ? ` or via Telegram ${h(config.telegram)}` : ''}.</p>
<p>7.2. In this case, the Provider refunds the cost of Lessons not yet held. For a Package, the cost of one Lesson is ${UAH(monthly.each)} (the Package price divided by the number of Lessons in it).</p>
<p>7.3. Refunds are made by the same method as the payment, within 7 business days of receiving the request. The time for funds to arrive depends on the Customer's bank.</p>
<p>7.4. Lessons that have been held, and Lessons considered completed under clause 5.3, are not refundable.</p>

<h2>8. Liability</h2>
<p>8.1. The parties are liable for failure to perform this agreement in accordance with the laws of Ukraine.</p>
<p>8.2. The Provider is not liable if a Lesson cannot take place due to technical problems on the Customer's side (internet, equipment, software).</p>
<p>8.3. Learning results depend, among other things, on the regularity of lessons and on the Customer completing homework, so the Provider does not guarantee reaching a specific level within a specific time.</p>

<h2>9. Force majeure</h2>
<p>The parties are released from liability for failure to meet their obligations caused by force majeure (including martial law, air-raid alerts, prolonged power or communication outages). Lessons that did not take place for these reasons are rescheduled to another agreed time.</p>

<h2>10. Personal data</h2>
<p>By paying for the services, the Customer consents to the processing of their personal data under the Law of Ukraine "On Personal Data Protection" on the terms of the <a href="/privacy">Privacy Policy</a>.</p>

<h2>11. Term and amendments</h2>
<p>11.1. The agreement remains in force until the parties have fully performed their obligations.</p>
<p>11.2. The Provider may amend this offer by publishing a new version on the Website. A new version does not apply to services already paid for.</p>
<p>11.3. The parties resolve all disputes by negotiation and, failing agreement, in accordance with the laws of Ukraine.</p>

<h2>12. Provider details</h2>
${details('en')}`;
}

function analyticsTextEn() {
  const tools = [config.metaPixelId && 'Meta Pixel (Meta Platforms)', config.gaId && 'Google Analytics (Google)'].filter(Boolean);
  if (!tools.length) return '';
  return `<p>We also use analytics and advertising cookies from ${tools.join(' and ')}: they help us measure how well our ads work and show them to people who may be interested. You can block these cookies in your browser settings.</p>`;
}

function privacyEn() {
  const { legal } = config;
  return `
<h1>Privacy Policy</h1>
<p class="legal-updated">Version of ${h(legal.updated)}</p>

<h2>1. Who processes the data</h2>
<p>The controller of personal data collected on the website ${site()} is ${legal.seller ? h(legal.seller) : `the online English school "${h(config.schoolName)}"`}. Data is processed in accordance with the Law of Ukraine "On Personal Data Protection".</p>

<h2>2. What data we collect</h2>
<ul>
  <li>when you sign up: your name, email, phone number and English level;</li>
  <li>in a consultation request: your name, phone or email, and your learning goal;</li>
  <li>your payment history and the number of lessons held;</li>
  <li>the source you came to the website from (for example, an ad campaign).</li>
</ul>
<p>We do not receive or store bank card details — payments are processed by the payment service.</p>
<p>Passwords are stored only as a cryptographic hash, so not even the administrator can see them.</p>

<h2>3. Why we use it</h2>
<ul>
  <li>to create and maintain your personal account;</li>
  <li>so that your teacher can contact you and agree on a lesson schedule;</li>
  <li>to keep track of payments and lessons held;</li>
  <li>to respond to consultation requests.</li>
</ul>
<p>We do not sell your data or share it with third parties for advertising.</p>

<h2>4. Who the data may be shared with</h2>
<p>Only to the extent needed to provide the services: the teacher who gives your lessons; the payment service that processes payments; the hosting provider whose servers run the website; Telegram, through which the administrator receives notifications about requests; and public authorities where required by law.</p>

<h2>5. Cookies</h2>
<p>The website uses essential cookies: to keep you logged in to your account, to remember your language and the source you came from (for example, an ad).</p>
${analyticsTextEn()}

<h2>6. How long data is kept</h2>
<p>For as long as your account exists and for the period required by accounting law. When the account is deleted, the data is destroyed.</p>

<h2>7. Your rights</h2>
<p>Under Article 8 of the Law of Ukraine "On Personal Data Protection", you can find out what data we hold about you, ask us to correct or delete it, and withdraw your consent to processing. To do so, write to ${fill(config.email, 'school email')}.</p>

<h2>8. Contacts</h2>
${details('en')}`;
}

const offer = (lang = 'uk') => (lang === 'en' ? offerEn() : offerUk());
const privacy = (lang = 'uk') => (lang === 'en' ? privacyEn() : privacyUk());

module.exports = { offer, privacy };
