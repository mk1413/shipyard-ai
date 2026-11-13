'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { get } = require('./query');

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

async function ensureHistoryTable(db) {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
}

/** 현재 적용된 가장 높은 버전. 없으면 0. */
async function currentVersion(db) {
  await ensureHistoryTable(db);
  const row = await get(db, 'SELECT MAX(version) AS v FROM schema_migrations');
  return row.v == null ? 0 : Number(row.v);
}

/** 트랜잭션 안에서 fn(tx)를 실행한다. 실패하면 롤백한다. */
async function inTransaction(db, fn) {
  const tx = await db.transaction('write');
  try {
    await fn(tx);
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  } finally {
    tx.close();
  }
}

/** 아직 적용되지 않은 마이그레이션을 버전 순서대로 적용한다. */
async function migrateUp(db, dir) {
  await ensureHistoryTable(db);
  const applied = await currentVersion(db);
  for (const m of listMigrations(dir)) {
    if (m.version <= applied) continue;
    const sql = fs.readFileSync(m.upFile, 'utf8');
    await inTransaction(db, async (tx) => {
      await tx.executeMultiple(sql);
      await tx.execute({
        sql: 'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
        args: [m.version, m.name, new Date().toISOString()],
      });
    });
  }
}

/**
 * `to` 버전까지 되돌린다. `to`보다 큰 버전의 down 파일을 역순으로 실행한다.
 * @param {object} opts
 * @param {number} opts.to 남길 가장 높은 버전 (0이면 전부 되돌림)
 * @param {string} [opts.backupPath] 지정하면 되돌리기 전에 VACUUM INTO로 백업한다. 백업이 실패하면 중단한다.
 */
async function migrateDown(db, dir, { to, backupPath }) {
  await ensureHistoryTable(db);
  if (backupPath) {
    await db.execute({ sql: 'VACUUM INTO ?', args: [backupPath] });
  }
  const migrations = listMigrations(dir);
  const targets = migrations.filter((m) => m.version > to).sort((a, b) => b.version - a.version);
  for (const m of targets) {
    const applied = await get(db, 'SELECT 1 AS ok FROM schema_migrations WHERE version = ?', [m.version]);
    if (!applied) continue;
    const sql = fs.readFileSync(m.downFile, 'utf8');
    await inTransaction(db, async (tx) => {
      await tx.executeMultiple(sql);
      await tx.execute({ sql: 'DELETE FROM schema_migrations WHERE version = ?', args: [m.version] });
    });
  }
}

module.exports = { listMigrations, migrateUp, migrateDown, currentVersion };
