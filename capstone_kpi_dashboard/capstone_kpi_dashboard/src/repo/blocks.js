'use strict';

const { TODAY } = require('../config');
const { blockStatus } = require('../domain/block-status');
const { all, get } = require('../db/query');

const PAGE_SIZE = 50;

/** 블록-공정 한 행에 상태와 지연일수를 붙인다. 지연 사유는 LEFT JOIN으로 이미 붙어 있다. */
function withStatus(r) {
  return { ...r, ...blockStatus(r, TODAY) };
}

/**
 * 전체 블록-공정 목록을 페이지 단위로 돌려준다 (호선, 공정, 블록 순).
 * @returns {Promise<{rows: object[], total: number, page: number, pageCount: number}>}
 */
async function listBlocks(db, requestedPage) {
  const total = Number((await get(db, 'SELECT COUNT(*) AS n FROM blocks')).n);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(Number(requestedPage) || 1)), pageCount);

  const rows = await all(
    db,
    `SELECT b.*, r.reason AS delay_reason
     FROM blocks b
     LEFT JOIN block_delay_reasons r ON r.block_id = b.block_id AND r.process = b.process
     ORDER BY b.ship_no, b.block_id, b.process
     LIMIT ? OFFSET ?`,
    [PAGE_SIZE, (page - 1) * PAGE_SIZE],
  );
  return { rows: rows.map(withStatus), total, page, pageCount };
}

/** 전체 블록-공정 행에 상태와 지연일수를 붙여 돌려준다 (진척도 집계용). */
async function allBlocksWithStatus(db) {
  const rows = await all(db, 'SELECT * FROM blocks ORDER BY ship_no, block_id, process');
  return rows.map(withStatus);
}

module.exports = { listBlocks, allBlocksWithStatus, withStatus, PAGE_SIZE };
