const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../../src/db/open');

test('openDatabase: 외래키 제약이 켜져 있다', () => {
  const db = openDatabase(':memory:');
  const row = db.prepare('PRAGMA foreign_keys').get();
  assert.equal(row.foreign_keys, 1);
  db.close();
});

test('openDatabase: 파일 DB는 WAL 모드로 연다', () => {
  const os = require('node:os');
  const path = require('node:path');
  const fs = require('node:fs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpi-open-'));
  const file = path.join(dir, 'app.db');
  const db = openDatabase(file);
  const row = db.prepare('PRAGMA journal_mode').get();
  assert.equal(row.journal_mode, 'wal');
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
