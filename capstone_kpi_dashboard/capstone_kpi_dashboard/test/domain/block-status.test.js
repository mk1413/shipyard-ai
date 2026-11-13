const { test } = require('node:test');
const assert = require('node:assert/strict');
const { blockStatus } = require('../../src/domain/block-status');

const TODAY = '2026-10-31';

test('시작 전이면 대기이고 지연일은 0이다', () => {
  const r = blockStatus({ planned_end: '2026-09-01', actual_start: null, actual_end: null }, TODAY);
  assert.deepEqual(r, { status: '대기', delay_days: 0 });
});

test('진행 중이고 계획 종료일이 지났으면 진행(지연), 지연일은 기준일 기준이다', () => {
  const r = blockStatus({ planned_end: '2026-10-21', actual_start: '2026-10-01', actual_end: null }, TODAY);
  assert.equal(r.status, '진행(지연)');
  assert.equal(r.delay_days, 10);
});

test('진행 중이고 계획 종료일 전이면 진행, 지연일은 0이다', () => {
  const r = blockStatus({ planned_end: '2026-11-30', actual_start: '2026-10-01', actual_end: null }, TODAY);
  assert.deepEqual(r, { status: '진행', delay_days: 0 });
});

test('완료했고 계획보다 늦었으면 완료(지연), 지연일은 실적 종료 기준이다', () => {
  const r = blockStatus({ planned_end: '2026-09-10', actual_start: '2026-09-01', actual_end: '2026-09-15' }, TODAY);
  assert.equal(r.status, '완료(지연)');
  assert.equal(r.delay_days, 5);
});

test('계획보다 일찍 끝났으면 완료, 지연일은 음수가 아니라 0이다', () => {
  const r = blockStatus({ planned_end: '2026-09-20', actual_start: '2026-09-01', actual_end: '2026-09-15' }, TODAY);
  assert.deepEqual(r, { status: '완료', delay_days: 0 });
});
