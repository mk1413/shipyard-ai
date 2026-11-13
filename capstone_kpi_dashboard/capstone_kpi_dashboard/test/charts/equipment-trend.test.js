// T047 보강 [US3] FR-9 요약 카드 4개와 설비별 일 정지시간 추이
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { equipmentSummary, downtimeTrendChart } = require('../../src/charts/equipment');
const { oeeCalc } = require('../../src/domain/kpi');

const EQ = [
  { date: '2026-10-13', equipment_id: 'Y-01', equipment_type: '용접로봇', planned_min: 600, downtime_min: 60, ideal_ct_min: 1, total_cnt: 432, good_cnt: 432 },
  { date: '2026-10-13', equipment_id: 'X-01', equipment_type: '골리앗 크레인', planned_min: 600, downtime_min: 0, ideal_ct_min: 1, total_cnt: 540, good_cnt: 540 },
  { date: '2026-10-14', equipment_id: 'Y-01', equipment_type: '용접로봇', planned_min: 600, downtime_min: 5, ideal_ct_min: 1, total_cnt: 432, good_cnt: 432 },
  { date: '2026-10-13', equipment_id: 'Y-01', equipment_type: '용접로봇', planned_min: 0, downtime_min: 10, ideal_ct_min: 1, total_cnt: 0, good_cnt: 0 },
];

test('요약 카드는 가동률, 성능효율, 양품률, OEE를 설비 전체 기준으로 낸다', () => {
  assert.deepEqual(equipmentSummary(EQ), oeeCalc(EQ));
  const s = equipmentSummary(EQ);
  for (const k of ['avail', 'perf', 'qual', 'oee']) {
    assert.equal(typeof s[k], 'number', `${k}는 숫자`);
  }
});

test('정지시간 추이: 설비마다 한 선이고, 이름은 설비 번호다', () => {
  const { data } = downtimeTrendChart(EQ);
  assert.deepEqual(data.map((t) => t.name), ['X-01', 'Y-01']);
});

test('정지시간 추이: x는 날짜 오름차순, y는 날짜별 정지 분 합계다 (없는 날은 0)', () => {
  const { data } = downtimeTrendChart(EQ);
  const y01 = data.find((t) => t.name === 'Y-01');
  assert.deepEqual(y01.x, ['2026-10-13', '2026-10-14']);
  assert.deepEqual(y01.y, [70, 5]); // 10/13: 60 + 10, 10/14: 5
  const x01 = data.find((t) => t.name === 'X-01');
  assert.deepEqual(x01.y, [0, 0]);
});

test('정지시간 추이 차트 데이터가 없으면 빈 선 목록', () => {
  assert.deepEqual(downtimeTrendChart([]).data, []);
});
