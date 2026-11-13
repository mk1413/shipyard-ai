'use strict';

const fs = require('node:fs');
const { parseCsv } = require('../db/csv');
const { hashEmployeeNo, hashName } = require('./hash');

/**
 * 명단 CSV(사번, 이름)를 읽어 users 테이블을 해시로 다시 채운다.
 * 명단 전체를 먼저 검사하고, 문제가 없을 때만 기존 명단을 지운다. 한 트랜잭션이다.
 * 오류 메시지에는 사번과 이름 값을 넣지 않고 행 번호만 넣는다.
 * @returns {number} 저장한 사람 수
 */
function seedUsers(db, csvPath, key) {
  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  const seen = new Set();
  const prepared = rows.map((row, idx) => {
    const lineNo = idx + 2; // 헤더 다음 줄부터
    let employeeHash;
    let nameHash;
    try {
      employeeHash = hashEmployeeNo(row['사번'], key);
      nameHash = hashName(row['이름'], key);
    } catch (err) {
      throw new Error(`명단 ${lineNo}행: ${err.message}`);
    }
    if (seen.has(employeeHash)) {
      throw new Error(`명단 ${lineNo}행: 사번이 중복되었습니다`);
    }
    seen.add(employeeHash);
    return { employeeHash, nameHash };
  });

  const now = new Date().toISOString();
  db.exec('BEGIN');
  try {
    db.exec('DELETE FROM users;');
    const stmt = db.prepare(
      'INSERT INTO users (employee_hash, name_hash, created_at) VALUES (?, ?, ?)',
    );
    for (const p of prepared) stmt.run(p.employeeHash, p.nameHash, now);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return prepared.length;
}

module.exports = { seedUsers };
