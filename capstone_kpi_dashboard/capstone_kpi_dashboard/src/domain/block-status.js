'use strict';

const { dayDiff } = require('./dates');

/**
 * 블록-공정 한 행의 상태와 지연일수 (기준 명세 FR-1).
 * - 실적 시작이 없으면 대기, 시작만 있으면 진행, 종료가 있으면 완료다.
 * - 지연일수는 (실적 종료일 또는 기준일) - 계획 종료일이고, 0 미만은 0이다. 시작하지 않은 행은 0이다.
 * - 지연일수가 0보다 크면 상태 뒤에 "(지연)"을 붙인다.
 * @param {{planned_end: string, actual_start: string|null, actual_end: string|null}} row
 * @param {string} today 기준일 (YYYY-MM-DD)
 * @returns {{status: string, delay_days: number}}
 */
function blockStatus(row, today) {
  const started = row.actual_start != null && row.actual_start !== '';
  const ended = row.actual_end != null && row.actual_end !== '';

  let delay = 0;
  if (started) {
    const endRef = ended ? row.actual_end : today;
    delay = Math.max(0, dayDiff(endRef, row.planned_end));
  }

  let status;
  if (!started) status = '대기';
  else if (ended) status = '완료';
  else status = '진행';
  if (delay > 0) status += '(지연)';

  return { status, delay_days: delay };
}

module.exports = { blockStatus };
