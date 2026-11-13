'use strict';

// 집계 → 감사 → 보고 문장을 차례로 실행한다.

const { bounds, normalizeFilters } = require('../repo/queries');
const { aggregate } = require('./aggregate');
const { audit } = require('./audit');
const { sentences } = require('./sentences');

/**
 * @param {import('@libsql/client').Client} db
 * @param {Record<string, any>} raw 쿼리 문자열 형태의 필터 (대시보드와 같은 형식)
 * @returns {{figures: object, audit: object, sentences: string[]}}
 */
async function runPipeline(db, raw) {
  const f = normalizeFilters(raw, await bounds(db));
  const figures = await aggregate(db, f);
  const auditResult = audit(figures);
  return { figures, audit: auditResult, sentences: sentences(figures, auditResult) };
}

module.exports = { runPipeline };
