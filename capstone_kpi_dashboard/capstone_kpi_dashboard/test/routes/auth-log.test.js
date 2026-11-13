// AC-21: 로그와 응답 본문에 사번과 이름의 평문이 나오지 않는다 (원칙 3)
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { openDatabase } = require('../../src/db/open');
const { migrateUp } = require('../../src/db/migrate');
const { seedUsers } = require('../../src/auth/seed-users');
const { createApp } = require('../../src/app');

const ROOT = path.join(__dirname, '..', '..');
const EMP = '7654321';
const NAME = '박영수';

let server;
let base;
let dir;
let db;

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpi-authlog-'));
  db = openDatabase(path.join(dir, 'app.db'));
  migrateUp(db, path.join(ROOT, 'src', 'db', 'migrations'));
  const csv = path.join(dir, 'users.csv');
  fs.writeFileSync(csv, `사번,이름\n${EMP},${NAME}\n`, 'utf8');
  seedUsers(db, csv, 'log-test-key');
  const app = createApp({ db, auth: { hashKey: 'log-test-key', sessionSecret: 'log-test-secret', sessionHours: 8 } });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('AC-21: 성공과 실패 로그인 중 로그와 응답 본문에 사번·이름 평문이 없다', async () => {
  const logs = [];
  const origLog = console.log;
  const origWarn = console.warn;
  const origErr = console.error;
  const capture = (...args) => logs.push(args.map(String).join(' '));
  console.log = capture;
  console.warn = capture;
  console.error = capture;

  const bodies = [];
  try {
    for (const [emp, name] of [[EMP, NAME], [EMP, '틀린이름'], ['0000000', NAME]]) {
      const res = await fetch(`${base}/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ employee_no: emp, name }),
        redirect: 'manual',
      });
      bodies.push(await res.text());
    }
  } finally {
    console.log = origLog;
    console.warn = origWarn;
    console.error = origErr;
  }

  const everything = [...logs, ...bodies].join('\n');
  assert.equal(everything.includes(EMP), false, '사번이 로그나 응답에 나오면 안 됨');
  assert.equal(everything.includes(NAME), false, '이름이 로그나 응답에 나오면 안 됨');
});

test('AC-21: 실패 화면에 입력한 사번을 다시 채워 넣지 않는다', async () => {
  const res = await fetch(`${base}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ employee_no: EMP, name: '틀린이름' }),
  });
  const html = await res.text();
  assert.equal(html.includes(`value="${EMP}"`), false);
});
