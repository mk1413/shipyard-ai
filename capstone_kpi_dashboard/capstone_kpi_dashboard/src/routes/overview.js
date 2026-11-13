'use strict';

const express = require('express');

/** GET /overview : 발표용 구성도 (구조도, 발표 흐름, 체크리스트 항목별 위치). 로그인 뒤에 붙는다. */
function overviewRouter() {
  const router = express.Router();
  router.get('/overview', (req, res) => {
    res.render('overview');
  });
  return router;
}

module.exports = { overviewRouter };
