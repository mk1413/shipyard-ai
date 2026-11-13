'use strict';

const { TODAY, PROCESSES } = require('../config');
const { blockStatus } = require('../domain/block-status');

/** 필터 선택지의 범위(기간, 공정, 호선)를 DB에서 읽는다. */
function bounds(db) {
  const r = db.prepare('SELECT MIN(date) AS minDate, MAX(date) AS maxDate FROM daily_production').get();
  const ships = db
    .prepare('SELECT DISTINCT ship_no FROM blocks ORDER BY ship_no')
    .all()
    .map((x) => x.ship_no);
  return { minDate: r.minDate, maxDate: r.maxDate, processes: PROCESSES, ships };
}

function asList(v) {
  if (v == null) return [];
  const list = Array.isArray(v) ? v : [v];
  return list.filter((x) => x !== '');
}

/**
 * 쿼리 문자열을 필터로 바꾼다 (기준 명세 FR-2).
 * - 기간: 시작과 끝이 둘 다 있을 때만 적용한다. 아니면 전체 기간이다.
 * - 공정, 호선: 폼이 제출된 상태(f=1)에서는 받은 값만 쓴다. 전부 해제하면 빈 목록이다.
 *   폼이 아직 제출되지 않았으면(f 없음) 전체를 쓴다.
 */
function normalizeFilters(raw, b) {
  const submitted = raw.f === '1';
  const hasPeriod = Boolean(raw.start && raw.end);
  let start = hasPeriod ? raw.start : b.minDate;
  let end = hasPeriod ? raw.end : b.maxDate;
  if (start > end) [start, end] = [end, start];

  const processes = submitted
    ? asList(raw.processes).filter((p) => b.processes.includes(p))
    : b.processes;
  const ships = submitted ? asList(raw.ships).filter((s) => b.ships.includes(s)) : b.ships;

  return { start, end, processes, ships };
}

function placeholders(list) {
  return list.map(() => '?').join(', ');
}

/** 생산 데이터 (기간, 공정). 호선 필터는 적용하지 않는다. */
function productionRows(db, f) {
  if (f.processes.length === 0) return [];
  return db
    .prepare(
      `SELECT * FROM daily_production
       WHERE date BETWEEN ? AND ? AND process IN (${placeholders(f.processes)})
       ORDER BY date, process`,
    )
    .all(f.start, f.end, ...f.processes);
}

/** 설비 데이터 (기간, 공정). */
function equipmentRows(db, f) {
  if (f.processes.length === 0) return [];
  return db
    .prepare(
      `SELECT * FROM equipment
       WHERE date BETWEEN ? AND ? AND process IN (${placeholders(f.processes)})
       ORDER BY date, equipment_id`,
    )
    .all(f.start, f.end, ...f.processes);
}

/**
 * 블록-공정 데이터 (호선, 공정). 기간 필터는 적용하지 않는다 (기간은 맨아워 계산에서만 쓴다).
 * 각 행에 상태와 지연일수를 붙여 돌려준다.
 */
function blockRows(db, f) {
  if (f.processes.length === 0 || f.ships.length === 0) return [];
  const rows = db
    .prepare(
      `SELECT * FROM blocks
       WHERE ship_no IN (${placeholders(f.ships)}) AND process IN (${placeholders(f.processes)})
       ORDER BY block_id, process`,
    )
    .all(...f.ships, ...f.processes);
  return rows.map((r) => ({ ...r, ...blockStatus(r, TODAY) }));
}

/** 지연 TOP N (FR-8): 지연일수가 0보다 큰 블록-공정을 지연일수 내림차순으로 n개까지. */
function topDelayed(db, f, n) {
  return blockRows(db, f)
    .filter((r) => r.delay_days > 0)
    .sort((a, b) => b.delay_days - a.delay_days || a.block_id.localeCompare(b.block_id))
    .slice(0, n);
}

module.exports = { bounds, normalizeFilters, productionRows, equipmentRows, blockRows, topDelayed };
