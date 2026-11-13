'use strict';

const { all } = require('../db/query');

/**
 * 설비 고장 이력 전체 (최근 순). 설비별 건수와 정지 시간 합계도 함께 돌려준다.
 * @returns {Promise<{rows: object[], byEquipment: object[]}>}
 */
async function listFailures(db) {
  const rows = await all(
    db,
    `SELECT failure_id, date, equipment_id, equipment_type, process, duration_min, cause
     FROM equipment_failures
     ORDER BY date DESC, failure_id DESC`,
  );
  const byEquipment = await all(
    db,
    `SELECT equipment_id, equipment_type, COUNT(*) AS count, SUM(duration_min) AS total_min
     FROM equipment_failures
     GROUP BY equipment_id, equipment_type
     ORDER BY total_min DESC, equipment_id`,
  );
  return { rows, byEquipment };
}

module.exports = { listFailures };
