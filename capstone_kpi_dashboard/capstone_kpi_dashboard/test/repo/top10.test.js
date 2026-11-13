// 수용 기준 AC-12 (함수 수준): 지연 TOP 10은 지연일수 내림차순이며 최대 10행이다.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { openDatabase } = require('../../src/db/open');
const { migrateUp } = require('../../src/db/migrate');
const { importAll } = require('../../src/db/import-csv');
const { bounds, normalizeFilters, topDelayed } = require('../../src/repo/queries');

const ROOT = path.join(__dirname, '..', '..');
let dir;
let db;

before(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpi-top-'));
  db = openDatabase(path.join(dir, 'app.db'));
  migrateUp(db, path.join(ROOT, 'src', 'db', 'migrations'));
  importAll(db, path.join(ROOT, 'data'));
});

after(() => {
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('AC-12: 최대 10행이다', () => {
  const f = normalizeFilters({}, bounds(db));
  assert.ok(topDelayed(db, f, 10).length <= 10);
});

test('AC-12: 지연일수가 0보다 큰 행만 넣고, 내림차순이다', () => {
  const f = normalizeFilters({}, bounds(db));
  const rows = topDelayed(db, f, 10);
  assert.ok(rows.length > 0);
  assert.ok(rows.every((r) => r.delay_days > 0));
  for (let i = 1; i < rows.length; i++) {
    assert.ok(rows[i - 1].delay_days >= rows[i].delay_days);
  }
});
