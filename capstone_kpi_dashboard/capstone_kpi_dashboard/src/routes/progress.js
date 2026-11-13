'use strict';

const express = require('express');
const { all, get } = require('../db/query');
const { allBlocksWithStatus } = require('../repo/blocks');
const { progressSummary } = require('../domain/progress');
const { shipBarsSvg, processColumnsSvg } = require('../charts/progress-svg');

/**
 * 첫 화면(/)과 /progress : 호선별, 공정별 진척도 그래프와 지표 (기준 명세 FR-8 확장). 로그인 뒤에 붙는다.
 */
function progressRouter(db) {
  const router = express.Router();

  async function render(req, res) {
    const rows = await allBlocksWithStatus(db);
    const summary = progressSummary(rows);
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
      failureCount: Number(failures.n),
      failureMinutes: Number(failures.minutes),
      topFailure: topFailure || null,
      shipBarsHtml: shipBarsSvg(summary.ships),
      processHtml: processColumnsSvg(summary.ships, summary.processes),
    });
  }

  router.get('/', render);
  router.get('/progress', render);
  return router;
}

module.exports = { progressRouter };
