const { all, get } = require('../../src/db/query');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { openDatabase } = require('../../src/db/open');
const { migrateUp, migrateDown, currentVersion } = require('../../src/db/migrate');

const MIGRATIONS = path.join(__dirname, '..', '..', 'src', 'db', 'migrations');

async function snapshot(db) {
  return all(db, "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name");
}

async function tempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpi-mig-'));
  return { db: await openDatabase(path.join(dir, 'app.db')), dir };
}

test('up 전체 적용 후 버전이 최신이다', async () => {
  const { db, dir } = await tempDb();
  await migrateUp(db, MIGRATIONS);
  assert.ok(await currentVersion(db) >= 1);
  const tables = (await all(db, "SELECT name FROM sqlite_master WHERE type='table'")).map((r) => r.name);
  for (const t of ['daily_production', 'equipment', 'blocks', 'schema_migrations']) {
    assert.ok(tables.includes(t), `테이블 ${t}가 있어야 함`);
  }
  db.close();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* Windows에서 libsql이 파일 핸들을 늦게 놓아 임시 폴더 삭제가 실패할 수 있다 */ }
});

test('down 전체 후 up 하면 스키마가 처음과 같다 (왕복)', async () => {
  const { db, dir } = await tempDb();
  await migrateUp(db, MIGRATIONS);
  const first = await snapshot(db);
  await migrateDown(db, MIGRATIONS, { to: 0 });
  assert.equal(await currentVersion(db), 0);
  const afterDown = (await snapshot(db)).filter((r) => r.name !== 'schema_migrations');
  assert.equal(afterDown.length, 0, 'down 후 사용자 테이블이 없어야 함');
  await migrateUp(db, MIGRATIONS);
  assert.deepEqual(await snapshot(db), first);
  db.close();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* Windows에서 libsql이 파일 핸들을 늦게 놓아 임시 폴더 삭제가 실패할 수 있다 */ }
});

test('같은 up을 두 번 실행해도 오류 없이 넘어간다', async () => {
  const { db, dir } = await tempDb();
  await migrateUp(db, MIGRATIONS);
  await assert.doesNotReject(migrateUp(db, MIGRATIONS));
  db.close();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* Windows에서 libsql이 파일 핸들을 늦게 놓아 임시 폴더 삭제가 실패할 수 있다 */ }
});

test('down --to 는 지정한 버전까지만 되돌린다', async () => {
  const { db, dir } = await tempDb();
  await migrateUp(db, MIGRATIONS);
  await migrateDown(db, MIGRATIONS, { to: 1 });
  assert.equal(await currentVersion(db), 1);
  db.close();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* Windows에서 libsql이 파일 핸들을 늦게 놓아 임시 폴더 삭제가 실패할 수 있다 */ }
});

test('down 전에 백업 경로를 주면 백업 파일이 생긴다', async () => {
  const { db, dir } = await tempDb();
  await migrateUp(db, MIGRATIONS);
  const backup = path.join(dir, 'backup.db');
  await migrateDown(db, MIGRATIONS, { to: 0, backupPath: backup });
  assert.ok(fs.existsSync(backup));
  db.close();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* Windows에서 libsql이 파일 핸들을 늦게 놓아 임시 폴더 삭제가 실패할 수 있다 */ }
});
