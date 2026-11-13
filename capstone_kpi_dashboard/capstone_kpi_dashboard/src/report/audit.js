'use strict';

// 2단계 감사: 집계 결과가 서로 맞는지, 가능한 범위 안인지 확인한다. 값을 고치지는 않는다.

const EPS = 1e-9;

/**
 * @param {ReturnType<import('./aggregate').aggregate>} figures
 * @returns {{ok: boolean, issues: {code: string, message: string}[]}}
 */
function audit(figures) {
  const issues = [];
  const { empty, production: p, equipment: e, blocks: b } = figures;

  if (!empty && p.rows === 0) {
    issues.push({ code: 'no_production', message: '데이터가 있다고 표시되었지만 생산 행이 0개입니다.' });
  }

  if (p.achieve != null && (p.achieve < 0 || p.achieve > 200)) {
    issues.push({ code: 'achieve_out_of_range', message: `달성률 ${p.achieve}%가 0~200% 범위를 벗어났습니다.` });
  }

  if (p.defects > p.inspected) {
    issues.push({ code: 'defects_exceed_inspected', message: '불량 건수가 검사 건수보다 많습니다.' });
  }

  if (p.inspected > 0 && p.defectRate != null) {
    const expected = (p.defects / p.inspected) * 100;
    if (Math.abs(expected - p.defectRate) > EPS) {
      issues.push({ code: 'defect_rate_mismatch', message: '불량률이 불량 건수와 검사 건수로 계산한 값과 다릅니다.' });
    }
  }

  if (b.delayed > b.rows) {
    issues.push({ code: 'delayed_exceeds_rows', message: '지연 블록 수가 블록 행 수보다 많습니다.' });
  }

  if (e.oee != null && (e.oee < 0 || e.oee > 100)) {
    issues.push({ code: 'oee_out_of_range', message: `OEE ${e.oee}%가 0~100% 범위를 벗어났습니다.` });
  }

  return { ok: issues.length === 0, issues };
}

module.exports = { audit };
