// Одноразове оновлення збережених цін: якщо в адмінці була 450 ₴, після оновлення стає 400 ₴.

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
old.exec("CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL); INSERT INTO settings VALUES ('lessonPrice', '450'), ('packageDiscount', '20');");
old.close();

const site = startSite({ DB_PATH: dbPath });

before(() => site.ready);
after(() => {
  site.stop();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('збережена ціна 450 ₴ стає 400 ₴, абонемент 8 × 350 ₴', async () => {
  const page = plain((await makeBrowser(site.base).request('/')).text);
  assert.match(page, /55 хвилин з викладачем — 400 ₴/);
  assert.doesNotMatch(page, /450 ₴/);
  assert.match(page, /2\s800 ₴/);
  const db = new DatabaseSync(dbPath);
  const settings = Object.fromEntries(db.prepare('SELECT key, value FROM settings').all().map((r) => [r.key, r.value]));
  db.close();
  assert.equal(settings.lessonPrice, '400');
  assert.equal(settings['migration.prices-2026-11'], '1');
});
