'use strict';

const crypto = require('node:crypto');

/**
 * 입력을 정규화한다. 앞뒤 공백을 자르고 유니코드를 NFC로 맞춘다.
 * 오류 메시지에는 입력값을 넣지 않는다 (원칙 3).
 */
function normalize(value) {
  const v = String(value ?? '').trim().normalize('NFC');
  if (v === '') throw new Error('normalize: 빈 값은 허용되지 않습니다');
  return v;
}

function hmac(value, key) {
  if (!key) throw new Error('해시 키가 없습니다');
  return crypto.createHmac('sha256', key).update(value, 'utf8').digest('hex');
}

function hashEmployeeNo(employeeNo, key) {
  return hmac(normalize(employeeNo), key);
}

function hashName(name, key) {
  return hmac(normalize(name), key);
}

module.exports = { normalize, hashEmployeeNo, hashName };
