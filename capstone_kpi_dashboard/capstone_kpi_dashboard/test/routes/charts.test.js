// T028 [US1] 탭 1 화면에 차트 자리와 Plotly 로컬 로딩이 들어 있다 (원칙 5: CDN 없음)
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
const SECRET = 'chart-test-secret';
const SESSION = signToken({ uid: 1, exp: Date.now() + 3600 * 1000 }, SECRET);

let server;
let base;
let dir;
let db;

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpi-chart-'));
  db = openDatabase(path.join(dir, 'app.db'));
  migrateUp(db, path.join(ROOT, 'src', 'db', 'migrations'));
  importAll(db, path.join(ROOT, 'data'));
  const app = createApp({ db, auth: { hashKey: 'chart-key', sessionSecret: SECRET, sessionHours: 8 } });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('탭 1 차트 자리(chart-daily, chart-process)가 화면에 있다', async () => {
  const res = await fetch(`${base}/`, { headers: { cookie: `kpi_session=${SESSION}` } });
  const html = await res.text();
  assert.match(html, /id="chart-daily"/);
  assert.match(html, /id="chart-process"/);
});

test('차트는 로컬 plotly.min.js로 그린다 (원칙 5)', async () => {
  const res = await fetch(`${base}/`, { headers: { cookie: `kpi_session=${SESSION}` } });
  const html = await res.text();
  assert.match(html, /src="\/vendor\/plotly\.min\.js"/);
  assert.match(html, /Plotly\.newPlot\('chart-daily'/);
});
