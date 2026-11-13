// 수용 기준 AC-25 ~ AC-28: 전체 블록 목록, 블록 날짜 표시, 지연 사유, 설비 고장 이력.
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
const { parseCsv } = require('../../src/db/csv');

const ROOT = path.join(__dirname, '..', '..');
const SECRET = 'ops-secret';
const SESSION = signToken({ uid: 1, exp: Date.now() + 3600 * 1000 }, SECRET);

let server;
let base;
let dir;
let db;

const readCsv = (name) => parseCsv(fs.readFileSync(path.join(ROOT, 'data', name), 'utf8'));

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpi-acc-ops-'));
  db = await openDatabase(path.join(dir, 'app.db'));
  await migrateUp(db, path.join(ROOT, 'src', 'db', 'migrations'));
  await importAll(db, path.join(ROOT, 'data'));
  const app = createApp({ db, auth: { hashKey: 'ops-key', sessionSecret: SECRET, sessionHours: 8 } });
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
  const res = await fetch(`${base}${pathAndQuery}`, { headers: { cookie: `kpi_session=${SESSION}` } });
  return { status: res.status, html: await res.text() };
}

test('AC-25: 검색어 없이 들어가면 전체 블록-공정 360건을 페이지 단위로 보여 준다', async () => {
  const first = await get('/search?q=');
  assert.equal(first.status, 200);
  assert.match(first.html, /전체 블록-공정 <strong>360<\/strong>건/);
  assert.equal((first.html.match(/class="search-row"/g) || []).length, 50);

  const last = await get('/search?page=8');
  assert.equal((last.html.match(/class="search-row"/g) || []).length, 10);
});

test('AC-26: 블록 목록에 계획과 실제 착수·종료일이 보인다', async () => {
  const { html } = await get('/search?q=');
  // 첫 행은 2401-B01 절단 (blocks.csv 첫 데이터 행)
  const b = readCsv('blocks.csv')[0];
  assert.ok(html.includes(b.block_id));
  assert.ok(html.includes(b.planned_start));
  assert.ok(html.includes(b.planned_end));
  assert.ok(html.includes(b.actual_start));
  assert.ok(html.includes(b.actual_end));
});

test('AC-27: 지연 블록에는 지연 사유가 표시된다', async () => {
  const reason = readCsv('delay_reasons.csv')[0];
  const { html, status } = await get(`/search?q=${encodeURIComponent(reason.block_id)}`);
  assert.equal(status, 200);
  assert.ok(html.includes(reason.reason), `${reason.block_id}의 지연 사유 "${reason.reason}"가 있어야 함`);
});

test('AC-28: 설비 고장 이력 화면에 고장 건수와 설비별 요약이 나온다', async () => {
  const failures = readCsv('equipment_failures.csv');
  const { html, status } = await get('/failures');
  assert.equal(status, 200);
  assert.match(html, /설비별 요약/);
  assert.match(html, new RegExp(`고장 ${failures.length}건`));
  assert.match(html, /설비별 정지 시간/);
  for (const f of failures) {
    assert.ok(html.includes(f.failure_id), `고장 ${f.failure_id}가 목록에 있어야 함`);
  }
});
