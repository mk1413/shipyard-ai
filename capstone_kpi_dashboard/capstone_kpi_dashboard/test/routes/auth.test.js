const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { openDatabase } = require('../../src/db/open');
const { migrateUp } = require('../../src/db/migrate');
const { seedUsers } = require('../../src/auth/seed-users');
const { createApp } = require('../../src/app');
const { signToken } = require('../../src/middleware/cookie');

const ROOT = path.join(__dirname, '..', '..');
const HASH_KEY = 'test-hash-key';
const SECRET = 'test-session-secret';
const FAIL_MSG = '사번 또는 이름이 일치하지 않습니다';

let server;
let base;
let dir;
let db;

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpi-auth-'));
  db = openDatabase(path.join(dir, 'app.db'));
  migrateUp(db, path.join(ROOT, 'src', 'db', 'migrations'));
  const csv = path.join(dir, 'users.csv');
  fs.writeFileSync(csv, '사번,이름\n1001,홍길동\n', 'utf8');
  seedUsers(db, csv, HASH_KEY);
  const app = createApp({ db, auth: { hashKey: HASH_KEY, sessionSecret: SECRET, sessionHours: 8 } });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

async function login(employeeNo, name) {
  const body = new URLSearchParams({ employee_no: employeeNo, name });
  const res = await fetch(`${base}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    redirect: 'manual',
  });
  return { status: res.status, location: res.headers.get('location'), setCookie: res.headers.get('set-cookie'), html: await res.text() };
}

test('AC-19: 명단에 있는 사번과 이름이면 로그인되어 대시보드로 보낸다', async () => {
  const r = await login('1001', '홍길동');
  assert.equal(r.status, 302);
  assert.equal(r.location, '/');
  assert.match(r.setCookie, /kpi_session=/);
});

test('로그인 쿠키는 HttpOnly, SameSite=Lax, Path=/ 속성을 가진다', async () => {
  const r = await login('1001', '홍길동');
  assert.match(r.setCookie, /HttpOnly/);
  assert.match(r.setCookie, /SameSite=Lax/);
  assert.match(r.setCookie, /Path=\//);
});

test('AC-19: 이름이 틀리면 실패 문구를 보여 주고 쿠키를 주지 않는다', async () => {
  const r = await login('1001', '김철수');
  assert.equal(r.status, 200);
  assert.ok(r.html.includes(FAIL_MSG));
  assert.equal(r.setCookie, null);
});

test('AC-19: 없는 사번이면 같은 실패 문구를 보여 준다 (사번 존재 여부를 알려 주지 않는다)', async () => {
  const unknown = await login('9999', '홍길동');
  const wrongName = await login('1001', '김철수');
  assert.ok(unknown.html.includes(FAIL_MSG));
  assert.ok(wrongName.html.includes(FAIL_MSG));
  assert.equal(unknown.setCookie, null);
});

test('로그인하지 않으면 대시보드는 로그인 화면으로 보낸다', async () => {
  const res = await fetch(`${base}/`, { redirect: 'manual' });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/login');
});

test('AC-20: 변조된 쿠키로는 대시보드에 들어갈 수 없다', async () => {
  const token = signToken({ uid: 1, exp: Date.now() + 60000 }, 'wrong-secret');
  const res = await fetch(`${base}/`, { redirect: 'manual', headers: { cookie: `kpi_session=${token}` } });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/login');
});

test('AC-20: 만료된 쿠키로는 대시보드에 들어갈 수 없다', async () => {
  const token = signToken({ uid: 1, exp: Date.now() - 1000 }, SECRET);
  const res = await fetch(`${base}/`, { redirect: 'manual', headers: { cookie: `kpi_session=${token}` } });
  assert.equal(res.status, 302);
});

test('로그인 후 쿠키를 가지고 가면 대시보드가 열린다', async () => {
  const r = await login('1001', '홍길동');
  const cookie = r.setCookie.split(';')[0];
  const res = await fetch(`${base}/`, { headers: { cookie } });
  assert.equal(res.status, 200);
});

test('FR-12: 로그아웃하면 쿠키가 지워진다', async () => {
  const res = await fetch(`${base}/logout`, { method: 'POST', redirect: 'manual' });
  assert.equal(res.status, 302);
  const setCookie = res.headers.get('set-cookie');
  assert.match(setCookie, /kpi_session=;/);
  assert.match(setCookie, /Max-Age=0|Expires=Thu, 01 Jan 1970/);
});
