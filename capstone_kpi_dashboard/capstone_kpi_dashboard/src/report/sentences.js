'use strict';

// 3단계 보고 문장: 집계와 감사 결과를 한국어 문장으로 바꾼다. 사번과 이름은 넣지 않는다 (원칙 3).

const { TARGET } = require('../domain/alerts');

const NO_DATA = '선택한 조건에 해당하는 데이터가 없습니다.';

/**
 * @param {ReturnType<import('./aggregate').aggregate>} figures
 * @param {ReturnType<import('./audit').audit>} auditResult
 * @returns {string[]}
 */
function sentences(figures, auditResult) {
  if (figures.empty) return [NO_DATA];

  const out = [];
  if (!auditResult.ok) {
    out.push(`감사에서 ${auditResult.issues.length}건의 문제가 있어 수치를 확인해야 합니다.`);
  }

  const { period, production: p, equipment: e, blocks: b } = figures;
  out.push(`${period.start} ~ ${period.end} 기간을 집계했습니다.`);

  if (p.achieve != null) {
    const ok = p.achieve >= TARGET.achieve;
    out.push(`생산계획 달성률은 ${p.achieve.toFixed(1)}%로 ${ok ? `목표 ${TARGET.achieve}% 이상을 충족합니다.` : `목표 ${TARGET.achieve}%에 미달합니다.`}`);
  }

  if (p.defectRate != null) {
    const ok = p.defectRate <= TARGET.defect;
    out.push(`불량률은 ${p.defectRate.toFixed(2)}%로 ${ok ? `목표 ${TARGET.defect}% 이하를 충족합니다.` : `목표 ${TARGET.defect}%를 넘었습니다.`}`);
  }

  if (e.oee != null) {
    out.push(`설비 종합효율(OEE)은 ${e.oee.toFixed(1)}%입니다.`);
  }

  out.push(`지연 블록은 ${b.delayed}개입니다 (목표 ${TARGET.delay}개 이하).`);

  return out;
}

module.exports = { sentences };
