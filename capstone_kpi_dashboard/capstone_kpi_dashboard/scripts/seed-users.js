'use strict';

// 사용법: USER_HASH_KEY=<키> npm run seed:users [명단 CSV 경로]
// 기본 명단은 data/users.csv (사번, 이름). 출력에는 인원 수만 나온다 (원칙 3).
const path = require('node:path');
const { openDatabase } = require('../src/db/open');
const { migrateUp } = require('../src/db/migrate');
const { seedUsers } = require('../src/auth/seed-users');

const root = path.join(__dirname, '..');
const key = process.env.USER_HASH_KEY;
if (!key) {
  console.error('USER_HASH_KEY 환경 변수가 필요합니다.');
  process.exit(1);
}

const csvPath = process.argv[2] || path.join(root, 'data', 'users.csv');
const db = openDatabase(path.join(root, 'data', 'app.db'));
try {
  migrateUp(db, path.join(root, 'src', 'db', 'migrations'));
  const n = seedUsers(db, csvPath, key);
  console.log(`명단 ${n}명을 등록했습니다.`);
} catch (err) {
  console.error(`시드 실패: ${err.message}`);
  process.exitCode = 1;
} finally {
  db.close();
}
