const { test } = require('node:test');
const assert = require('node:assert/strict');
const { achieve, defectRate, oeeCalc, mhEfficiency, delayedBlockCount } = require('../../src/domain/kpi');

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

test('달성률은 합계끼리 나눈 가중 비율이다 (행별 평균 75가 아니라 87.5)', async () => {
  const p = [
    { planned_ton: 100, actual_ton: 50 },
    { planned_ton: 300, actual_ton: 300 },
  ];
  near(achieve(p), 87.5);
});

test('계획 물량 합이 0이면 달성률은 null (데이터 없음)', async () => {
  assert.equal(achieve([]), null);
  assert.equal(achieve([{ planned_ton: 0, actual_ton: 0 }]), null);
});

test('불량률은 불량 합 ÷ 검사 합', async () => {
  const p = [
    { defect_cnt: 3, inspected_cnt: 100 },
    { defect_cnt: 0, inspected_cnt: 300 },
  ];
  near(defectRate(p), 0.75);
});

test('불량률 분모가 0이면 null', async () => {
  assert.equal(defectRate([{ defect_cnt: 0, inspected_cnt: 0 }]), null);
});

test('OEE = 가동률 × 성능효율 × 양품률 (세부 값 포함)', async () => {
  const e = [{ planned_min: 600, downtime_min: 60, ideal_ct_min: 2, total_cnt: 100, good_cnt: 90 }];
  const r = oeeCalc(e);
  near(r.avail, 90);
  near(r.qual, 90);
  near(r.perf, (200 / 540) * 100);
  near(r.oee, 30);
});

test('OEE 분모가 0이면 전부 0', async () => {
  assert.deepEqual(oeeCalc([]), { avail: 0, perf: 0, qual: 0, oee: 0 });
});

test('맨아워 효율은 실적 MH가 있는 행만 쓴다', async () => {
  const b = [
    { planned_mh: 100, actual_mh: 105 },
    { planned_mh: 50, actual_mh: null },
  ];
  near(mhEfficiency(b), (100 / 105) * 100);
});

test('맨아워 효율은 실적 MH가 없으면 0이다', async () => {
  assert.equal(mhEfficiency([{ planned_mh: 50, actual_mh: null }]), 0);
});

test('지연 블록 수는 지연일 0보다 큰 블록 id의 고유 개수다', async () => {
  const b = [
    { block_id: 'A', delay_days: 2 },
    { block_id: 'A', delay_days: 1 },
    { block_id: 'B', delay_days: 0 },
  ];
  assert.equal(delayedBlockCount(b), 1);
});
