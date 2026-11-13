// T053 [US6] 0003 마이그레이션 데이터 보존 테스트
// 검색 인덱스(0003)를 되돌려도 원본 데이터(생산, 설비, 블록)는 그대로여야 한다.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { openDatabase } = require('../../src/db/open');
const { migrateUp, migrateDown, currentVersion } = require('../../src/db/migrate');
const { importAll } = require('../../src/db/import-csv');
const { searchBlocks } = require('../../src/repo/search');

const ROOT = path.join(__dirname, '..', '..');
const MIGRATIONS = path.join(ROOT, 'src', 'db', 'migrations');
let dir;
let db;

function counts(d) {
  const n = (t) => d.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
  return { daily_production: n('daily_production'), equipment: n('equipment'), blocks: n('blocks') };
}

before(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpi-mig-data-'));
  db = openDatabase(path.join(dir, 'app.db'));
  migrateUp(db, MIGRATIONS);
  importAll(db, path.join(ROOT, 'data'));
});

after(() => {
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('0003을 되돌려도 생산, 설비, 블록 행 수가 그대로다', () => {
  const before = counts(db);
  assert.equal(currentVersion(db), 3);
  migrateDown(db, MIGRATIONS, { to: 2 });
  assert.equal(currentVersion(db), 2);
  assert.deepEqual(counts(db), before);
});

test('0003을 되돌리면 검색 인덱스 테이블만 사라진다', () => {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => r.name);
  assert.equal(tables.includes('blocks_fts'), false);
  assert.ok(tables.includes('blocks'));
});

test('되돌린 뒤 다시 올리면 검색이 다시 동작한다 (인덱스 재생성)', () => {
  migrateUp(db, MIGRATIONS);
  assert.equal(currentVersion(db), 3);
  assert.ok(searchBlocks(db, '대조립').length > 0);
});

test('되돌리기 전에 백업 파일이 생긴다', () => {
  const backup = path.join(dir, 'before-down.db');
  migrateDown(db, MIGRATIONS, { to: 2, backupPath: backup });
  assert.ok(fs.existsSync(backup));
  migrateUp(db, MIGRATIONS);
});
