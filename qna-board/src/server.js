'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { openDatabase } = require('./db/open');
const { migrateUp } = require('./db/migrate');
const { createApp } = require('./app');

const ROOT = path.join(__dirname, '..');
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'data', 'qna.db');
const PORT = Number(process.env.PORT) || 3000;

function buildApp() {
  if (DB_PATH !== ':memory:') {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  }
  const db = openDatabase(DB_PATH);
  migrateUp(db, path.join(ROOT, 'migrations'));

  const app = createApp({
    db,
    auth: {
      hashKey: process.env.USER_HASH_KEY,
      sessionSecret: process.env.SESSION_SECRET,
      sessionHours: Number(process.env.SESSION_HOURS) || 8,
    },
  });
  return app;
}

// Vercel 등 서버리스 환경은 app을 export하여 호출하고, 로컬에서는 직접 리슨한다.
const app = buildApp();

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`qna-board listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
