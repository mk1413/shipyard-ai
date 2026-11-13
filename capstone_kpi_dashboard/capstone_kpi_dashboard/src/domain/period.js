'use strict';

const { dayDiff, addDays } = require('./dates');

/**
 * 직전 기간 (기준 명세 FR-5). 선택 기간과 길이가 같고, 바로 앞에 있다.
 * @returns {{start: string, end: string}}
 */
function previousPeriod(start, end) {
  const span = dayDiff(end, start) + 1;
  return {
    start: addDays(start, -span),
    end: addDays(start, -1),
  };
}

/**
 * 실적 기간이 선택 기간과 겹치는 블록-공정 행만 남긴다 (AC-18).
 * - 실적 시작이 없는 행(대기)은 제외한다.
 * - 실적 종료가 없는 행(진행 중)은 기준일까지를 실적 기간으로 본다.
 */
function blocksInPeriod(rows, start, end, today) {
  return rows.filter((r) => {
    const started = r.actual_start != null && r.actual_start !== '';
    if (!started) return false;
    const endRef = r.actual_end != null && r.actual_end !== '' ? r.actual_end : today;
    return r.actual_start <= end && endRef >= start;
  });
}

module.exports = { previousPeriod, blocksInPeriod };
