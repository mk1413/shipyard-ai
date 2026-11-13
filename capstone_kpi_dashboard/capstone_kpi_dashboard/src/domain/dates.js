'use strict';

// 날짜는 YYYY-MM-DD 문자열로 다룬다. 시각 없이 일 단위이므로 UTC 자정 기준으로 계산하면 시간대에 흔들리지 않는다 (원칙 4).
const DAY_MS = 86400000;

function toUtc(iso) {
  return Date.parse(`${iso}T00:00:00Z`);
}

/** a - b 를 일 수로 돌려준다. */
function dayDiff(a, b) {
  return Math.round((toUtc(a) - toUtc(b)) / DAY_MS);
}

/** iso 날짜에 n일을 더한 YYYY-MM-DD를 돌려준다. */
function addDays(iso, n) {
  return new Date(toUtc(iso) + n * DAY_MS).toISOString().slice(0, 10);
}

module.exports = { dayDiff, addDays };
