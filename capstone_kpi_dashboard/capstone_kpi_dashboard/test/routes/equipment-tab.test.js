// T048 보강 [US3] 탭 3 화면: 요약 카드 4개와 정지시간 추이 자리
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
const SECRET = 'equip-tab-secret';
const SESSION = signToken({ uid: 1, exp: Date.now() + 3600 * 1000 }, SECRET);
let server;
let base;
let dir;
let db;

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpi-equip-tab-'));
  db = openDatabase(path.join(dir, 'app.db'));
  migrateUp(db, path.join(ROOT, 'src', 'db', 'migrations'));
  importAll(db, path.join(ROOT, 'data'));
  const app = createApp({ db, auth: { hashKey: 'equip-key', sessionSecret: SECRET, sessionHours: 8 } });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('탭 3에 요약 카드 4개(가동률, 성능효율, 양품률, OEE)가 있다', async () => {
  const html = await (await fetch(`${base}/`, { headers: { cookie: `kpi_session=${SESSION}` } })).text();
  for (const label of ['가동률', '성능효율', '양품률', 'OEE']) {
    assert.ok(html.includes(`class="equip-card"`) && html.includes(label), `${label} 카드`);
  }
  assert.equal((html.match(/class="equip-card"/g) || []).length, 4);
});

test('탭 3에 설비별 일 정지시간 추이 자리(chart-downtime)가 있다', async () => {
  const html = await (await fetch(`${base}/`, { headers: { cookie: `kpi_session=${SESSION}` } })).text();
  assert.match(html, /id="chart-downtime"/);
  assert.match(html, /Plotly\.newPlot\('chart-downtime'/);
});
