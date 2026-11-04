// Спільне для тестів: запуск сайту з тимчасовою базою, фальшивий Telegram і простий «браузер» із cookie.

const { spawn } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function startSite(env = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inkwell-test-'));
  const port = 3900 + Math.floor(Math.random() * 1000);
  const telegram = { messages: [] };
  const tgServer = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const method = req.url.split('/').pop();
      const data = body ? JSON.parse(body) : {};
      let result = true;
      if (method === 'getMe') result = { username: 'inkwell_test_bot' };
      if (method === 'getUpdates') result = [{ message: { chat: { id: 4242 } } }];
      if (method === 'sendMessage') telegram.messages.push(data.text);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, result }));
    });
  });

  let server;
  let log = '';
  const base = `http://127.0.0.1:${port}`;
  const ready = (async () => {
    await new Promise((r) => tgServer.listen(0, '127.0.0.1', r));
    server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
      env: {
        ...process.env,
        PORT: String(port),
        DB_PATH: path.join(dir, 'school.db'),
        TELEGRAM_API_URL: `http://127.0.0.1:${tgServer.address().port}`,
        RAILWAY_PROJECT_ID: '',
        RAILWAY_ENVIRONMENT_NAME: '',
        RAILWAY_VOLUME_MOUNT_PATH: '',
        NODE_ENV: 'test',
        ...env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout.on('data', (d) => { log += d; });
    server.stderr.on('data', (d) => { log += d; });
    for (let i = 0; i < 50; i++) {
      try {
        await fetch(`${base}/health`);
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    throw new Error(`Сервер не запустився:\n${log}`);
  })();

  return {
    base, dir, telegram, ready,
    log: () => log,
    stop() {
      server?.kill();
      tgServer.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

// Зберігає cookie й не переходить за редиректами автоматично.
function makeBrowser(base) {
  const jar = new Map();
  async function request(url, { method = 'GET', form, body, headers = {} } = {}) {
    const res = await fetch(base + url, {
      method,
      redirect: 'manual',
      headers: {
        ...headers,
        cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
        ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
      },
      body: form ? new URLSearchParams(form).toString() : body,
    });
    const cookies = res.headers.getSetCookie();
    for (const c of cookies) {
      const [pair] = c.split(';');
      const [k, v] = pair.split('=');
      if (/Expires=Thu, 01 Jan 1970/i.test(c) || v === '') jar.delete(k);
      else jar.set(k, v);
    }
    return { status: res.status, location: res.headers.get('location'), text: await res.text(), cookies };
  }
  return { request, jar };
}

const plain = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&#39;/g, "'").replace(/\s+/g, ' ');

module.exports = { startSite, makeBrowser, plain };
