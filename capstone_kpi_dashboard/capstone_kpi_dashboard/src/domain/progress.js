'use strict';

const { PROCESSES } = require('../config');

/** 진척률 단계 (화면 색과 맞춘다): 90 이상 양호, 70 이상 주의, 그 밖은 미달. */
function level(pct) {
  if (pct == null) return 'none';
  if (pct >= 90) return 'good';
  if (pct >= 70) return 'warn';
  return 'crit';
}

function avg(values) {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/**
 * 호선별, 공정별 진척도를 집계한다.
 * rows: 블록-공정 행 (ship_no, ship_type, process, progress_pct, planned_mh, actual_mh, status, delay_days)
 * 진척률은 행별 progress_pct의 단순 평균이다 (차트와 같은 기준).
 * 맨아워 효율 = 계획 MH 합 ÷ 실적 MH 합 × 100 (실적이 있는 행만).
 */
function progressSummary(rows) {
  const done = rows.filter((r) => r.status.startsWith('완료')).length;
  const delayed = rows.filter((r) => r.delay_days > 0).length;
  const withMh = rows.filter((r) => Number(r.actual_mh) > 0);
  const plannedMh = withMh.reduce((s, r) => s + Number(r.planned_mh), 0);
  const actualMh = withMh.reduce((s, r) => s + Number(r.actual_mh), 0);

  const shipMap = new Map();
  for (const r of rows) {
    if (!shipMap.has(r.ship_no)) shipMap.set(r.ship_no, { ship_no: r.ship_no, ship_type: r.ship_type, rows: [] });
    shipMap.get(r.ship_no).rows.push(r);
  }

  const ships = [...shipMap.values()]
    .sort((a, b) => a.ship_no.localeCompare(b.ship_no))
    .map((s) => {
      const pcts = s.rows.map((r) => Number(r.progress_pct));
      const cells = {};
      for (const p of PROCESSES) {
        const cell = s.rows.filter((r) => r.process === p);
        const a = avg(cell.map((r) => Number(r.progress_pct)));
        cells[p] = { avg: a, count: cell.length, level: level(a) };
      }
      const overall = avg(pcts);
      return {
        ship_no: s.ship_no,
        ship_type: s.ship_type,
        avg: overall,
        level: level(overall),
        count: s.rows.length,
        done: s.rows.filter((r) => r.status.startsWith('완료')).length,
        delayed: s.rows.filter((r) => r.delay_days > 0).length,
        cells,
      };
    });

  return {
    overall: avg(rows.map((r) => Number(r.progress_pct))),
    overallLevel: level(avg(rows.map((r) => Number(r.progress_pct)))),
    total: rows.length,
    done,
    delayed,
    mhEff: actualMh > 0 ? (plannedMh / actualMh) * 100 : null,
    ships,
    processes: PROCESSES,
  };
}

module.exports = { progressSummary, level };
