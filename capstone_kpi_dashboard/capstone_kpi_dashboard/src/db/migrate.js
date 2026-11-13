'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * 마이그레이션 파일 목록. 파일 이름은 `NNNN_이름.up.sql`, `NNNN_이름.down.sql` 형식이다.
 * @param {string} dir
 * @returns {{version: number, name: string, upFile: string, downFile: string}[]}
 */
function listMigrations(dir) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.up.sql'));
  return files
    .map((f) => {
      const m = /^(\d{4})_(.+)\.up\.sql$/.exec(f);
      if (!m) throw new Error(`마이그레이션 파일 이름 형식 오류: ${f}`);
      const base = f.slice(0, -'.up.sql'.length);
      return {
        version: Number(m[1]),
        name: m[2],
        upFile: path.join(dir, f),
        downFile: path.join(dir, `${base}.down.sql`),
      };
    })
    .sort((a, b) => a.version - b.version);
}

function ensureHistoryTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
}

/** 현재 적용된 가장 높은 버전. 없으면 0. */
function currentVersion(db) {
  ensureHistoryTable(db);
  const row = db.prepare('SELECT MAX(version) AS v FROM schema_migrations').get();
  return row.v == null ? 0 : Number(row.v);
}

function inTransaction(db, fn) {
  db.exec('BEGIN');
  try {
    fn();
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/** 아직 적용되지 않은 마이그레이션을 버전 순서대로 적용한다. */
function migrateUp(db, dir) {
  ensureHistoryTable(db);
  const applied = currentVersion(db);
  for (const m of listMigrations(dir)) {
    if (m.version <= applied) continue;
    const sql = fs.readFileSync(m.upFile, 'utf8');
    inTransaction(db, () => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(
        m.version,
        m.name,
        new Date().toISOString(),
      );
    });
  }
}

/**
 * `to` 버전까지 되돌린다. `to`보다 큰 버전의 down 파일을 역순으로 실행한다.
 * @param {object} opts
 * @param {number} opts.to 남길 가장 높은 버전 (0이면 전부 되돌림)
 * @param {string} [opts.backupPath] 지정하면 되돌리기 전에 VACUUM INTO로 백업한다. 백업이 실패하면 중단한다.
 */
function migrateDown(db, dir, { to, backupPath }) {
  ensureHistoryTable(db);
  if (backupPath) {
    db.prepare('VACUUM INTO ?').run(backupPath);
  }
  const all = listMigrations(dir);
  const targets = all.filter((m) => m.version > to).sort((a, b) => b.version - a.version);
  for (const m of targets) {
    const applied = db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(m.version);
    if (!applied) continue;
    const sql = fs.readFileSync(m.downFile, 'utf8');
    inTransaction(db, () => {
      db.exec(sql);
      db.prepare('DELETE FROM schema_migrations WHERE version = ?').run(m.version);
    });
  }
}

module.exports = { listMigrations, migrateUp, migrateDown, currentVersion };
