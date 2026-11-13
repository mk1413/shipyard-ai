// T007 [US1] Question 모델 단위 테스트
// 모델은 DB와 HTTP에 의존하지 않는 순수 함수다. 저장은 T008에서 한다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateQuestion, toQuestionResponse, questionLocation, TITLE_MAX } = require('../../src/models/question');

test('제목 상한은 200자다', () => {
  assert.equal(TITLE_MAX, 200);
});

test('올바른 입력은 앞뒤 공백을 자른 값으로 통과한다', () => {
  const r = validateQuestion({ title: '  배관 서포트 간섭  ', body: '  2블록 3층  ' });
  assert.deepEqual(r, { ok: true, value: { title: '배관 서포트 간섭', body: '2블록 3층' } });
});

test('title이 없으면 실패하고 fields에 title이 들어간다', () => {
  const r = validateQuestion({ body: '내용' });
  assert.equal(r.ok, false);
  assert.deepEqual(r.fields, ['title']);
});

test('title이 공백만 있으면 실패한다', () => {
  assert.deepEqual(validateQuestion({ title: '   ', body: '내용' }).fields, ['title']);
});

test('title이 문자열이 아니면 실패한다', () => {
  assert.deepEqual(validateQuestion({ title: 123, body: '내용' }).fields, ['title']);
});

test('title 200자는 통과하고 201자는 실패한다', () => {
  assert.equal(validateQuestion({ title: '가'.repeat(200), body: '내용' }).ok, true);
  assert.deepEqual(validateQuestion({ title: '가'.repeat(201), body: '내용' }).fields, ['title']);
});

test('body가 빈 문자열이거나 공백만 있으면 실패한다', () => {
  assert.deepEqual(validateQuestion({ title: '제목', body: '' }).fields, ['body']);
  assert.deepEqual(validateQuestion({ title: '제목', body: '  \n ' }).fields, ['body']);
});

test('둘 다 틀리면 fields에 title, body 순서로 둘 다 들어간다', () => {
  assert.deepEqual(validateQuestion({ title: '', body: '' }).fields, ['title', 'body']);
});

test('입력이 없으면(null, undefined) 둘 다 실패한다', () => {
  assert.deepEqual(validateQuestion(null).fields, ['title', 'body']);
  assert.deepEqual(validateQuestion(undefined).fields, ['title', 'body']);
});

test('응답에는 id, title, body, created_at만 나간다 (다른 열은 빼고, 원칙 3)', () => {
  const row = {
    id: 7,
    title: '제목',
    body: '내용',
    created_at: '2026-11-13T09:00:00.000Z',
    author_employee_no: '9000001',
    author_name: '테스트사용자1',
  };
  assert.deepEqual(toQuestionResponse(row), {
    id: 7,
    title: '제목',
    body: '내용',
    created_at: '2026-11-13T09:00:00.000Z',
  });
});

test('질문 위치는 /questions/:id 형식이다', () => {
  assert.equal(questionLocation(42), '/questions/42');
});
