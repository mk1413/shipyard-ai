'use strict';

const express = require('express');
const { searchBlocks } = require('../repo/search');

/** GET /search?q= : 블록 검색 (FR-13). 로그인 뒤에 붙는다. */
function searchRouter(db) {
  const router = express.Router();
  router.get('/search', async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    res.render('search', { q, rows: await searchBlocks(db, q) });
  });
  return router;
}

module.exports = { searchRouter };
