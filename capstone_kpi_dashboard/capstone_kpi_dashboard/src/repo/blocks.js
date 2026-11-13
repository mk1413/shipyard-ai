'use strict';

const { TODAY } = require('../config');
const { blockStatus } = require('../domain/block-status');
const { filterBlocks } = require('../domain/block-filter');
const { all } = require('../db/query');

const PAGE_SIZE = 50;

/** 블록-공정 한 행에 상태와 지연일수를 붙인다. 지연 사유는 LEFT JOIN으로 이미 붙어 있다. */
function withStatus(r) {
  return { ...r, ...blockStatus(r, TODAY) };
}

/** 전체 블록-공정 행을 지연 사유와 함께 읽고 상태를 붙인다 (블록 목록과 집계에서 같이 쓴다). */
async function loadBlocks(db) {
  const rows = await all(
    db,
    `SELECT b.*, r.reason AS delay_reason
     FROM blocks b
     LEFT JOIN block_delay_reasons r ON r.block_id = b.block_id AND r.process = b.process
     ORDER BY b.ship_no, b.block_id, b.process`,
  );
  return rows.map(withStatus);
}

/**
 * 블록-공정 목록을 필터(상태, 호선)로 거른 뒤 페이지 단위로 돌려준다.
 * @param {{status?: string, ship?: string}} filters
 * @returns {Promise<{rows: object[], total: number, allTotal: number, page: number, pageCount: number}>}
 */
async function listBlocks(db, requestedPage, filters = {}) {
  const everything = await loadBlocks(db);
  const matched = filterBlocks(everything, filters);
  const total = matched.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(Number(requestedPage) || 1)), pageCount);
  const rows = matched.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return { rows, total, allTotal: everything.length, page, pageCount };
}

/** 전체 블록-공정 행에 상태와 지연일수를 붙여 돌려준다 (진척도 집계용). */
async function allBlocksWithStatus(db) {
  return loadBlocks(db);
}

module.exports = { listBlocks, allBlocksWithStatus, loadBlocks, withStatus, PAGE_SIZE };
