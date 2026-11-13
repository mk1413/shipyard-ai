// T005 간이 로그인 미들웨어 (API용): 로그인이 없으면 401 JSON, 있으면 req.user를 채운다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { requireApiLogin } = require('../../src/middleware/require-api-login');
const { signToken, COOKIE_NAME } = require('../../src/middleware/cookie');

const SECRET = 'mw-test-secret';

function fakeRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(c) {
      this.statusCode = c;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
  };
}

test('쿠키가 없으면 401 unauthorized를 보내고 다음으로 넘기지 않는다', () => {
  const res = fakeRes();
  let called = false;
  requireApiLogin(SECRET)({ headers: {} }, res, () => {
    called = true;
  });
  assert.equal(called, false);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: 'unauthorized' });
});

test('위조된 쿠키면 401이다', () => {
  const res = fakeRes();
  requireApiLogin(SECRET)({ headers: { cookie: `${COOKIE_NAME}=forged.sig` } }, res, () => {});
  assert.equal(res.statusCode, 401);
});

test('유효한 쿠키면 req.user.id를 채우고 다음으로 넘긴다', () => {
  const token = signToken({ uid: 5, exp: Date.now() + 60000 }, SECRET);
  const req = { headers: { cookie: `${COOKIE_NAME}=${token}` } };
  let called = false;
  requireApiLogin(SECRET)(req, fakeRes(), () => {
    called = true;
  });
  assert.equal(called, true);
  assert.deepEqual(req.user, { id: 5 });
});
