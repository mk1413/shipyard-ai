'use strict';

const express = require('express');
const { searchBlocks } = require('../repo/search');
const { listBlocks } = require('../repo/blocks');
const { listFailures } = require('../repo/failures');

/**
 * GET /search : 검색어가 없으면 전체 블록 목록을 페이지 단위로, 있으면 검색 결과를 보여 준다 (FR-13).
 * GET /failures : 설비 고장 이력 (설비별 요약 포함). 로그인 뒤에 붙는다.
 */
function searchRouter(db) {
  const router = express.Router();

  router.get('/search', async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    if (q.trim() === '') {
      const list = await listBlocks(db, req.query.page);
      res.render('search', { q, mode: 'list', ...list });
      return;
    }
    const rows = await searchBlocks(db, q);
    res.render('search', { q, mode: 'search', rows, total: rows.length, page: 1, pageCount: 1 });
  });

  router.get('/failures', async (req, res) => {
    const data = await listFailures(db);
    res.render('failures', data);
  });

  return router;
}

module.exports = { searchRouter };
