'use strict';

const crypto = require('node:crypto');
const { get } = require('../db/query');
const { hashEmployeeNo, hashName } = require('./hash');

/**
 * 사번과 이름이 명단과 맞는지 확인한다.
 * 맞으면 users.id를, 틀리면 null을 돌려준다. 어느 쪽이 틀렸는지는 알려 주지 않는다.
 * 입력값과 해시는 로그에 남기지 않는다 (원칙 3).
 */
async function verifyLogin(db, hashKey, employeeNo, name) {
  let employeeHash;
  let nameHash;
  try {
    employeeHash = hashEmployeeNo(employeeNo, hashKey);
    nameHash = hashName(name, hashKey);
  } catch {
    return null; // 빈 입력
  }

  const row = await get(db, 'SELECT id, name_hash FROM users WHERE employee_hash = ?', [employeeHash]);
  if (!row) return null;

  const a = Buffer.from(row.name_hash, 'utf8');
  const b = Buffer.from(nameHash, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return row.id;
}

module.exports = { verifyLogin };
