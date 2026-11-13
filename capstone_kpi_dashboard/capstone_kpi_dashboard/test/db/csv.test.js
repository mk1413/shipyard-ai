const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseCsv } = require('../../src/db/csv');

test('BOM을 제거하고 첫 줄을 열 이름으로 쓴다', () => {
  const rows = parseCsv('﻿a,b\n1,2\n');
  assert.deepEqual(rows, [{ a: '1', b: '2' }]);
});

test('CRLF 줄바꿈을 처리한다', () => {
  const rows = parseCsv('a,b\r\n1,2\r\n3,4\r\n');
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[1], { a: '3', b: '4' });
});

test('큰따옴표 안의 쉼표와 이중 따옴표를 처리한다', () => {
  const rows = parseCsv('name,memo\n"홍, 길동","그는 ""괜찮다"""\n');
  assert.deepEqual(rows[0], { name: '홍, 길동', memo: '그는 "괜찮다"' });
});

test('빈 셀은 빈 문자열로 읽는다', () => {
  const rows = parseCsv('a,b,c\n1,,3\n');
  assert.deepEqual(rows[0], { a: '1', b: '', c: '3' });
});

test('마지막 줄 끝의 빈 줄은 무시한다', () => {
  const rows = parseCsv('a\n1\n2\n\n');
  assert.equal(rows.length, 2);
});

test('헤더만 있으면 빈 배열을 반환한다', () => {
  assert.deepEqual(parseCsv('a,b\n'), []);
});
