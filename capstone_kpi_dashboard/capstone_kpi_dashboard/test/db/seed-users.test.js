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

function setup(csvText) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpi-seed-'));
  const csv = path.join(dir, 'users.csv');
  fs.writeFileSync(csv, csvText, 'utf8');
  const db = openDatabase(path.join(dir, 'app.db'));
  migrateUp(db, MIGRATIONS);
  return { db, dir, csv };
}

test('명단을 읽어 해시로 저장한다', () => {
  const { db, dir, csv } = setup('사번,이름\n1001,홍길동\n1002,김철수\n');
  const n = seedUsers(db, csv, KEY);
  assert.equal(n, 2);
  const row = db.prepare('SELECT employee_hash, name_hash FROM users WHERE employee_hash = ?').get(hashEmployeeNo('1001', KEY));
  assert.equal(row.name_hash, hashName('홍길동', KEY));
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('DB 어디에도 사번과 이름 평문이 없다', () => {
  const { db, dir, csv } = setup('사번,이름\n1001,홍길동\n');
  seedUsers(db, csv, KEY);
  const dump = JSON.stringify(db.prepare('SELECT * FROM users').all());
  assert.equal(dump.includes('1001'), false);
  assert.equal(dump.includes('홍길동'), false);
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('다시 시드하면 명단이 통째로 바뀐다 (삭제된 사람은 빠진다)', () => {
  const { db, dir, csv } = setup('사번,이름\n1001,홍길동\n1002,김철수\n');
  seedUsers(db, csv, KEY);
  fs.writeFileSync(csv, '사번,이름\n1002,김철수\n', 'utf8');
  seedUsers(db, csv, KEY);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 1);
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('사번이나 이름이 비어 있는 행이 있으면 실패하고 기존 명단을 지우지 않는다', () => {
  const { db, dir, csv } = setup('사번,이름\n1001,홍길동\n');
  seedUsers(db, csv, KEY);
  fs.writeFileSync(csv, '사번,이름\n1002,\n', 'utf8');
  assert.throws(() => seedUsers(db, csv, KEY), /빈 값/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 1);
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('사번이 중복되면 실패한다', () => {
  const { db, dir, csv } = setup('사번,이름\n1001,홍길동\n1001,김철수\n');
  assert.throws(() => seedUsers(db, csv, KEY));
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
