'use strict';

const express = require('express');
const { buildDashboard } = require('../services/dashboard');

/** GET / : 대시보드 화면 (기준 명세 FR-2, FR-3, FR-11). 로그인 적용은 Phase 5에서 붙인다. */
function dashboardRouter(db) {
  const router = express.Router();
  router.get('/', (req, res) => {
    const data = buildDashboard(db, req.query);
    res.render('dashboard', { data });
  });
  return router;
}

module.exports = { dashboardRouter };
