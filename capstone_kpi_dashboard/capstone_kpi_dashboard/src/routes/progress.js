'use strict';

const express = require('express');
const { all, get } = require('../db/query');
const { allBlocksWithStatus } = require('../repo/blocks');
const { progressSummary } = require('../domain/progress');
const { achieve, defectRate, oeeCalc } = require('../domain/kpi');
const { kpiStatus } = require('../domain/alerts');
const { shipBarsSvg, processColumnsSvg, trendSvg } = require('../charts/progress-svg');

/** 날짜별 생산 달성률 (계획 대비 실적, %). 날짜 오름차순. */
function dailyAchieve(production) {
  const byDate = new Map();
  for (const r of production) {
    const cur = byDate.get(r.date) || { planned: 0, actual: 0 };
    cur.planned += Number(r.planned_ton);
    cur.actual += Number(r.actual_ton);
    byDate.set(r.date, cur);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, v]) => ({ date, pct: v.planned ? (v.actual / v.planned) * 100 : 0 }));
}

/**
 * 첫 화면(/)과 /progress : 호선별, 공정별 진척도 그래프와 핵심 지표 (기준 명세 FR-4, FR-8 확장).
 * 로그인 뒤에 붙는다.
 */
function progressRouter(db) {
  const router = express.Router();

  async function render(req, res) {
    const rows = await allBlocksWithStatus(db);
    const summary = progressSummary(rows);

    const production = await all(db, 'SELECT * FROM daily_production ORDER BY date, process');
    const equipment = await all(db, 'SELECT * FROM equipment');
    const ach = production.length ? achieve(production) : null;
    const defect = production.length ? defectRate(production) : null;
    const oee = equipment.length ? oeeCalc(equipment).oee : null;

    const failures = await get(db, 'SELECT COUNT(*) AS n, COALESCE(SUM(duration_min), 0) AS minutes FROM equipment_failures');
    const topFailure = (await all(
      db,
      `SELECT equipment_id, COUNT(*) AS n FROM equipment_failures
       GROUP BY equipment_id ORDER BY n DESC, equipment_id LIMIT 1`,
    ))[0];

    const scored = summary.ships.filter((s) => s.avg != null);
    const worst = scored.length ? scored.reduce((a, b) => (b.avg < a.avg ? b : a)) : null;

    res.render('progress', {
      summary,
      worst,
      ach: { value: ach, level: kpiStatus('achieve', ach) },
      defect: { value: defect, level: kpiStatus('defect', defect) },
      oee: { value: oee, level: kpiStatus('oee', oee) },
      failureCount: Number(failures.n),
      failureMinutes: Number(failures.minutes),
      topFailure: topFailure || null,
      shipBarsHtml: shipBarsSvg(summary.ships),
      processHtml: processColumnsSvg(summary.ships, summary.processes),
      trendHtml: trendSvg(dailyAchieve(production)),
    });
  }

  router.get('/', render);
  router.get('/progress', render);
  return router;
}

module.exports = { progressRouter, dailyAchieve };
