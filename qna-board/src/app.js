'use strict';

const path = require('node:path');
const express = require('express');
const { authRouter } = require('./routes/auth');
const { questionsRouter } = require('./routes/questions');

/**
 * Express 앱. DB 연결은 호출하는 쪽이 한다.
 * @param {{db: import('node:sqlite').DatabaseSync, auth: {hashKey: string, sessionSecret: string, sessionHours: number}}} deps
 */
function createApp({ db, auth }) {
  if (!auth || !auth.hashKey) throw new Error('USER_HASH_KEY 환경 변수가 필요합니다');
  if (!auth.sessionSecret) throw new Error('SESSION_SECRET 환경 변수가 필요합니다');

  const app = express();
  app.disable('x-powered-by');
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));
  app.use(express.urlencoded({ extended: false }));

  app.use(authRouter({ db, auth }));
  app.use(questionsRouter({ db, sessionSecret: auth.sessionSecret }));

  // JSON 본문이 깨졌으면 400 invalid_json으로 돌려준다
  app.use((err, req, res, next) => {
    if (err && err.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'invalid_json' });
      return;
    }
    next(err);
  });

  return app;
}

module.exports = { createApp };
