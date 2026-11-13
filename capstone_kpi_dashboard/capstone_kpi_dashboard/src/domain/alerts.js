'use strict';

// 목표값과 판정 구간 (기준 명세 FR-6). Python kpi_alerts.py와 같은 값이다.
const TARGET = { achieve: 95, oee: 75, defect: 3, mh_eff: 95, delay: 0 };
const WARN_MARGIN = { achieve: 3, oee: 5, defect: 0.5, mh_eff: 3, delay: 4 };
const HIGHER_IS_BETTER = { achieve: true, oee: true, defect: false, mh_eff: true, delay: false };

const STATUS_ICON = { ok: '🟢', warn: '🟡', crit: '🔴', na: '⚪' };

/**
 * KPI 값을 판정한다. 'ok' | 'warn' | 'crit' | 'na'(데이터 없음).
 * 주의 구간은 목표에서 WARN_MARGIN 이내, 그보다 나쁘면 미달이다.
 */
function kpiStatus(key, value) {
  if (value == null || Number.isNaN(value)) return 'na';
  const target = TARGET[key];
  const margin = WARN_MARGIN[key];
  if (HIGHER_IS_BETTER[key]) {
    if (value >= target) return 'ok';
    if (value >= target - margin) return 'warn';
    return 'crit';
  }
  if (value <= target) return 'ok';
  if (value <= target + margin) return 'warn';
  return 'crit';
}

function signed(n, digits) {
  return (n < 0 ? '-' : '+') + Math.abs(n).toFixed(digits);
}

/** 목표 대비 차이 문구. 예: '-3.8%p', '+5건' */
function gapText(key, value) {
  const diff = value - TARGET[key];
  if (key === 'delay') return `${signed(diff, 0)}건`;
  return `${signed(diff, 1)}%p`;
}

module.exports = { TARGET, WARN_MARGIN, HIGHER_IS_BETTER, STATUS_ICON, kpiStatus, gapText };
