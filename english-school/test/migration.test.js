// Одноразове оновлення збережених цін: старі ціни з адмінки (400 ₴, абонемент 8 × 350 ₴) замінюються на 350 ₴ і абонемент 2 550 ₴.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { startSite, makeBrowser, plain } = require('./helpers');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inkwell-migration-'));
const dbPath = path.join(dir, 'school.db');
const old = new DatabaseSync(dbPath);
old.exec("CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL); INSERT INTO settings VALUES ('lessonPrice', '400'), ('packageLessonPrice', '350'), ('migration.prices-2026-11', '1');"
  + "CREATE TABLE teachers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, role TEXT, about TEXT, photo TEXT, position INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')));"
  + "INSERT INTO teachers (name, role, about, position) VALUES ('Олександра Ленгер', '2 года опыта, b2', 'Працюю только с детьми', 1);");
old.close();

const site = startSite({ DB_PATH: dbPath });

before(() => site.ready);
after(() => {
  site.stop();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('збережена ціна 400 ₴ стає 350 ₴, абонемент — 2 550 ₴', async () => {
  const page = plain((await makeBrowser(site.base).request('/')).text);
  assert.match(page, /55 хвилин з викладачем — 350 ₴/);
  assert.doesNotMatch(page, /400 ₴/);
  assert.match(page, /2\s550 ₴/);
  const db = new DatabaseSync(dbPath);
  const settings = Object.fromEntries(db.prepare('SELECT key, value FROM settings').all().map((r) => [r.key, r.value]));
  db.close();
  assert.equal(settings.lessonPrice, '350');
  assert.equal(settings.packagePrice, '2550');
  assert.equal(settings['migration.prices-350'], '1');
});

test("картка Олександри: ім'я без прізвища й опис українською", async () => {
  const page = plain((await makeBrowser(site.base).request('/')).text);
  assert.match(page, /Олександра 2 роки досвіду · B2 Працюю лише з дітьми\./);
  assert.doesNotMatch(page, /Ленгер|года опыта|только/);
});
