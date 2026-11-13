'use strict';

// 블록 목록의 필터 조건 (상태, 호선). 상태는 block-status.js가 만든 status 문자열로 판정한다.
const STATUS_OPTIONS = [
  { key: 'all', label: '전체' },
  { key: 'delayed', label: '지연' },
  { key: 'progress', label: '진행' },
  { key: 'done', label: '완료' },
  { key: 'waiting', label: '대기' },
];

function matchesStatus(row, key) {
  switch (key) {
    case 'delayed': return row.delay_days > 0;
    case 'progress': return row.status.startsWith('진행');
    case 'done': return row.status.startsWith('완료');
    case 'waiting': return row.status.startsWith('대기');
    default: return true;
  }
}

/** 요청 쿼리에서 안전한 필터 값만 꺼낸다. 알 수 없는 값은 전체로 본다. */
function parseFilters(query, ships) {
  const status = STATUS_OPTIONS.some((o) => o.key === query.status) ? query.status : 'all';
  const ship = ships.includes(String(query.ship)) ? String(query.ship) : 'all';
  return { status, ship };
}

function filterBlocks(rows, { status = 'all', ship = 'all' } = {}) {
  return rows.filter((r) => (ship === 'all' || r.ship_no === ship) && matchesStatus(r, status));
}

module.exports = { STATUS_OPTIONS, parseFilters, filterBlocks, matchesStatus };
