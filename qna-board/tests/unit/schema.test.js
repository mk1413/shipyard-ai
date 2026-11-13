// T004 questions, answers 테이블 마이그레이션 테스트
const { test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { openDatabase } = require('../../src/db/open');
const { migrateUp, migrateDown } = require('../../src/db/migrate');

const MIGRATIONS = path.join(__dirname, '..', '..', 'migrations');

function tempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qna-schema-'));
  return { db: openDatabase(path.join(dir, 'app.db')), dir };
}

function tableNames(db) {
  return db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => r.name);
}

test('up 후 questions, answers 테이블이 있다', () => {
  const { db, dir } = tempDb();
  migrateUp(db, MIGRATIONS);
  const names = tableNames(db);
  assert.ok(names.includes('questions'));
  assert.ok(names.includes('answers'));
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('answers.question_id는 questions.id를 참조한다', () => {
  const { db, dir } = tempDb();
  migrateUp(db, MIGRATIONS);
  const fks = db.prepare('PRAGMA foreign_key_list(answers)').all();
  assert.ok(fks.some((f) => f.table === 'questions' && f.from === 'question_id' && f.to === 'id'));
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('없는 질문에 답변을 달 수 없다 (외래키)', () => {
  const { db, dir } = tempDb();
  migrateUp(db, MIGRATIONS);
  assert.throws(() =>
    db
      .prepare('INSERT INTO answers (question_id, body, created_at) VALUES (?, ?, ?)')
      .run(999, '답변', new Date().toISOString()),
  );
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test('down 전체 후 두 테이블이 사라진다', () => {
  const { db, dir } = tempDb();
  migrateUp(db, MIGRATIONS);
  migrateDown(db, MIGRATIONS, { to: 0 });
  const names = tableNames(db);
  assert.equal(names.includes('questions'), false);
  assert.equal(names.includes('answers'), false);
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
