// 수용 기준 AC-32 ~ AC-34: 첫 화면의 핵심 지표와 추이, 블록 목록 필터, 설비별 정지 시간 그래프.
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
const { all } = require('../../src/db/query');
const { loadBlocks } = require('../../src/repo/blocks');
const { achieve, defectRate, oeeCalc } = require('../../src/domain/kpi');

const ROOT = path.join(__dirname, '..', '..');
const SECRET = 'final-secret';
const SESSION = signToken({ uid: 1, exp: Date.now() + 3600 * 1000 }, SECRET);

let server;
let base;
let dir;
let db;

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpi-acc-final-'));
  db = await openDatabase(path.join(dir, 'app.db'));
  await migrateUp(db, path.join(ROOT, 'src', 'db', 'migrations'));
  await importAll(db, path.join(ROOT, 'data'));
  const app = createApp({ db, auth: { hashKey: 'final-key', sessionSecret: SECRET, sessionHours: 8 } });
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

test('AC-32: 첫 화면에 생산 달성률, 불량률, OEE가 계산 함수 결과와 같은 값으로 나온다', async () => {
  const production = await all(db, 'SELECT * FROM daily_production');
  const equipment = await all(db, 'SELECT * FROM equipment');
  const { status, html } = await get('/progress');
  assert.equal(status, 200);
  assert.ok(html.includes(`${achieve(production).toFixed(1)}%`), '생산 달성률 값이 있어야 함');
  assert.ok(html.includes(`${defectRate(production).toFixed(1)}%`), '불량률 값이 있어야 함');
  assert.ok(html.includes(`${oeeCalc(equipment).oee.toFixed(1)}%`), 'OEE 값이 있어야 함');
  assert.ok(html.includes('일별 생산 달성률 추이'), '일별 추이 그래프 제목이 있어야 함');
  assert.ok(html.includes('aria-label="일별 생산 달성률 추이 그래프"'), '일별 추이 그래프가 SVG로 있어야 함');
});

test('AC-33: 상태 필터 지연을 고르면 지연 블록-공정만 남는다', async () => {
  const blocks = await loadBlocks(db, '2026-10-31');
  const delayed = blocks.filter((b) => b.delay_days > 0).length;
  const { status, html } = await get('/search?status=delayed&asOf=2026-10-31');
  assert.equal(status, 200);
  assert.match(html, new RegExp(`필터 결과 <strong>${delayed}<\\/strong>건`));
  // 지연이 아닌 행은 없어야 한다: 지연 배지 수는 행 수와 같거나 적어야 함 (첫 페이지 50행 이내)
  const rows = (html.match(/class="search-row"/g) || []).length;
  assert.equal(rows, Math.min(50, delayed));
});

test('AC-33: 호선 필터 2401을 고르면 2401호선 블록만 남는다', async () => {
  const { status, html } = await get('/search?ship=2401');
  assert.equal(status, 200);
  assert.match(html, /필터 결과 <strong>90<\/strong>건/);
  assert.ok(!/<td>2402<\/td>/.test(html), '다른 호선 행이 없어야 함');
});

test('AC-34: 설비 고장 화면에 설비별 정지 시간 막대그래프가 있다', async () => {
  const { status, html } = await get('/failures');
  assert.equal(status, 200);
  assert.ok(html.includes('aria-label="설비별 정지 시간 막대 그래프"'), '설비별 막대그래프가 있어야 함');
});

test('AC-35: 기본 기준일은 오늘(한국 시간)이고, 기준일을 고르면 상태 판정이 그 날짜로 바뀐다', async () => {
  const { todayKst } = require('../../src/domain/as-of');
  const today = todayKst();
  const home = await get('/search');
  assert.ok(home.html.includes(`value="${today}"`), '기본 기준일 칸에 오늘 날짜가 있어야 함');

  for (const day of ['2026-09-15', '2026-10-31']) {
    const expected = (await loadBlocks(db, day)).filter((b) => b.delay_days > 0).length;
    const { html } = await get(`/search?status=delayed&asOf=${day}`);
    assert.match(html, new RegExp(`필터 결과 <strong>${expected}<\\/strong>건`), `${day} 기준 지연 건수`);
  }
});

test('AC-36: 블록 목록에 계획 MH, 실적 MH, MH 효율이 보이고, 첫 화면에 호선별 맨아워 효율이 있다', async () => {
  const first = (await loadBlocks(db, '2026-10-31'))[0];
  const eff = (Number(first.planned_mh) / Number(first.actual_mh)) * 100;
  const { html } = await get('/search?asOf=2026-10-31');
  assert.ok(html.includes(Number(first.planned_mh).toFixed(1)), '블록 계획 MH가 있어야 함');
  assert.ok(html.includes(Number(first.actual_mh).toFixed(1)), '블록 실적 MH가 있어야 함');
  assert.ok(html.includes(`${eff.toFixed(1)}%`), '블록 MH 효율이 있어야 함');

  const ship = (await all(db, "SELECT * FROM blocks WHERE ship_no = '2401' AND actual_mh > 0"));
  const plannedSum = ship.reduce((s, r) => s + Number(r.planned_mh), 0);
  const actualSum = ship.reduce((s, r) => s + Number(r.actual_mh), 0);
  const home = await get('/progress');
  assert.ok(home.html.includes(`${((plannedSum / actualSum) * 100).toFixed(1)}%`), '2401호선 맨아워 효율이 있어야 함');
  assert.ok(home.html.includes('호선별 맨아워 효율'), '호선별 맨아워 표 제목이 있어야 함');
});
