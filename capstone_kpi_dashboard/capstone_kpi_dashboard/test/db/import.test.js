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

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpi-imp-'));
  const db = openDatabase(path.join(dir, 'app.db'));
  migrateUp(db, MIGRATIONS);
  return { db, dir };
}

function dataRowCount(file) {
  const text = fs.readFileSync(path.join(DATA, file), 'utf8');
  return parseCsv(text).length;
}

test('임포트 후 행 수가 CSV 데이터 행 수와 같다', () => {
  const { db, dir } = setup();
  importAll(db, DATA);
  const count = (t) => db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
  assert.equal(count('blocks'), dataRowCount('blocks.csv'));
  assert.equal(count('blocks'), 360, '블록-공정은 360행이어야 함 (기준 명세 §3.3)');
  assert.equal(count('equipment'), dataRowCount('equipment.csv'));
  assert.equal(count('daily_production'), dataRowCount('daily_production.csv'));
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('설비 코드는 8종이다', () => {
  const { db, dir } = setup();
  importAll(db, DATA);
  const n = db.prepare('SELECT COUNT(DISTINCT equipment_id) AS n FROM equipment').get().n;
  assert.equal(n, 8);
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('빈 실적 날짜는 NULL로 들어간다', () => {
  const { db, dir } = setup();
  importAll(db, DATA);
  const nullStart = db.prepare('SELECT COUNT(*) AS n FROM blocks WHERE actual_start IS NULL').get().n;
  const emptyStrings = db.prepare("SELECT COUNT(*) AS n FROM blocks WHERE actual_start = ''").get().n;
  assert.equal(emptyStrings, 0);
  assert.ok(nullStart > 0, '대기 블록이 있어야 함');
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('호선 번호는 앞자리 0을 보존한 문자열이다', () => {
  const { db, dir } = setup();
  importAll(db, DATA);
  const row = db.prepare("SELECT ship_no FROM blocks WHERE block_id = '2401-B01' LIMIT 1").get();
  assert.equal(row.ship_no, '2401');
  assert.equal(typeof row.ship_no, 'string');
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('두 번 임포트해도 행 수가 늘지 않는다 (전체 재적재)', () => {
  const { db, dir } = setup();
  importAll(db, DATA);
  importAll(db, DATA);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM blocks').get().n, 360);
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
