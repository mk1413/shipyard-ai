// T053 [US6] 0003 마이그레이션 데이터 보존 테스트
// 검색 인덱스(0003)를 되돌려도 원본 데이터(생산, 설비, 블록)는 그대로여야 한다.
const { all, get } = require('../../src/db/query');
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

async function counts(d) {
  const n = async (t) => (await get(d, `SELECT COUNT(*) AS n FROM ${t}`)).n;
  return { daily_production: await n('daily_production'), equipment: await n('equipment'), blocks: await n('blocks') };
}

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpi-mig-data-'));
  db = await openDatabase(path.join(dir, 'app.db'));
  await migrateUp(db, MIGRATIONS);
  await importAll(db, path.join(ROOT, 'data'));
});

after(async () => {
  db.close();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* Windows에서 libsql이 파일 핸들을 늦게 놓아 임시 폴더 삭제가 실패할 수 있다 */ }
});

test('0003을 되돌려도 생산, 설비, 블록 행 수가 그대로다', async () => {
  const before = await counts(db);
  assert.equal(await currentVersion(db), 3);
  await migrateDown(db, MIGRATIONS, { to: 2 });
  assert.equal(await currentVersion(db), 2);
  assert.deepEqual(await counts(db), before);
});

test('0003을 되돌리면 검색 인덱스 테이블만 사라진다', async () => {
  const tables = (await all(db, "SELECT name FROM sqlite_master WHERE type = 'table'")).map((r) => r.name);
  assert.equal(tables.includes('blocks_fts'), false);
  assert.ok(tables.includes('blocks'));
});

test('되돌린 뒤 다시 올리면 검색이 다시 동작한다 (인덱스 재생성)', async () => {
  await migrateUp(db, MIGRATIONS);
  assert.equal(await currentVersion(db), 3);
  assert.ok((await searchBlocks(db, '대조립')).length > 0);
});

test('되돌리기 전에 백업 파일이 생긴다', async () => {
  const backup = path.join(dir, 'before-down.db');
  await migrateDown(db, MIGRATIONS, { to: 2, backupPath: backup });
  assert.ok(fs.existsSync(backup));
  await migrateUp(db, MIGRATIONS);
});
