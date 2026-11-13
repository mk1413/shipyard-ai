const { all, get } = require('../../src/db/query');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { openDatabase } = require('../../src/db/open');
const { migrateUp } = require('../../src/db/migrate');
const { seedUsers } = require('../../src/auth/seed-users');
const { hashEmployeeNo, hashName } = require('../../src/auth/hash');

const MIGRATIONS = path.join(__dirname, '..', '..', 'src', 'db', 'migrations');
const KEY = 'test-key-123';

async function setup(csvText) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpi-seed-'));
  const csv = path.join(dir, 'users.csv');
  fs.writeFileSync(csv, csvText, 'utf8');
  const db = await openDatabase(path.join(dir, 'app.db'));
  await migrateUp(db, MIGRATIONS);
  return { db, dir, csv };
}

test('명단을 읽어 해시로 저장한다', async () => {
  const { db, dir, csv } = await setup('사번,이름\n1001,홍길동\n1002,김철수\n');
  const n = await seedUsers(db, csv, KEY);
  assert.equal(n, 2);
  const row = (await get(db, 'SELECT employee_hash, name_hash FROM users WHERE employee_hash = ?', [hashEmployeeNo('1001', KEY)]));
  assert.equal(row.name_hash, hashName('홍길동', KEY));
  db.close();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* Windows에서 libsql이 파일 핸들을 늦게 놓아 임시 폴더 삭제가 실패할 수 있다 */ }
});

test('DB 어디에도 사번과 이름 평문이 없다', async () => {
  const { db, dir, csv } = await setup('사번,이름\n1001,홍길동\n');
  await seedUsers(db, csv, KEY);
  const dump = JSON.stringify((await all(db, 'SELECT * FROM users')));
  assert.equal(dump.includes('1001'), false);
  assert.equal(dump.includes('홍길동'), false);
  db.close();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* Windows에서 libsql이 파일 핸들을 늦게 놓아 임시 폴더 삭제가 실패할 수 있다 */ }
});

test('다시 시드하면 명단이 통째로 바뀐다 (삭제된 사람은 빠진다)', async () => {
  const { db, dir, csv } = await setup('사번,이름\n1001,홍길동\n1002,김철수\n');
  await seedUsers(db, csv, KEY);
  fs.writeFileSync(csv, '사번,이름\n1002,김철수\n', 'utf8');
  await seedUsers(db, csv, KEY);
  assert.equal((await get(db, 'SELECT COUNT(*) AS n FROM users')).n, 1);
  db.close();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* Windows에서 libsql이 파일 핸들을 늦게 놓아 임시 폴더 삭제가 실패할 수 있다 */ }
});

test('사번이나 이름이 비어 있는 행이 있으면 실패하고 기존 명단을 지우지 않는다', async () => {
  const { db, dir, csv } = await setup('사번,이름\n1001,홍길동\n');
  await seedUsers(db, csv, KEY);
  fs.writeFileSync(csv, '사번,이름\n1002,\n', 'utf8');
  await assert.rejects(seedUsers(db, csv, KEY), /빈 값/);
  assert.equal((await get(db, 'SELECT COUNT(*) AS n FROM users')).n, 1);
  db.close();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* Windows에서 libsql이 파일 핸들을 늦게 놓아 임시 폴더 삭제가 실패할 수 있다 */ }
});

test('사번이 중복되면 실패한다', async () => {
  const { db, dir, csv } = await setup('사번,이름\n1001,홍길동\n1001,김철수\n');
  await assert.rejects(seedUsers(db, csv, KEY));
  db.close();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* Windows에서 libsql이 파일 핸들을 늦게 놓아 임시 폴더 삭제가 실패할 수 있다 */ }
});
