'use strict';

const path = require('node:path');
const { createClient } = require('@libsql/client');

/**
 * 연결 대상을 libsql URL로 바꾼다.
 * - ':memory:' 또는 'file:...' : 로컬 SQLite 파일
 * - 'libsql://...' 등 : Turso 원격 DB
 * - 그 밖의 문자열 : 로컬 파일 경로
 */
function toUrl(target) {
  if (target === ':memory:' || /^(file|libsql|https?|wss?):/.test(target)) return target;
  return 'file:' + path.resolve(target).replace(/\\/g, '/');
}

/**
 * libsql 클라이언트를 연다. 외래키 제약을 켜고, 로컬 파일 DB는 WAL 모드를 쓴다.
 * @param {string | {url: string, authToken?: string}} config 로컬 경로, ':memory:', 또는 Turso 설정 객체
 * @returns {Promise<import('@libsql/client').Client>}
 */
async function openDatabase(config) {
  const cfg = typeof config === 'string' ? { url: toUrl(config) } : config;
  const client = createClient({ url: cfg.url, authToken: cfg.authToken });
  const isLocal = cfg.url === ':memory:' || cfg.url.startsWith('file:');

  await client.execute('PRAGMA foreign_keys = ON;');
  if (isLocal && cfg.url !== ':memory:') {
    await client.execute('PRAGMA journal_mode = WAL;');
  }
  return client;
}

/**
 * 환경 변수에서 연결 설정을 읽는다.
 * TURSO_DATABASE_URL이 있으면 Turso 원격 DB, 없으면 DB_PATH 로컬 파일을 쓴다.
 */
function configFromEnv(fallbackPath) {
  if (process.env.TURSO_DATABASE_URL) {
    return { url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN };
  }
  return process.env.DB_PATH || fallbackPath;
}

module.exports = { openDatabase, configFromEnv, toUrl };
