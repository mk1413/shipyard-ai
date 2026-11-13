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
 * @param {{db: import('@libsql/client').Client, auth: {hashKey: string, sessionSecret: string, sessionHours: number}, rootRedirect?: boolean}} deps
 *   rootRedirect가 true이면 메인(/)을 대시보드 대신 /search로 보낸다 (배포 임시 설정).
 */
function createApp({ db, auth, rootRedirect = false }) {
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

  // 그 아래(대시보드, 검색)는 로그인이 필요하다 (FR-12).
  // DISABLE_LOGIN=true이면 로그인 확인을 건너뛴다. 가상 데이터 시연용이며, 기본값은 로그인 유지다.
  if (!auth.disableLogin) {
    app.use(requireLogin(auth.sessionSecret));
  }
  if (rootRedirect) {
    // 임시: 배포 환경에서 메인 대시보드(/)가 500이므로 검색 화면으로 보낸다.
    // 원인을 고치면 rootRedirect 설정을 끄면 대시보드가 다시 열린다.
    app.get('/', (req, res) => res.redirect('/search'));
  } else {
    app.use(dashboardRouter(db));
  }
  app.use(searchRouter(db));
  return app;
}

module.exports = { createApp };
