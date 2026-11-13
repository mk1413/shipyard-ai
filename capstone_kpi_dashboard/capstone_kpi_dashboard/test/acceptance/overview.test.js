// 수용 기준 AC-37: 발표용 구성도 화면이 마지막 탭에 있고, 구조도와 체크리스트 항목 위치를 보여 준다.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { openDatabase } = require('../../src/db/open');
const { migrateUp } = require('../../src/db/migrate');
const { importAll } = require('../../src/db/import-csv');
const { createApp } = require('../../src/create-app');
const { signToken } = require('../../src/middleware/cookie');

const ROOT = path.join(__dirname, '..', '..');
const SECRET = 'overview-secret';
const SESSION = signToken({ uid: 1, exp: Date.now() + 3600 * 1000 }, SECRET);

let server;
let base;
let dir;
let db;

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpi-acc-overview-'));
  db = await openDatabase(path.join(dir, 'app.db'));
  await migrateUp(db, path.join(ROOT, 'src', 'db', 'migrations'));
  await importAll(db, path.join(ROOT, 'data'));
  const app = createApp({ db, auth: { hashKey: 'overview-key', sessionSecret: SECRET, sessionHours: 8 } });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.close();
  db.close();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* Windows에서 libsql이 파일 핸들을 늦게 놓아 임시 폴더 삭제가 실패할 수 있다 */ }
});

test('AC-37: 구성도 화면은 마지막 탭이고, 구조도와 체크리스트 항목 표를 보여 준다', async () => {
  const res = await fetch(`${base}/overview`, { headers: { cookie: `kpi_session=${SESSION}` } });
  const html = await res.text();
  assert.equal(res.status, 200);
  assert.ok(html.includes('aria-label="대시보드 실행 구조도"'), '구조도 SVG가 있어야 함');
  assert.ok(html.includes('실행 구조'), '구조도 제목이 있어야 함');
  for (const item of ['실행 안내', '명세와 수용 기준', '테스트', '역할 분리 에이전트', '훅', 'deny 규칙', '비밀 값', '외부 연결 (MCP)', '남은 과제']) {
    assert.ok(html.includes(item), `체크리스트 항목 "${item}"이 있어야 함`);
  }
  // 탭 순서: 구성도가 마지막이다
  const tabs = [...html.matchAll(/<a href="(\/[a-z]*)"[^>]*>[^<]*<\/a>/g)].map((m) => m[1]);
  assert.equal(tabs[tabs.length - 1], '/overview', '마지막 탭이 구성도여야 함');
});
