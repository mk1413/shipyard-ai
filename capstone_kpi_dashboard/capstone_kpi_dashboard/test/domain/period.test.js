const { test } = require('node:test');
const assert = require('node:assert/strict');
const { previousPeriod, blocksInPeriod } = require('../../src/domain/period');

const TODAY = '2026-10-31';

test('직전 기간은 길이가 같고 바로 앞에 있다', async () => {
  assert.deepEqual(previousPeriod('2026-10-13', '2026-10-17'), { start: '2026-10-08', end: '2026-10-12' });
});

test('하루짜리 기간의 직전 기간은 전날 하루다', async () => {
  assert.deepEqual(previousPeriod('2026-10-13', '2026-10-13'), { start: '2026-10-12', end: '2026-10-12' });
});

// AC-18: 실적 기간이 선택 기간과 겹치는 블록만 맨아워 계산에 들어간다 (Python 테스트 4개 케이스)
const rows = [
  { id: 'in', actual_start: '2026-10-14', actual_end: '2026-10-15' },
  { id: 'overlap', actual_start: '2026-10-01', actual_end: '2026-10-14' },
  { id: 'after', actual_start: '2026-10-20', actual_end: '2026-10-25' },
  { id: 'waiting', actual_start: null, actual_end: null },
];

test('AC-18-1: 기간 안에서 끝난 블록은 포함된다', async () => {
  assert.ok(blocksInPeriod(rows, '2026-10-13', '2026-10-17', TODAY).some((r) => r.id === 'in'));
});

test('AC-18-2: 기간 시작 전에 시작해 기간에 걸친 블록은 포함된다', async () => {
  assert.ok(blocksInPeriod(rows, '2026-10-13', '2026-10-17', TODAY).some((r) => r.id === 'overlap'));
});

test('AC-18-3: 기간 뒤에 시작한 블록은 제외된다', async () => {
  assert.equal(blocksInPeriod(rows, '2026-10-13', '2026-10-17', TODAY).some((r) => r.id === 'after'), false);
});

test('AC-18-4: 대기 블록은 제외된다', async () => {
  assert.equal(blocksInPeriod(rows, '2026-10-13', '2026-10-17', TODAY).some((r) => r.id === 'waiting'), false);
});

test('진행 중 블록은 기준일까지를 실적 기간으로 본다', async () => {
  const ongoing = [{ id: 'ongoing', actual_start: '2026-10-01', actual_end: null }];
  assert.equal(blocksInPeriod(ongoing, '2026-10-20', '2026-10-25', TODAY).length, 1);
  assert.equal(blocksInPeriod(ongoing, '2026-11-02', '2026-11-05', TODAY).length, 0);
});
