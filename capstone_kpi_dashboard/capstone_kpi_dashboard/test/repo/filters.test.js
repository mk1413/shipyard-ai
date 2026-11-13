const { test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { openDatabase } = require('../../src/db/open');
const { migrateUp } = require('../../src/db/migrate');
const { importAll } = require('../../src/db/import-csv');
const { normalizeFilters, productionRows, blockRows, bounds } = require('../../src/repo/queries');

const MIGRATIONS = path.join(__dirname, '..', '..', 'src', 'db', 'migrations');
const DATA = path.join(__dirname, '..', '..', 'data');
const PROCESSES = ['절단', '소조립', '중조립', '대조립', '도장', '탑재'];

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpi-flt-'));
  const db = openDatabase(path.join(dir, 'app.db'));
  migrateUp(db, MIGRATIONS);
  importAll(db, DATA);
  return { db, dir };
}

function cleanup({ db, dir }) {
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
}

test('필터가 없으면 전체 기간, 전체 공정, 전체 호선이다 (FR-2 기본값)', () => {
  const ctx = setup();
  const f = normalizeFilters({}, bounds(ctx.db));
  assert.equal(f.start, '2026-09-01');
  assert.equal(f.end, '2026-10-31');
  assert.deepEqual(f.processes, PROCESSES);
  assert.equal(f.ships.length, 4);
  cleanup(ctx);
});

test('기간을 한쪽만 고르면 전체 기간으로 본다 (FR-2)', () => {
  const ctx = setup();
  const f = normalizeFilters({ start: '2026-10-13', end: '' }, bounds(ctx.db));
  assert.equal(f.start, '2026-09-01');
  assert.equal(f.end, '2026-10-31');
  cleanup(ctx);
});

test('폼이 제출되었는데 공정을 모두 해제하면 빈 목록이다 (기본값으로 바뀌지 않는다)', () => {
  const ctx = setup();
  const f = normalizeFilters({ f: '1' }, bounds(ctx.db));
  assert.deepEqual(f.processes, []);
  cleanup(ctx);
});

test('공정 하나만 문자열로 와도 배열로 읽는다', () => {
  const ctx = setup();
  const f = normalizeFilters({ f: '1', processes: '대조립' }, bounds(ctx.db));
  assert.deepEqual(f.processes, ['대조립']);
  cleanup(ctx);
});

test('AC-07: 공정이 없으면 생산 데이터도 0행이다', () => {
  const ctx = setup();
  const f = normalizeFilters({ f: '1' }, bounds(ctx.db));
  assert.equal(productionRows(ctx.db, f).length, 0);
  cleanup(ctx);
});

test('기간 2026-10-13 ~ 10-17은 5일 × 6공정 = 30행이다', () => {
  const ctx = setup();
  const f = normalizeFilters({ start: '2026-10-13', end: '2026-10-17' }, bounds(ctx.db));
  assert.equal(productionRows(ctx.db, f).length, 30);
  cleanup(ctx);
});

test('AC-13: 호선 필터는 블록에만 적용되고 생산 데이터에는 적용되지 않는다', () => {
  const ctx = setup();
  const all = normalizeFilters({}, bounds(ctx.db));
  const oneShip = normalizeFilters({ f: '1', processes: PROCESSES, ships: '2401' }, bounds(ctx.db));
  assert.equal(productionRows(ctx.db, all).length, productionRows(ctx.db, oneShip).length);
  assert.equal(blockRows(ctx.db, oneShip).length, 15 * 6, '호선 하나는 블록 90행');
  assert.ok(blockRows(ctx.db, oneShip).every((r) => r.ship_no === '2401'));
  cleanup(ctx);
});
