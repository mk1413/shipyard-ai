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
const { buildDashboard } = require('../../src/services/dashboard');

const ROOT = path.join(__dirname, '..', '..');
const SECRET = 'dash-test-secret';
const SESSION = signToken({ uid: 1, exp: Date.now() + 3600 * 1000 }, SECRET);
const PROCESSES = ['절단', '소조립', '중조립', '대조립', '도장', '탑재'];

let server;
let base;
let dir;
let db;

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpi-route-'));
  db = openDatabase(path.join(dir, 'app.db'));
  migrateUp(db, path.join(ROOT, 'src', 'db', 'migrations'));
  importAll(db, path.join(ROOT, 'data'));
  const app = createApp({ db, auth: { hashKey: 'dash-test-key', sessionSecret: SECRET, sessionHours: 8 } });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

async function get(query) {
  const res = await fetch(`${base}/${query}`, { headers: { cookie: `kpi_session=${SESSION}` } });
  return { status: res.status, html: await res.text() };
}

// 폼 제출 상태(f=1)에서 공정과 호선을 지정하는 쿼리를 만든다
function query(params) {
  const q = new URLSearchParams({ f: '1' });
  for (const [k, v] of Object.entries(params)) {
    for (const x of [].concat(v)) q.append(k, x);
  }
  return `?${q.toString()}`;
}

test('기본 화면은 200이고 한국어 제목과 KPI 카드를 보여 준다 (FR-1, FR-2)', async () => {
  const { status, html } = await get('');
  assert.equal(status, 200);
  assert.match(html, /조선소 생산 KPI 대시보드/);
  assert.match(html, /생산계획 달성률/);
  assert.match(html, /95\.5%/, '전체 기간 달성률 95.5%');
});

test('AC-10: 전체 기간 기본 화면에 지연 블록 18개 미달 경고가 나온다', async () => {
  const { html } = await get('');
  assert.match(html, /지연 블록 수/);
  assert.match(html, /18개/);
  assert.match(html, /\+18건/);
});

test('AC-07: 공정을 모두 해제하면 안내 문구만 나오고 KPI 카드는 없다', async () => {
  const { status, html } = await get(query({ processes: [] }));
  assert.equal(status, 200);
  assert.match(html, /선택한 조건에 해당하는 데이터가 없습니다\./);
  assert.equal(html.includes('class="kpi-card"'), false);
});

test('AC-06: 직전 기간 데이터가 없으면 증감을 표시하지 않는다', async () => {
  const { html } = await get(query({ start: '2026-09-01', end: '2026-10-31' }));
  assert.equal(html.includes('class="delta"'), false);
});

test('AC-06: 직전 기간 데이터가 있으면 증감을 표시한다', async () => {
  const { html } = await get(query({ start: '2026-10-13', end: '2026-10-17', processes: PROCESSES }));
  assert.match(html, /class="delta"/);
});

test('FR-11: 원본 데이터 행 수는 같은 조건의 생산 데이터 행 수와 같다 (10/13~10/17 = 30행)', async () => {
  const { html } = await get(query({ start: '2026-10-13', end: '2026-10-17', processes: PROCESSES }));
  const rows = html.match(/class="raw-row"/g) || [];
  assert.equal(rows.length, 30);
});

test('AC-13: 호선 필터는 생산 탭 KPI 달성률을 바꾸지 않는다', async () => {
  const all = await get(query({ start: '2026-10-13', end: '2026-10-17', processes: PROCESSES, ships: ['2401', '2402', '2403', '2404'] }));
  const one = await get(query({ start: '2026-10-13', end: '2026-10-17', processes: PROCESSES, ships: ['2401'] }));
  const pick = (h) => h.match(/생산계획 달성률[\s\S]*?(\d+\.\d)%/)[1];
  assert.equal(pick(one.html), pick(all.html));
});

test('AC-16: 응답 HTML에 외부 주소가 없다 (원칙 5)', async () => {
  const { html } = await get('');
  assert.equal(/https?:\/\//.test(html), false);
});

test('정적 파일 vendor/plotly.min.js 를 로컬에서 제공한다 (원칙 5)', async () => {
  const res = await fetch(`${base}/vendor/plotly.min.js`);
  assert.equal(res.status, 200);
});

// P4: 탭 2 데이터 연결 (FR-8, AC-12, T037)
test('P4: 서비스는 블록 탭 차트 blockDonut, blockProgress를 만든다', () => {
  const d = buildDashboard(db, { f: '1', processes: PROCESSES, ships: ['2401', '2402'] });
  assert.ok(d.charts.blockDonut);
  assert.ok(d.charts.blockProgress);
  assert.equal(d.charts.blockDonut.data[0].type, 'pie');
});

test('P4: 블록 선택 목록은 호선·공정 필터를 따르고 기간 필터는 적용하지 않는다', () => {
  const all = buildDashboard(db, { f: '1', processes: PROCESSES, ships: ['2401'] });
  const narrow = buildDashboard(db, { f: '1', processes: PROCESSES, ships: ['2401'], start: '2026-10-13', end: '2026-10-17' });
  assert.ok(all.blocks.length > 0);
  assert.deepEqual(narrow.blocks.map((b) => b.key), all.blocks.map((b) => b.key));
  assert.ok(all.blocks.every((b) => b.ship_no === '2401'));

  const cutOnly = buildDashboard(db, { f: '1', processes: ['절단'], ships: ['2401'] });
  assert.ok(cutOnly.blocks.length > 0);
  assert.ok(cutOnly.blocks.every((b) => b.process === '절단'));
});

test('P4: 블록을 선택하면 간트 차트가 charts.gantt에 있고, 선택한 블록을 돌려준다', () => {
  const base = buildDashboard(db, { f: '1', processes: PROCESSES, ships: ['2401'] });
  const key = base.blocks[0].key;
  const d = buildDashboard(db, { f: '1', processes: PROCESSES, ships: ['2401'], block: key });
  assert.ok(d.charts.gantt);
  assert.equal(d.selectedBlock.key, key);
  assert.equal(d.charts.gantt.data[0].name, '계획');
});

test('P4: 선택한 블록이 없거나 목록에 없으면 간트 차트 키는 없고 selectedBlock은 null이다', () => {
  const none = buildDashboard(db, { f: '1', processes: PROCESSES, ships: ['2401'] });
  assert.equal('gantt' in none.charts, false);
  assert.equal(none.selectedBlock, null);

  const unknown = buildDashboard(db, { f: '1', processes: PROCESSES, ships: ['2401'], block: '없는블록|절단' });
  assert.equal('gantt' in unknown.charts, false);
  assert.equal(unknown.selectedBlock, null);
});

// P5: 탭 2 화면 연결 (FR-8, AC-11 화면, AC-12 표, T037)
function blockSection(html) {
  const start = html.indexOf('data-tab="blocks"');
  if (start < 0) return null;
  const end = html.indexOf('</section>', start);
  return html.slice(start, end);
}

test('P5: 탭 2 섹션(data-tab="blocks")에 도넛, 호선·공정 막대, 간트 영역, 지연 TOP 10 표가 있다', async () => {
  const { status, html } = await get(query({ start: '2026-10-01', end: '2026-10-31', processes: PROCESSES, ships: ['2401'], block: '2401-B01|절단' }));
  assert.equal(status, 200);
  const sec = blockSection(html);
  assert.ok(sec, '탭 2 섹션이 있어야 한다');
  assert.match(sec, /id="chart-block-donut"/);
  assert.match(sec, /id="chart-block-progress"/);
  assert.match(sec, /id="chart-gantt"/);
  const rows = sec.match(/class="top-row"/g) || [];
  assert.ok(rows.length >= 1 && rows.length <= 10, `TOP 10 행 수가 1~10이어야 한다 (현재 ${rows.length})`);
});

test('P5: 블록을 고르지 않으면 간트 영역 대신 안내 문구가 나온다', async () => {
  const { html } = await get(query({ processes: PROCESSES, ships: ['2401'] }));
  const sec = blockSection(html);
  assert.ok(sec);
  assert.equal(sec.includes('id="chart-gantt"'), false);
  assert.match(sec, /블록을 선택하면 간트차트가 표시됩니다/);
});

test('P5: 데이터가 없으면 탭 2 섹션 대신 기존 안내 문구가 나온다', async () => {
  const { html } = await get(query({ processes: [] }));
  assert.equal(html.includes('data-tab="blocks"'), false);
  assert.match(html, /선택한 조건에 해당하는 데이터가 없습니다\./);
});

test('P5: 블록 선택 목록의 옵션은 현재 호선·공정 필터를 따른다', async () => {
  const { html } = await get(query({ processes: ['절단'], ships: ['2401'] }));
  const sel = html.match(/<select name="block"[\s\S]*?<\/select>/);
  assert.ok(sel, '<select name="block">이 있어야 한다');
  const values = [...sel[0].matchAll(/<option value="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(values.length > 0);
  assert.ok(values.every((v) => v.startsWith('2401-') && v.endsWith('|절단')), values.join(', '));
});
