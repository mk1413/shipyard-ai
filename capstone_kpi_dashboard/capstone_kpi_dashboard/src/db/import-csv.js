'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseCsv } = require('./csv');

// 열 타입: text는 문자열 그대로, int/real은 숫자로 바꾼다. 빈 값은 NULL이다.
const SPEC = {
  daily_production: {
    file: 'daily_production.csv',
    cols: { date: 'text', process: 'text', planned_ton: 'real', actual_ton: 'real',
      inspected_cnt: 'int', defect_cnt: 'int', rework_hr: 'real' },
  },
  equipment: {
    file: 'equipment.csv',
    cols: { date: 'text', equipment_id: 'text', equipment_type: 'text', process: 'text',
      planned_min: 'int', downtime_min: 'real', ideal_ct_min: 'real', total_cnt: 'int', good_cnt: 'int' },
  },
  blocks: {
    file: 'blocks.csv',
    cols: { block_id: 'text', ship_no: 'text', ship_type: 'text', process: 'text', weight_ton: 'real',
      planned_start: 'text', planned_end: 'text', actual_start: 'text', actual_end: 'text',
      planned_mh: 'real', actual_mh: 'real', progress_pct: 'real' },
  },
  equipment_failures: {
    file: 'equipment_failures.csv',
    cols: { failure_id: 'text', date: 'text', equipment_id: 'text', equipment_type: 'text', process: 'text',
      duration_min: 'int', cause: 'text' },
  },
  block_delay_reasons: {
    file: 'delay_reasons.csv',
    cols: { block_id: 'text', process: 'text', reason: 'text', delay_days: 'int' },
  },
};

function convert(value, type) {
  if (value === undefined || value === '') return null;
  if (type === 'text') return value;
  const n = Number(value);
  if (Number.isNaN(n)) throw new Error(`숫자로 읽을 수 없는 값: ${value}`);
  return type === 'int' ? Math.trunc(n) : n;
}

/**
 * CSV 3종을 읽어 테이블을 전부 지운 뒤 다시 넣는다. batch 한 번으로 실행하므로 중간에 실패하면 아무것도 바뀌지 않는다.
 * @param {import('@libsql/client').Client} db
 * @param {string} dataDir CSV 폴더
 */
async function importAll(db, dataDir) {
  const tables = Object.keys(SPEC);
  const parsed = tables.map((t) => {
    const text = fs.readFileSync(path.join(dataDir, SPEC[t].file), 'utf8');
    return { table: t, rows: parseCsv(text), cols: SPEC[t].cols };
  });

  const stmts = [];
  for (const { table } of parsed) stmts.push({ sql: `DELETE FROM ${table};`, args: [] });
  for (const { table, rows, cols } of parsed) {
    const names = Object.keys(cols);
    const sql = `INSERT INTO ${table} (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`;
    for (const row of rows) {
      stmts.push({ sql, args: names.map((n) => convert(row[n], cols[n])) });
    }
  }
  await db.batch(stmts, 'write');
}

module.exports = { importAll };
