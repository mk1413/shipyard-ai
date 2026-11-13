'use strict';

const path = require('node:path');
const express = require('express');
const { dashboardRouter } = require('./routes/dashboard');
const { searchRouter } = require('./routes/search');
const { authRouter } = require('./routes/auth');
const { requireLogin } = require('./middleware/require-login');

/**
 * Express 앱을 만든다. DB 연결은 호출하는 쪽이 한다 (테스트에서는 임시 DB를 넘긴다).
 * 비밀키가 없으면 앱을 만들지 않는다 (SESSION_SECRET, USER_HASH_KEY 필수).
 * @param {{db: import('@libsql/client').Client, auth: {hashKey: string, sessionSecret: string, sessionHours: number}}} deps
 */
function createApp({ db, auth }) {
  if (!auth || !auth.hashKey) throw new Error('USER_HASH_KEY 환경 변수가 필요합니다');
  if (!auth.sessionSecret) throw new Error('SESSION_SECRET 환경 변수가 필요합니다');

  const app = express();
  app.disable('x-powered-by');
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));
  app.use(express.urlencoded({ extended: false }));

  // Plotly 등 정적 자원은 프로젝트 안에서만 제공한다 (원칙 5)
  app.use('/vendor', express.static(path.join(__dirname, '..', 'public', 'vendor')));

  // 로그인과 로그아웃은 로그인 없이 열린다
  app.use(authRouter({ db, auth }));

  // 그 아래(대시보드, 검색)는 로그인이 필요하다 (FR-12)
  app.use(requireLogin(auth.sessionSecret));
  app.use(dashboardRouter(db));
  app.use(searchRouter(db));
  return app;
}

module.exports = { createApp };
