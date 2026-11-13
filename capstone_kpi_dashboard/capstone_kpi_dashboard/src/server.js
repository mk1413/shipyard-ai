'use strict';

// 실행: npm run dev  (기본 주소 http://127.0.0.1:3000)
// 환경 변수
//   SESSION_SECRET  세션 쿠키 서명 키 (필수)
//   USER_HASH_KEY   사번과 이름 해시 키 (필수, seed:users와 같은 값을 써야 한다)
//   SESSION_HOURS   로그인 유지 시간 (기본 8)
//   PORT, HOST      기본 3000, 127.0.0.1
//   DB_PATH         기본 data/app.db
const path = require('node:path');
const { openDatabase } = require('./db/open');
const { migrateUp, currentVersion } = require('./db/migrate');
const { importAll } = require('./db/import-csv');
const { createApp } = require('./app');

const ROOT = path.join(__dirname, '..');
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'data', 'app.db');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';

const auth = {
  hashKey: process.env.USER_HASH_KEY,
  sessionSecret: process.env.SESSION_SECRET,
  sessionHours: Number(process.env.SESSION_HOURS || 8),
};
if (!auth.sessionSecret || !auth.hashKey) {
  console.error('SESSION_SECRET과 USER_HASH_KEY 환경 변수를 설정해야 실행됩니다.');
  process.exit(1);
}

const db = openDatabase(DB_PATH);
migrateUp(db, path.join(__dirname, 'db', 'migrations'));

// 생산 데이터가 비어 있으면 CSV에서 한 번 적재한다
const hasData = db.prepare('SELECT COUNT(*) AS n FROM daily_production').get().n > 0;
if (!hasData) {
  importAll(db, path.join(ROOT, 'data'));
  console.log('CSV 데이터를 적재했습니다.');
}

const app = createApp({ db, auth });
app.listen(PORT, HOST, () => {
  console.log(`대시보드 실행 중: http://${HOST}:${PORT} (스키마 버전 ${currentVersion(db)})`);
});
