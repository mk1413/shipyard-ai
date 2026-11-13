'use strict';

// 실행: npm run dev  (기본 주소 http://127.0.0.1:3000)
// 환경 변수
//   SESSION_SECRET     세션 쿠키 서명 키 (필수)
//   USER_HASH_KEY      사번과 이름 해시 키 (필수, seed:users와 같은 값을 써야 한다)
//   SESSION_HOURS      로그인 유지 시간 (기본 8)
//   TURSO_DATABASE_URL Turso DB 주소 (libsql://...). 있으면 원격 DB를 쓴다
//   TURSO_AUTH_TOKEN   Turso 인증 토큰 (TURSO_DATABASE_URL과 함께 쓴다)
//   DB_PATH            로컬 SQLite 파일 (기본 data/app.db). TURSO_DATABASE_URL이 없을 때만 쓴다
//   PORT, HOST         기본 3000, 127.0.0.1
//
// Vercel 등 서버리스 환경에서는 이 파일이 export하는 app을 호출한다.
// 앱 초기화(DB 연결, 마이그레이션, CSV 적재)는 첫 요청 전에 한 번만 끝낸다.
const path = require('node:path');
const express = require('express');
const { openDatabase, configFromEnv } = require('./db/open');
const { migrateUp, currentVersion } = require('./db/migrate');
const { importAll } = require('./db/import-csv');
const { get } = require('./db/query');
const { createApp } = require('./app');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const MIGRATIONS = path.join(__dirname, 'db', 'migrations');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';

async function init() {
  const auth = {
    hashKey: process.env.USER_HASH_KEY,
    sessionSecret: process.env.SESSION_SECRET,
    sessionHours: Number(process.env.SESSION_HOURS || 8),
    disableLogin: process.env.DISABLE_LOGIN === 'true',
  };
  const db = await openDatabase(configFromEnv(path.join(DATA_DIR, 'app.db')));
  await migrateUp(db, MIGRATIONS);

  // 생산 데이터가 비어 있으면 CSV에서 한 번 적재한다
  const { n } = await get(db, 'SELECT COUNT(*) AS n FROM daily_production');
  if (Number(n) === 0) {
    await importAll(db, DATA_DIR);
    console.log('CSV 데이터를 적재했습니다.');
  }
  console.log(`DB 준비 완료 (스키마 버전 ${await currentVersion(db)})`);
  return createApp({ db, auth });
}

// 초기화는 모듈을 읽을 때 한 번 시작하고, 끝날 때까지 들어온 요청을 기다리게 한다.
const ready = init();
ready.catch((err) => console.error('초기화 실패:', err.message));

const gate = express();
gate.use(async (req, res, next) => {
  try {
    const app = await ready;
    app(req, res, next);
  } catch (err) {
    next(err);
  }
});

if (require.main === module) {
  if (!process.env.SESSION_SECRET || !process.env.USER_HASH_KEY) {
    console.error('SESSION_SECRET과 USER_HASH_KEY 환경 변수를 설정해야 실행됩니다.');
    process.exit(1);
  }
  gate.listen(PORT, HOST, () => {
    console.log(`대시보드 실행 중: http://${HOST}:${PORT}`);
  });
}

module.exports = gate;
