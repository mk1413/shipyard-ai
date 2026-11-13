const { test } = require('node:test');
const assert = require('node:assert/strict');
const { hashEmployeeNo, hashName, normalize } = require('../../src/auth/hash');

const KEY = 'test-key-123';

test('같은 입력과 같은 키는 같은 해시를 낸다', () => {
  assert.equal(hashEmployeeNo('1001', KEY), hashEmployeeNo('1001', KEY));
  assert.equal(hashName('홍길동', KEY), hashName('홍길동', KEY));
});

test('키가 다르면 해시가 다르다', () => {
  assert.notEqual(hashEmployeeNo('1001', KEY), hashEmployeeNo('1001', 'other-key'));
});

test('해시 결과에 원래 값이 그대로 들어 있지 않다', () => {
  const h = hashName('홍길동', KEY);
  assert.equal(h.includes('홍길동'), false);
  assert.match(h, /^[0-9a-f]{64}$/);
});

test('앞뒤 공백과 유니코드 정규화 차이를 무시한다', () => {
  assert.equal(hashName('  홍길동 ', KEY), hashName('홍길동', KEY));
  assert.equal(hashName('홍길동'.normalize('NFD'), KEY), hashName('홍길동', KEY));
});

test('normalize는 빈 값을 거부한다', () => {
  assert.throws(() => normalize('   '), /빈 값/);
});

test('키가 없으면 해시 함수가 실패한다', () => {
  assert.throws(() => hashName('홍길동', ''), /키/);
});
