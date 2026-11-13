'use strict';

// 1단계 집계: 필터된 데이터에서 보고에 쓸 숫자만 모은다. 판단은 하지 않는다.

const { TODAY } = require('../config');
const { productionRows, equipmentRows, blockRows } = require('../repo/queries');
const { achieve, defectRate, oeeCalc, mhEfficiency, delayedBlockCount } = require('../domain/kpi');
const { blocksInPeriod } = require('../domain/period');

/**
 * @param {import('@libsql/client').Client} db
 * @param {{start: string, end: string, processes: string[], ships: string[]}} f 정규화된 필터
 */
async function aggregate(db, f) {
  const P = await productionRows(db, f);
  const E = await equipmentRows(db, f);
  const B = await blockRows(db, f);

  const planned = P.reduce((s, r) => s + Number(r.planned_ton), 0);
  const actual = P.reduce((s, r) => s + Number(r.actual_ton), 0);
  const inspected = P.reduce((s, r) => s + Number(r.inspected_cnt), 0);
  const defects = P.reduce((s, r) => s + Number(r.defect_cnt), 0);

  return {
    empty: P.length === 0,
    period: { start: f.start, end: f.end },
    production: {
      rows: P.length,
      planned,
      actual,
      achieve: achieve(P),
      inspected,
      defects,
      defectRate: defectRate(P),
    },
    equipment: {
      rows: E.length,
      oee: E.length ? oeeCalc(E).oee : null,
    },
    blocks: {
      rows: B.length,
      delayed: delayedBlockCount(B),
      mhEff: mhEfficiency(blocksInPeriod(B, f.start, f.end, TODAY)),
    },
  };
}

module.exports = { aggregate };
