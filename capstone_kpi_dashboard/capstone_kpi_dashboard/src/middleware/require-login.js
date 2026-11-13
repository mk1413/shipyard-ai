'use strict';

const { COOKIE_NAME, verifyToken, readCookie } = require('./cookie');

/**
 * 로그인하지 않았으면 /login으로 보낸다 (FR-12).
 * 통과하면 req.user = { id } 를 설정한다.
 */
function requireLogin(secret) {
  return function requireLoginMiddleware(req, res, next) {
    const token = readCookie(req.headers.cookie, COOKIE_NAME);
    const payload = verifyToken(token, secret);
    if (!payload) {
      res.redirect('/login');
      return;
    }
    req.user = { id: payload.uid };
    next();
  };
}

module.exports = { requireLogin };
