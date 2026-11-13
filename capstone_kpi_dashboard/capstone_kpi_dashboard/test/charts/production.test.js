// T026 [US1] FR-7 탭 1 차트 테스트 (기준 명세 §4 FR-7)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { dailyChart, processAchieveChart } = require('../../src/charts/production');

const ROWS = [
  { date: '2026-10-13', process: '절단', planned_ton: 100, actual_ton: 90 },
  { date: '2026-10-13', process: '대조립', planned_ton: 100, actual_ton: 60 },
  { date: '2026-10-14', process: '절단', planned_ton: 200, actual_ton: 200 },
  { date: '2026-10-14', process: '대조립', planned_ton: 100, actual_ton: 100 },
];

test('일별 차트: 계획과 실적 막대 두 개와 달성률 선 하나를 가진다', async () => {
  const { data } = dailyChart(ROWS);
  assert.equal(data.length, 3);
  assert.equal(data[0].type, 'bar');
  assert.equal(data[0].name, '계획(ton)');
  assert.equal(data[1].type, 'bar');
  assert.equal(data[1].name, '실적(ton)');
  assert.equal(data[2].type, 'scatter');
  assert.equal(data[2].yaxis, 'y2');
});

test('일별 차트: x축은 날짜 오름차순이고 중복이 없다', async () => {
  const { data } = dailyChart(ROWS);
  assert.deepEqual(data[0].x, ['2026-10-13', '2026-10-14']);
});

test('일별 차트: 계획과 실적은 날짜별 합계다', async () => {
  const { data } = dailyChart(ROWS);
  assert.deepEqual(data[0].y, [200, 300]);
  assert.deepEqual(data[1].y, [150, 300]);
});

test('일별 차트: 달성률은 합계끼리 나눈 값이다 (10/13 = 150 ÷ 200 = 75%)', async () => {
  const { data } = dailyChart(ROWS);
  assert.deepEqual(data[2].y, [75, 100]);
});

test('일별 차트: 오른쪽 축 범위는 40~110이고 목표 95% 점선이 있다', async () => {
  const { layout } = dailyChart(ROWS);
  assert.deepEqual(layout.yaxis2.range, [40, 110]);
  const target = layout.shapes.find((s) => s.yref === 'y2');
  assert.ok(target, '목표선이 있어야 함');
  assert.equal(target.y0, 95);
  assert.equal(target.y1, 95);
  assert.equal(target.line.dash, 'dot');
});

test('공정별 달성률 차트: 공정 순서는 입력한 순서(절단 → 탑재)를 따른다', async () => {
  const order = ['절단', '소조립', '중조립', '대조립', '도장', '탑재'];
  const { data } = processAchieveChart(ROWS, order);
  assert.deepEqual(data[0].x, ['절단', '대조립']);
});

test('공정별 달성률 차트: 색 범위는 80~100이다', async () => {
  const { data } = processAchieveChart(ROWS, ['절단', '대조립']);
  assert.equal(data[0].marker.cmin, 80);
  assert.equal(data[0].marker.cmax, 100);
});

test('공정별 달성률 차트: 값은 공정별 달성률이다 (절단 290÷300, 대조립 160÷200)', async () => {
  const { data } = processAchieveChart(ROWS, ['절단', '대조립']);
  assert.deepEqual(data[0].y, [(290 / 300) * 100, (160 / 200) * 100]);
});

test('공정별 달성률 차트: 목표 95% 기준선이 있다', async () => {
  const { layout } = processAchieveChart(ROWS, ['절단', '대조립']);
  const target = layout.shapes.find((s) => s.y0 === 95);
  assert.ok(target);
});
