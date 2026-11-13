'use strict';

const express = require('express');
const { COOKIE_NAME, signToken } = require('../middleware/cookie');
const { verifyLogin } = require('../auth/verify-login');

const FAIL_MESSAGE = '사번 또는 이름이 일치하지 않습니다';

/**
 * 간이 로그인 라우트 (FR-12).
 * @param {{db: import('node:sqlite').DatabaseSync, auth: {hashKey: string, sessionSecret: string, sessionHours: number}}} deps
 */
function authRouter({ db, auth }) {
  const router = express.Router();
  const maxAgeMs = auth.sessionHours * 3600 * 1000;

  router.get('/login', (req, res) => {
    res.render('login', { error: null });
  });

  router.post('/login', (req, res) => {
    const employeeNo = req.body && req.body.employee_no;
    const name = req.body && req.body.name;
    const userId = verifyLogin(db, auth.hashKey, employeeNo, name);

    if (userId == null) {
      // 실패는 시각만 남긴다. 사번과 이름은 남기지 않는다 (원칙 3).
      console.warn(`[login] 실패 ${new Date().toISOString()}`);
      res.status(200).render('login', { error: FAIL_MESSAGE });
      return;
    }

    const token = signToken({ uid: userId, exp: Date.now() + maxAgeMs }, auth.sessionSecret);
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: maxAgeMs,
    });
    console.log(`[login] 성공 ${new Date().toISOString()}`);
    res.redirect('/');
  });

  router.post('/logout', (req, res) => {
    res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'lax', path: '/' });
    res.redirect('/login');
  });

  return router;
}

module.exports = { authRouter, FAIL_MESSAGE };
