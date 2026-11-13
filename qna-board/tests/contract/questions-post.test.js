// T006 [US1] POST /questions 계약 테스트
//
// 계약 (이 테스트가 고정하는 HTTP 동작)
//   요청: POST /questions, Content-Type: application/json, 로그인 쿠키 필요
//         본문 { "title": string(1~200자, 공백만 불가), "body": string(1자 이상) }
//   201: 본문 { id: number, title, body, created_at: ISO 문자열 }, Location: /questions/:id
//   400: 본문 { error: "validation_error", fields: [실패한 필드 이름...] }
//   400: 본문이 JSON이 아니면 { error: "invalid_json" }
//   401: 로그인 쿠키가 없거나 잘못되면 { error: "unauthorized" }
//
// 이 테스트가 기대하는 모듈 (T003~T005에서 만든다)
//   src/app.js                createApp({ db, auth })
//   src/db/open.js            openDatabase(file)
//   src/db/migrate.js         migrateUp(db, dir)
//   src/auth/seed-users.js    seedUsers(db, csvPath, hashKey)
//
// 로그인은 POST /login (사번, 이름) 으로 한다. 성공하면 Set-Cookie로 세션을 받는다.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const { createApp } = require('../../src/app');
const { openDatabase } = require('../../src/db/open');
const { migrateUp } = require('../../src/db/migrate');
const { seedUsers } = require('../../src/auth/seed-users');

const ROOT = path.join(__dirname, '..', '..');
const AUTH = { hashKey: 'contract-hash-key', sessionSecret: 'contract-session-secret', sessionHours: 8 };
const USER = { employee_no: '9000001', name: '테스트사용자1' };

let server;
let base;
let dir;
let db;
let cookie;

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qna-contract-'));
  db = openDatabase(path.join(dir, 'app.db'));
  migrateUp(db, path.join(ROOT, 'migrations'));
  const csv = path.join(dir, 'users.csv');
  fs.writeFileSync(csv, `사번,이름\n${USER.employee_no},${USER.name}\n`, 'utf8');
  seedUsers(db, csv, AUTH.hashKey);

  const app = createApp({ db, auth: AUTH });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;

  const login = await fetch(`${base}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(USER),
    redirect: 'manual',
  });
  cookie = login.headers.get('set-cookie').split(';')[0];
});

after(() => {
  server.close();
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

function post(body, { withCookie = true, raw, contentType = 'application/json' } = {}) {
  const headers = { 'content-type': contentType };
  if (withCookie) headers.cookie = cookie;
  return fetch(`${base}/questions`, {
    method: 'POST',
    headers,
    body: raw !== undefined ? raw : JSON.stringify(body),
  });
}

test('로그인한 사용자가 올바른 질문을 보내면 201과 생성된 질문을 받는다', async () => {
  const res = await post({ title: '배관 서포트 위치가 도면과 간섭됩니다', body: '2블록 3층 구간입니다.' });
  assert.equal(res.status, 201);
  assert.match(res.headers.get('content-type'), /application\/json/);
  const json = await res.json();
  assert.equal(typeof json.id, 'number');
  assert.equal(json.title, '배관 서포트 위치가 도면과 간섭됩니다');
  assert.equal(json.body, '2블록 3층 구간입니다.');
  assert.ok(!Number.isNaN(Date.parse(json.created_at)), 'created_at은 ISO 날짜 문자열');
});

test('201 응답의 Location 헤더는 생성된 질문의 주소다', async () => {
  const res = await post({ title: '제목', body: '내용' });
  const json = await res.json();
  assert.equal(res.headers.get('location'), `/questions/${json.id}`);
});

test('title이 없으면 400 validation_error이고 fields에 title이 들어 있다', async () => {
  const res = await post({ body: '내용만 있음' });
  assert.equal(res.status, 400);
  const json = await res.json();
  assert.equal(json.error, 'validation_error');
  assert.ok(json.fields.includes('title'));
});

test('title이 공백만 있으면 400이다', async () => {
  const res = await post({ title: '   ', body: '내용' });
  assert.equal(res.status, 400);
  assert.ok((await res.json()).fields.includes('title'));
});

test('title이 201자이면 400이다 (상한 200자)', async () => {
  const res = await post({ title: '가'.repeat(201), body: '내용' });
  assert.equal(res.status, 400);
  assert.ok((await res.json()).fields.includes('title'));
});

test('body가 빈 문자열이면 400이고 fields에 body가 들어 있다', async () => {
  const res = await post({ title: '제목', body: '' });
  assert.equal(res.status, 400);
  assert.ok((await res.json()).fields.includes('body'));
});

test('title과 body가 둘 다 틀리면 fields에 두 개가 모두 들어 있다', async () => {
  const res = await post({ title: '', body: '' });
  const json = await res.json();
  assert.ok(json.fields.includes('title'));
  assert.ok(json.fields.includes('body'));
});

test('JSON이 아닌 본문이면 400 invalid_json이다', async () => {
  const res = await post(null, { raw: '{title: 깨진 JSON', contentType: 'application/json' });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'invalid_json');
});

test('로그인 쿠키가 없으면 401 unauthorized이고 질문은 저장되지 않는다', async () => {
  const countBefore = db.prepare('SELECT COUNT(*) AS n FROM questions').get().n;
  const res = await post({ title: '제목', body: '내용' }, { withCookie: false });
  assert.equal(res.status, 401);
  assert.equal((await res.json()).error, 'unauthorized');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM questions').get().n, countBefore);
});

test('잘못된 쿠키로도 401이다', async () => {
  const res = await fetch(`${base}/questions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: 'qna_session=forged.value' },
    body: JSON.stringify({ title: '제목', body: '내용' }),
  });
  assert.equal(res.status, 401);
});

test('오류 응답에는 사번과 이름이 들어 있지 않다 (원칙 3)', async () => {
  const res = await post({ title: '', body: '' });
  const text = await res.text();
  assert.equal(text.includes(USER.employee_no), false);
  assert.equal(text.includes(USER.name), false);
});
