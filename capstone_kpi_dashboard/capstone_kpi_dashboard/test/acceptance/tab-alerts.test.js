// 수용 기준 AC-08, AC-09, AC-10: 탭별 세부 경고가 화면에 나온다.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { openDatabase } = require('../../src/db/open');
const { migrateUp } = require('../../src/db/migrate');
const { importAll } = require('../../src/db/import-csv');
const { createApp } = require('../../src/app');
const { signToken } = require('../../src/middleware/cookie');

const ROOT = path.join(__dirname, '..', '..');
const SECRET = 'acc-secret';
const SESSION = signToken({ uid: 1, exp: Date.now() + 3600 * 1000 }, SECRET);
const ALL_PROCESSES = ['절단', '소조립', '중조립', '대조립', '도장', '탑재'];
const ALL_SHIPS = ['2401', '2402', '2403', '2404'];

let server;
let base;
let dir;
let db;

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpi-acc-tab-'));
  db = openDatabase(path.join(dir, 'app.db'));
  migrateUp(db, path.join(ROOT, 'src', 'db', 'migrations'));
  importAll(db, path.join(ROOT, 'data'));
  const app = createApp({ db, auth: { hashKey: 'acc-key', sessionSecret: SECRET, sessionHours: 8 } });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

async function page(params) {
  const q = new URLSearchParams({ f: '1' });
  for (const p of ALL_PROCESSES) q.append('processes', p);
  for (const s of ALL_SHIPS) q.append('ships', s);
  for (const [k, v] of Object.entries(params || {})) q.set(k, v);
  const res = await fetch(`${base}/?${q.toString()}`, { headers: { cookie: `kpi_session=${SESSION}` } });
  return res.text();
}

test('AC-08: 10/13~10/17에는 대조립 달성률 미달 경고가 나온다', async () => {
  const html = await page({ start: '2026-10-13', end: '2026-10-17' });
  assert.match(html, /공정 대조립 달성률 60\.0%/);
});

test('AC-08: 10/13~10/17에는 CR-02 설비 OEE 미달 경고가 나온다', async () => {
  const html = await page({ start: '2026-10-13', end: '2026-10-17' });
  assert.match(html, /설비 CR-02[^<]*OEE 4\.1%/);
});

test('AC-09: 9/14~9/19에는 불량률 목표 상한 초과 경고가 나온다 (4일, 최고 4.07%)', async () => {
  const html = await page({ start: '2026-09-14', end: '2026-09-19' });
  assert.match(html, /불량률 목표 상한 초과 4일 · 최고 4\.07% \(09\/16\)/);
});

test('AC-10: 전체 기간 기본 화면에는 대조립 달성률 93.7% 주의 경고가 나온다', async () => {
  const html = await page({});
  assert.match(html, /공정 대조립 달성률 93\.7%/);
  assert.match(html, /alert-warn/);
});

test('AC-10: 전체 기간 기본 화면에는 불량률 초과 5일 경고가 나온다', async () => {
  const html = await page({});
  assert.match(html, /불량률 목표 상한 초과 5일/);
});
