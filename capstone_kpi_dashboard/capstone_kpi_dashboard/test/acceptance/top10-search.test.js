// 수용 기준 AC-12, AC-22, AC-23, AC-24: 지연 TOP 10 화면과 블록 검색.
const { all, get: dbGet } = require('../../src/db/query');
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
const SECRET = 'acc-secret-2';
const SESSION = signToken({ uid: 1, exp: Date.now() + 3600 * 1000 }, SECRET);

let server;
let base;
let dir;
let db;

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpi-acc-top-'));
  db = await openDatabase(path.join(dir, 'app.db'));
  await migrateUp(db, path.join(ROOT, 'src', 'db', 'migrations'));
  await importAll(db, path.join(ROOT, 'data'));
  const app = createApp({ db, auth: { hashKey: 'acc-key-2', sessionSecret: SECRET, sessionHours: 8 } });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.close();
  db.close();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* Windows에서 libsql이 파일 핸들을 늦게 놓아 임시 폴더 삭제가 실패할 수 있다 */ }
});

async function get(pathAndQuery) {
  const res = await fetch(`${base}${pathAndQuery}`, {
    headers: { cookie: `kpi_session=${SESSION}` },
  });
  return { status: res.status, html: await res.text() };
}

test('AC-12: 지연 TOP 10은 최대 10행이고 지연일수 내림차순이다', async () => {
  const { html } = await get('/');
  assert.match(html, /지연 블록 TOP 10/);
  const delays = [...html.matchAll(/class="top-row" data-delay="(\d+)"/g)].map((m) => Number(m[1]));
  assert.ok(delays.length >= 1 && delays.length <= 10, `행 수 ${delays.length}`);
  for (let i = 1; i < delays.length; i++) {
    assert.ok(delays[i - 1] >= delays[i], '지연일수가 내림차순이어야 함');
  }
});

test('AC-22: 3자 이상 한글 질의 "대조립"이 부분 일치로 찾힌다', async () => {
  const { status, html } = await get('/search?q=' + encodeURIComponent('대조립'));
  assert.equal(status, 200);
  const rows = html.match(/class="search-row"/g) || [];
  assert.ok(rows.length > 0, '결과가 있어야 함');
  assert.match(html, /2401-B01/);
});

test('AC-23: 2자 질의 "도장"도 결과가 나온다', async () => {
  const { html } = await get('/search?q=' + encodeURIComponent('도장'));
  const rows = html.match(/class="search-row"/g) || [];
  assert.ok(rows.length > 0, '2자 질의 결과가 있어야 함');
});

test('AC-24: 빈 질의는 오류 없이 전체 블록 목록(첫 페이지 50행)을 보여 준다', async () => {
  const { status, html } = await get('/search?q=');
  assert.equal(status, 200);
  assert.equal((html.match(/class="search-row"/g) || []).length, 50);
  assert.match(html, /전체 블록-공정 <strong>360<\/strong>건/);
});

test('AC-24: FTS 특수문자가 들어가도 오류 없이 처리되고 결과는 100건 이하다', async () => {
  const { status, html } = await get('/search?q=' + encodeURIComponent('"*:() OR NOT'));
  assert.equal(status, 200);
  assert.ok((html.match(/class="search-row"/g) || []).length <= 100);
});

test('FR-13: 검색 화면은 로그인 없이 접근할 수 없다', async () => {
  const res = await fetch(`${base}/search?q=${encodeURIComponent('대조립')}`, { redirect: 'manual' });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/login');
});
