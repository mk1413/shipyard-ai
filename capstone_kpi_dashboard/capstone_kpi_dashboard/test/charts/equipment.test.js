// T047 [US3] FR-9 설비별 OEE 차트 테스트 (기준 명세 §4 FR-9)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { oeeBarChart, equipmentWarnings } = require('../../src/charts/equipment');

// 세 설비의 OEE는 계산상 Z=60, Y=72, X=90이다 (가동률 × 성능효율 × 양품률)
const EQ = [
  { date: '2026-10-13', equipment_id: 'X-01', equipment_type: '골리앗 크레인', process: '대조립', planned_min: 600, downtime_min: 0, ideal_ct_min: 1, total_cnt: 540, good_cnt: 540 },
  { date: '2026-10-13', equipment_id: 'Y-01', equipment_type: '용접로봇', process: '소조립', planned_min: 600, downtime_min: 60, ideal_ct_min: 1, total_cnt: 432, good_cnt: 432 },
  { date: '2026-10-13', equipment_id: 'Z-01', equipment_type: '도장 부스', process: '도장', planned_min: 600, downtime_min: 120, ideal_ct_min: 1, total_cnt: 360, good_cnt: 360 },
];

test('설비 막대는 OEE 낮은 순으로 정렬된다', () => {
  const { data } = oeeBarChart(EQ);
  assert.deepEqual(data[0].y, ['Z-01', 'Y-01', 'X-01']);
});

test('설비 막대 값은 설비별 OEE(%)다', () => {
  const { data } = oeeBarChart(EQ);
  const byId = Object.fromEntries(data[0].y.map((id, i) => [id, data[0].x[i]]));
  assert.ok(Math.abs(byId['Z-01'] - 60) < 1e-6);
  assert.ok(Math.abs(byId['Y-01'] - 72) < 1e-6);
  assert.ok(Math.abs(byId['X-01'] - 90) < 1e-6);
});

test('색 범위는 50~85이다', () => {
  const { data } = oeeBarChart(EQ);
  assert.equal(data[0].marker.cmin, 50);
  assert.equal(data[0].marker.cmax, 85);
});

test('기준선은 OEE 목표 75%다', () => {
  const { layout } = oeeBarChart(EQ);
  const target = layout.shapes.find((s) => s.x0 === 75);
  assert.ok(target, '75% 기준선이 있어야 함');
});

test('호버 정보에 설비 종류가 들어간다', () => {
  const { data } = oeeBarChart(EQ);
  assert.ok(data[0].hovertext.some((h) => h.includes('도장 부스')));
});

test('경고는 목표 미달(75% 미만) 설비만 나오고, 정상 설비는 없다', () => {
  const w = equipmentWarnings(EQ);
  assert.deepEqual(w.map((x) => x.equipment_id), ['Z-01', 'Y-01']);
  assert.ok(w.every((x) => x.level === 'warn' || x.level === 'crit'));
});

test('경고 문구는 설비 번호와 OEE를 포함한다', () => {
  const w = equipmentWarnings(EQ);
  assert.equal(w[0].message, '설비 Z-01 (도장 부스) OEE 60.0% · 목표 75% 미달');
});

test('설비 데이터가 없으면 빈 차트를 돌려준다', () => {
  const { data } = oeeBarChart([]);
  assert.deepEqual(data[0].y, []);
  assert.deepEqual(equipmentWarnings([]), []);
});
