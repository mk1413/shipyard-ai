'use strict';

// 모든 비율은 행별 비율의 평균이 아니라 합계끼리 나눈 가중 비율이다 (기준 명세 FR-4).

function sum(rows, key) {
  return rows.reduce((s, r) => s + Number(r[key] || 0), 0);
}

/** 생산계획 달성률(%) = Σ실적 ÷ Σ계획 × 100. 계획 합이 0이면 null (데이터 없음). */
function achieve(production) {
  const planned = sum(production, 'planned_ton');
  if (planned === 0) return null;
  return (sum(production, 'actual_ton') / planned) * 100;
}

/** 불량률(%) = Σ불량 ÷ Σ검사 × 100. 검사 합이 0이면 null. */
function defectRate(production) {
  const inspected = sum(production, 'inspected_cnt');
  if (inspected === 0) return null;
  return (sum(production, 'defect_cnt') / inspected) * 100;
}

/**
 * OEE 세부 값 (기준 명세 FR-4). 분모가 0이면 해당 값은 0이다.
 * @returns {{avail: number, perf: number, qual: number, oee: number}} 가동률, 성능효율, 양품률은 %, oee는 %
 */
function oeeCalc(equipment) {
  const planned = sum(equipment, 'planned_min');
  const run = planned - sum(equipment, 'downtime_min');
  const avail = planned ? run / planned : 0;

  const idealTimesTotal = equipment.reduce((s, r) => s + Number(r.ideal_ct_min) * Number(r.total_cnt), 0);
  const perf = run ? idealTimesTotal / run : 0;

  const total = sum(equipment, 'total_cnt');
  const qual = total ? sum(equipment, 'good_cnt') / total : 0;

  return {
    avail: avail * 100,
    perf: perf * 100,
    qual: qual * 100,
    oee: avail * perf * qual * 100,
  };
}

/**
 * 맨아워 효율(%) = Σ계획 MH ÷ Σ실적 MH × 100. 실적 MH가 있는 행만 쓴다.
 * 대상 행이 없으면 0이다 (Python 원본과 같다).
 */
function mhEfficiency(blocks) {
  const done = blocks.filter((r) => r.actual_mh != null && r.actual_mh !== '');
  if (done.length === 0) return 0;
  const actual = sum(done, 'actual_mh');
  if (actual === 0) return 0;
  return (sum(done, 'planned_mh') / actual) * 100;
}

/** 지연 블록 수 = 지연일이 0보다 큰 블록 id의 고유 개수. */
function delayedBlockCount(blocks) {
  return new Set(blocks.filter((r) => r.delay_days > 0).map((r) => r.block_id)).size;
}

module.exports = { achieve, defectRate, oeeCalc, mhEfficiency, delayedBlockCount };
