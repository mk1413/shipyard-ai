'use strict';

const { DatabaseSync } = require('node:sqlite');

/**
 * SQLite 연결을 연다. 외래키 제약을 켜고, 파일 DB는 WAL 모드를 쓴다.
 * @param {string} file DB 파일 경로, 또는 ':memory:'
 * @returns {DatabaseSync}
 */
function openDatabase(file) {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON;');
  if (file !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }
  return db;
}

module.exports = { openDatabase };
