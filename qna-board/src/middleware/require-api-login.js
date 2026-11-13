'use strict';

const { COOKIE_NAME, verifyToken, readCookie } = require('./cookie');

/**
 * API용 로그인 확인 (T005). 로그인이 없으면 리다이렉트 대신 401 JSON을 보낸다.
 * 통과하면 req.user = { id } 를 채운다.
 */
function requireApiLogin(secret) {
  return function requireApiLoginMiddleware(req, res, next) {
    const token = readCookie(req.headers.cookie, COOKIE_NAME);
    const payload = verifyToken(token, secret);
    if (!payload) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    req.user = { id: payload.uid };
    next();
  };
}

module.exports = { requireApiLogin };
