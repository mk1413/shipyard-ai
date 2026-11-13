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

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpi-top-'));
  db = await openDatabase(path.join(dir, 'app.db'));
  await migrateUp(db, path.join(ROOT, 'src', 'db', 'migrations'));
  await importAll(db, path.join(ROOT, 'data'));
});

after(async () => {
  db.close();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* Windows에서 libsql이 파일 핸들을 늦게 놓아 임시 폴더 삭제가 실패할 수 있다 */ }
});

test('AC-12: 최대 10행이다', async () => {
  const f = normalizeFilters({}, await bounds(db));
  assert.ok((await topDelayed(db, f, 10)).length <= 10);
});

test('AC-12: 지연일수가 0보다 큰 행만 넣고, 내림차순이다', async () => {
  const f = normalizeFilters({}, await bounds(db));
  const rows = await topDelayed(db, f, 10);
  assert.ok(rows.length > 0);
  assert.ok(rows.every((r) => r.delay_days > 0));
  for (let i = 1; i < rows.length; i++) {
    assert.ok(rows[i - 1].delay_days >= rows[i].delay_days);
  }
});
