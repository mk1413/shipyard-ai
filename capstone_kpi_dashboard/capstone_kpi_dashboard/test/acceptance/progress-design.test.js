// 수용 기준 AC-29 ~ AC-30: 호선·공정 진척도 화면과 공통 디자인.
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
const { parseCsv } = require('../../src/db/csv');

const ROOT = path.join(__dirname, '..', '..');
const SECRET = 'design-secret';
const SESSION = signToken({ uid: 1, exp: Date.now() + 3600 * 1000 }, SECRET);
const PROCESSES = ['절단', '소조립', '중조립', '대조립', '도장', '탑재'];

let server;
let base;
let dir;
let db;

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpi-acc-design-'));
  db = await openDatabase(path.join(dir, 'app.db'));
  await migrateUp(db, path.join(ROOT, 'src', 'db', 'migrations'));
  await importAll(db, path.join(ROOT, 'data'));
  const app = createApp({ db, auth: { hashKey: 'design-key', sessionSecret: SECRET, sessionHours: 8 } });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.close();
  db.close();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* Windows에서 libsql이 파일 핸들을 늦게 놓아 임시 폴더 삭제가 실패할 수 있다 */ }
});

async function get(pathAndQuery, withCookie = true) {
  const headers = withCookie ? { cookie: `kpi_session=${SESSION}` } : {};
  const res = await fetch(`${base}${pathAndQuery}`, { headers });
  return { status: res.status, type: res.headers.get('content-type') || '', html: await res.text() };
}

test('AC-29: 진척도 화면에 호선 4개, 공정 6개, 전체 평균 진척률이 나온다', async () => {
  const blocks = parseCsv(fs.readFileSync(path.join(ROOT, 'data', 'blocks.csv'), 'utf8'));
  const avg = blocks.reduce((s, b) => s + Number(b.progress_pct), 0) / blocks.length;
  const { status, html } = await get('/progress');

  assert.equal(status, 200);
  for (const p of PROCESSES) assert.ok(html.includes(`<th class="num">${p}</th>`), `공정 ${p} 열이 있어야 함`);
  for (const ship of ['2401', '2402', '2403', '2404']) assert.ok(html.includes(`<strong>${ship}</strong>`), `호선 ${ship} 행이 있어야 함`);
  assert.ok(html.includes(`${avg.toFixed(1)}%`), `전체 평균 ${avg.toFixed(1)}%가 있어야 함`);
});

test('AC-31: 첫 화면의 그래프는 호선별 막대와 공정별 막대를 SVG로 그리고, 목표 90% 선을 표시한다', async () => {
  const { status, html } = await get('/progress');
  assert.equal(status, 200);
  assert.ok(html.includes('aria-label="호선별 전체 진척률 막대 그래프"'), '호선별 막대 그래프가 있어야 함');
  assert.ok(html.includes('aria-label="호선별 공정 진척률 막대 그래프"'), '공정별 막대 그래프가 있어야 함');
  assert.ok(html.includes('목표 90%'), '목표 선 표시가 있어야 함');
  assert.equal((html.match(/class="col s\d"/g) || []).length, 24, '호선 4 × 공정 6 = 막대 24개');
});

test('AC-30: 주요 화면은 공통 스타일과 탭 메뉴를 쓰고, 스타일 파일은 로그인 없이 열린다', async () => {
  for (const p of ['/progress', '/search', '/failures']) {
    const { html } = await get(p);
    assert.ok(html.includes('href="/assets/app.css"'), `${p}는 공통 스타일을 불러와야 함`);
    assert.ok(html.includes('href="/"') && html.includes('href="/search"') && html.includes('href="/failures"'), `${p}에 탭 메뉴가 있어야 함`);
  }
  const css = await get('/assets/app.css', false);
  assert.equal(css.status, 200);
  assert.match(css.type, /text\/css/);
  assert.ok(!/https?:\/\//.test(css.html), '스타일 파일은 외부 주소를 쓰지 않는다 (원칙 5)');
});
