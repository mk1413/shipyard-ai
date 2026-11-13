'use strict';

const { TODAY } = require('../config');
const { blockStatus } = require('../domain/block-status');
const { all } = require('../db/query');

const LIMIT = 100;

/** 3자 이상은 FTS5 trigram, 2자 이하는 LIKE로 찾는다 (FR-13). 빈 질의는 결과가 없다. */
async function searchBlocks(db, rawQuery) {
  const q = String(rawQuery ?? '').trim();
  if (q === '') return [];

  let rows;
  if ([...q].length >= 3) {
    // 구문 검색으로 감싼다. 안의 큰따옴표는 두 번 써서 이스케이프한다.
    const match = `"${q.replace(/"/g, '""')}"`;
    rows = await all(
      db,
      `SELECT b.* FROM blocks_fts f JOIN blocks b ON b.id = f.rowid
       WHERE blocks_fts MATCH ?
       ORDER BY b.block_id, b.process
       LIMIT ?`,
      [match, LIMIT],
    );
  } else {
    const esc = q.replace(/[\\%_]/g, (c) => `\\${c}`);
    const like = `%${esc}%`;
    rows = await all(
      db,
      `SELECT * FROM blocks
       WHERE block_id LIKE ? ESCAPE '\\' OR ship_no LIKE ? ESCAPE '\\'
          OR ship_type LIKE ? ESCAPE '\\' OR process LIKE ? ESCAPE '\\'
       ORDER BY block_id, process
       LIMIT ?`,
      [like, like, like, like, LIMIT],
    );
  }

  return rows.map((r) => ({ ...r, ...blockStatus(r, TODAY) }));
}

module.exports = { searchBlocks };
