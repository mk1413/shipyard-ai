'use strict';

// 기준일(상태 판정에 쓰는 날짜). 기본값은 한국 시간 기준 오늘이고, 화면에서 다른 날짜를 고를 수 있다.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 한국 시간 기준 오늘 날짜 (YYYY-MM-DD). */
function todayKst(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function isRealDate(v) {
  if (!DATE_RE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/**
 * 요청 쿼리의 asOf 값을 읽는다. 값이 없거나 올바른 날짜가 아니면 오늘을 쓴다.
 * @returns {{asOf: string, custom: boolean}} custom은 사용자가 날짜를 골랐는지 여부다.
 */
function parseAsOf(value, now = new Date()) {
  const v = typeof value === 'string' ? value.trim() : '';
  if (isRealDate(v)) return { asOf: v, custom: true };
  return { asOf: todayKst(now), custom: false };
}

module.exports = { todayKst, parseAsOf, isRealDate };
