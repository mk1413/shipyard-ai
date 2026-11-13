// 수용 기준 AC-22, AC-23, AC-24 (함수 수준): 블록 검색.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { openDatabase } = require('../../src/db/open');
const { migrateUp } = require('../../src/db/migrate');
const { importAll } = require('../../src/db/import-csv');
const { searchBlocks } = require('../../src/repo/search');

const ROOT = path.join(__dirname, '..', '..');
let dir;
let db;

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpi-search-'));
  db = await openDatabase(path.join(dir, 'app.db'));
  await migrateUp(db, path.join(ROOT, 'src', 'db', 'migrations'));
  await importAll(db, path.join(ROOT, 'data'));
});

after(async () => {
  db.close();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* Windows에서 libsql이 파일 핸들을 늦게 놓아 임시 폴더 삭제가 실패할 수 있다 */ }
});

test('AC-22: 3자 이상 한글 부분 일치로 찾는다', async () => {
  const rows = await searchBlocks(db, '대조립');
  assert.ok(rows.length > 0);
  assert.ok(rows.every((r) => r.process === '대조립'));
});

test('AC-22: 호선 번호와 선종 일부로도 찾는다', async () => {
  assert.ok((await searchBlocks(db, '2401')).every((r) => r.ship_no === '2401'));
  assert.ok((await searchBlocks(db, '운반선')).length > 0);
});

test('AC-23: 2자 질의는 LIKE로 찾는다', async () => {
  const rows = await searchBlocks(db, '도장');
  assert.ok(rows.length > 0);
  assert.ok(rows.every((r) => r.process === '도장'));
});

test('AC-24: 빈 질의는 결과가 없고 오류가 없다', async () => {
  assert.deepEqual(await searchBlocks(db, ''), []);
  assert.deepEqual(await searchBlocks(db, '   '), []);
});

test('AC-24: FTS 특수문자가 들어가도 예외 없이 처리된다', async () => {
  await assert.doesNotReject(searchBlocks(db, '"*:() OR NOT'));
});

test('AC-24: 결과는 100건을 넘지 않는다', async () => {
  assert.ok((await searchBlocks(db, '2401')).length <= 100);
  assert.ok((await searchBlocks(db, 'B')).length <= 100);
});

test('검색 결과 행에는 상태(지연 포함)가 붙는다', async () => {
  const row = (await searchBlocks(db, '대조립'))[0];
  assert.ok(typeof row.status === 'string');
  assert.ok(typeof row.delay_days === 'number');
});
