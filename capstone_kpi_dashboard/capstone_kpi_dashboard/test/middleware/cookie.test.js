const { test } = require('node:test');
const assert = require('node:assert/strict');
const { signToken, verifyToken } = require('../../src/middleware/cookie');

const SECRET = 'test-session-secret';
const NOW = Date.parse('2026-11-13T09:00:00Z');

test('서명한 토큰은 같은 비밀키로 검증되고 내용을 돌려준다', () => {
  const token = signToken({ uid: 1, exp: NOW + 1000 }, SECRET);
  assert.deepEqual(verifyToken(token, SECRET, NOW), { uid: 1, exp: NOW + 1000 });
});

test('AC-20: 내용을 바꾸면 검증에 실패한다', () => {
  const token = signToken({ uid: 1, exp: NOW + 1000 }, SECRET);
  const [payload, sig] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ uid: 2, exp: NOW + 1000 })).toString('base64url');
  assert.equal(verifyToken(`${forged}.${sig}`, SECRET, NOW), null);
  assert.equal(payload === forged, false);
});

test('AC-20: 서명을 바꾸면 검증에 실패한다', () => {
  const token = signToken({ uid: 1, exp: NOW + 1000 }, SECRET);
  const [payload] = token.split('.');
  assert.equal(verifyToken(`${payload}.AAAA`, SECRET, NOW), null);
});

test('AC-20: 다른 비밀키로 만든 토큰은 거부된다', () => {
  const token = signToken({ uid: 1, exp: NOW + 1000 }, 'other-secret');
  assert.equal(verifyToken(token, SECRET, NOW), null);
});

test('AC-20: 만료된 토큰은 거부된다', () => {
  const token = signToken({ uid: 1, exp: NOW - 1 }, SECRET);
  assert.equal(verifyToken(token, SECRET, NOW), null);
});

test('형식이 잘못된 값은 거부하고 예외를 던지지 않는다', () => {
  assert.equal(verifyToken('', SECRET, NOW), null);
  assert.equal(verifyToken('no-dot-here', SECRET, NOW), null);
  assert.equal(verifyToken(undefined, SECRET, NOW), null);
});

test('비밀키가 없으면 서명할 수 없다 (SESSION_SECRET 필수)', () => {
  assert.throws(() => signToken({ uid: 1, exp: NOW }, ''), /비밀키/);
});
