'use strict';

const express = require('express');
const { all } = require('../db/query');
const { searchBlocks } = require('../repo/search');
const { listBlocks } = require('../repo/blocks');
const { listFailures } = require('../repo/failures');
const { STATUS_OPTIONS, parseFilters, filterBlocks } = require('../domain/block-filter');
const { equipmentBarsSvg } = require('../charts/progress-svg');
const { parseAsOf } = require('../domain/as-of');

/** 현재 검색 조건을 유지한 주소를 만든다. 값이 '전체'(all)나 빈 값이면 주소에서 뺀다. */
function buildHref(params) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '' && v !== 'all') p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `/search?${s}` : '/search';
}

/**
 * GET /search : 검색어가 없으면 전체 블록 목록(상태, 호선 필터 포함)을, 있으면 검색 결과를 보여 준다 (FR-13).
 * GET /failures : 설비 고장 이력과 설비별 정지 시간 그래프. 로그인 뒤에 붙는다.
 */
function searchRouter(db) {
  const router = express.Router();

  router.get('/search', async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const ships = (await all(db, 'SELECT DISTINCT ship_no FROM blocks ORDER BY ship_no')).map((r) => r.ship_no);
    const filters = parseFilters(req.query, ships);
    const { asOf, custom } = parseAsOf(req.query.asOf);
    // 사용자가 기준일을 골랐을 때만 주소에 남긴다 (기본값은 오늘이므로 주소에 넣지 않는다)
    const keep = custom ? { asOf } : {};

    // 상태 탭과 호선 칩의 주소 (검색어, 다른 필터, 기준일은 그대로 유지)
    const links = {
      status: Object.fromEntries(STATUS_OPTIONS.map((o) => [o.key, buildHref({ q, status: o.key, ship: filters.ship, ...keep })])),
      ship: Object.fromEntries(['all', ...ships].map((s) => [s, buildHref({ q, status: filters.status, ship: s, ...keep })])),
      page: (n) => buildHref({ q, status: filters.status, ship: filters.ship, page: n, ...keep }),
    };
    const common = { q, filters, ships, statusOptions: STATUS_OPTIONS, links, asOf, asOfCustom: custom };

    if (q.trim() === '') {
      const list = await listBlocks(db, req.query.page, filters, asOf);
      res.render('search', { ...common, mode: 'list', ...list });
      return;
    }
    const rows = filterBlocks(await searchBlocks(db, q, asOf), filters);
    res.render('search', { ...common, mode: 'search', rows, total: rows.length, allTotal: null, page: 1, pageCount: 1 });
  });

  router.get('/failures', async (req, res) => {
    const data = await listFailures(db);
    res.render('failures', { ...data, chartHtml: equipmentBarsSvg(data.byEquipment) });
  });

  return router;
}

module.exports = { searchRouter };
