const { all, get } = require('../../src/db/query');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { openDatabase } = require('../../src/db/open');
const { migrateUp } = require('../../src/db/migrate');
const { importAll } = require('../../src/db/import-csv');
const { parseCsv } = require('../../src/db/csv');

const MIGRATIONS = path.join(__dirname, '..', '..', 'src', 'db', 'migrations');
const DATA = path.join(__dirname, '..', '..', 'data');

async function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpi-imp-'));
  const db = await openDatabase(path.join(dir, 'app.db'));
  await migrateUp(db, MIGRATIONS);
  return { db, dir };
}

async function dataRowCount(file) {
  const text = fs.readFileSync(path.join(DATA, file), 'utf8');
  return parseCsv(text).length;
}

test('임포트 후 행 수가 CSV 데이터 행 수와 같다', async () => {
  const { db, dir } = await setup();
  await importAll(db, DATA);
  const count = async (t) => (await get(db, `SELECT COUNT(*) AS n FROM ${t}`)).n;
  assert.equal(await count('blocks'), await dataRowCount('blocks.csv'));
  assert.equal(await count('blocks'), 360, '블록-공정은 360행이어야 함 (기준 명세 §3.3)');
  assert.equal(await count('equipment'), await dataRowCount('equipment.csv'));
  assert.equal(await count('daily_production'), await dataRowCount('daily_production.csv'));
  db.close();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* Windows에서 libsql이 파일 핸들을 늦게 놓아 임시 폴더 삭제가 실패할 수 있다 */ }
});

test('설비 코드는 8종이다', async () => {
  const { db, dir } = await setup();
  await importAll(db, DATA);
  const n = (await get(db, 'SELECT COUNT(DISTINCT equipment_id) AS n FROM equipment')).n;
  assert.equal(n, 8);
  db.close();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* Windows에서 libsql이 파일 핸들을 늦게 놓아 임시 폴더 삭제가 실패할 수 있다 */ }
});

test('빈 실적 날짜는 NULL로 들어간다', async () => {
  const { db, dir } = await setup();
  await importAll(db, DATA);
  const nullStart = (await get(db, 'SELECT COUNT(*) AS n FROM blocks WHERE actual_start IS NULL')).n;
  const emptyStrings = (await get(db, "SELECT COUNT(*) AS n FROM blocks WHERE actual_start = ''")).n;
  assert.equal(emptyStrings, 0);
  assert.ok(nullStart > 0, '대기 블록이 있어야 함');
  db.close();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* Windows에서 libsql이 파일 핸들을 늦게 놓아 임시 폴더 삭제가 실패할 수 있다 */ }
});

test('호선 번호는 앞자리 0을 보존한 문자열이다', async () => {
  const { db, dir } = await setup();
  await importAll(db, DATA);
  const row = (await get(db, "SELECT ship_no FROM blocks WHERE block_id = '2401-B01' LIMIT 1"));
  assert.equal(row.ship_no, '2401');
  assert.equal(typeof row.ship_no, 'string');
  db.close();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* Windows에서 libsql이 파일 핸들을 늦게 놓아 임시 폴더 삭제가 실패할 수 있다 */ }
});

test('두 번 임포트해도 행 수가 늘지 않는다 (전체 재적재)', async () => {
  const { db, dir } = await setup();
  await importAll(db, DATA);
  await importAll(db, DATA);
  assert.equal((await get(db, 'SELECT COUNT(*) AS n FROM blocks')).n, 360);
  db.close();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* Windows에서 libsql이 파일 핸들을 늦게 놓아 임시 폴더 삭제가 실패할 수 있다 */ }
});
