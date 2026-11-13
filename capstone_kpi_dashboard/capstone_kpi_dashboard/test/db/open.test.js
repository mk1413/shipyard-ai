const { all, get } = require('../../src/db/query');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../../src/db/open');

test('openDatabase: 외래키 제약이 켜져 있다', async () => {
  const db = await openDatabase(':memory:');
  const row = (await get(db, 'PRAGMA foreign_keys'));
  assert.equal(row.foreign_keys, 1);
  db.close();
});

test('openDatabase: 파일 DB는 WAL 모드로 연다', async () => {
  const os = require('node:os');
  const path = require('node:path');
  const fs = require('node:fs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpi-open-'));
  const file = path.join(dir, 'app.db');
  const db = await openDatabase(file);
  const row = (await get(db, 'PRAGMA journal_mode'));
  assert.equal(row.journal_mode, 'wal');
  db.close();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* Windows에서 libsql이 파일 핸들을 늦게 놓아 임시 폴더 삭제가 실패할 수 있다 */ }
});
