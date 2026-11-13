'use strict';

const express = require('express');
const { allBlocksWithStatus } = require('../repo/blocks');
const { progressSummary } = require('../domain/progress');

/** GET /progress : 호선별, 공정별 진척도 (기준 명세 FR-8 확장). 로그인 뒤에 붙는다. */
function progressRouter(db) {
  const router = express.Router();
  router.get('/progress', async (req, res) => {
    const rows = await allBlocksWithStatus(db);
    res.render('progress', { summary: progressSummary(rows) });
  });
  return router;
}

module.exports = { progressRouter };
