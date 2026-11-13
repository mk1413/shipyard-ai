// T050 [US4] FR-10 품질 탭 테스트 (기준 명세 §4 FR-10, AC-09)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { defectTrendChart, paretoChart, defectOverWarning, totalRework } = require('../../src/charts/quality');

// 일별 불량률: 10/13 = 3/200 = 1.5%, 10/14 = 4/200 = 2%, 10/15 = 9/200 = 4.5%(초과), 09/16 = 1/100 = 1%
const P = [
  { date: '2026-10-13', process: '소조립', defect_cnt: 2, inspected_cnt: 100, rework_hr: 1.5 },
  { date: '2026-10-13', process: '대조립', defect_cnt: 1, inspected_cnt: 100, rework_hr: 0 },
  { date: '2026-10-14', process: '소조립', defect_cnt: 4, inspected_cnt: 100, rework_hr: 2 },
  { date: '2026-10-14', process: '절단', defect_cnt: 0, inspected_cnt: 100, rework_hr: 0 },
  { date: '2026-10-15', process: '소조립', defect_cnt: 6, inspected_cnt: 100, rework_hr: 0 },
  { date: '2026-10-15', process: '중조립', defect_cnt: 3, inspected_cnt: 100, rework_hr: 0 },
  { date: '2026-09-16', process: '대조립', defect_cnt: 1, inspected_cnt: 100, rework_hr: 0.5 },
];

test('불량률 추이: x는 날짜 오름차순, y는 날짜별 불량률(%)이다', async () => {
  const { data } = defectTrendChart(P);
  assert.deepEqual(data[0].x, ['2026-09-16', '2026-10-13', '2026-10-14', '2026-10-15']);
  assert.deepEqual(data[0].y.map((v) => Math.round(v * 100) / 100), [1, 1.5, 2, 4.5]);
});

test('불량률 추이: 목표 상한 3% 점선이 있다', async () => {
  const { layout } = defectTrendChart(P);
  const target = layout.shapes.find((s) => s.y0 === 3);
  assert.ok(target);
  assert.equal(target.line.dash, 'dot');
});

test('AC-09: 상한 초과 일수, 최고 불량률과 날짜를 경고 문구로 만든다', async () => {
  const w = defectOverWarning(P);
  assert.equal(w.over_days, 1);
  assert.equal(w.message, '불량률 목표 상한 초과 1일 · 최고 4.50% (10/15)');
  assert.equal(w.level, 'crit');
});

test('초과가 없으면 경고가 없다', async () => {
  const ok = P.filter((r) => r.date !== '2026-10-15');
  assert.equal(defectOverWarning(ok), null);
});

test('파레토: 공정은 불량 건수 내림차순이다', async () => {
  const { data } = paretoChart(P);
  assert.deepEqual(data[0].x, ['소조립', '중조립', '대조립', '절단']);
  assert.deepEqual(data[0].y, [12, 3, 2, 0]);
});

test('파레토: 누적 비율 선은 오른쪽 축 0~105를 쓰고 마지막 값이 100이다', async () => {
  const { data, layout } = paretoChart(P);
  const cum = data[1];
  assert.equal(cum.yaxis, 'y2');
  assert.deepEqual(layout.yaxis2.range, [0, 105]);
  assert.ok(Math.abs(cum.y[0] - (12 / 17) * 100) < 1e-9);
  assert.equal(cum.y[cum.y.length - 1], 100);
});

test('총 재작업 시간은 rework_hr의 합이다', async () => {
  assert.equal(totalRework(P), 4);
});

test('데이터가 없으면 빈 차트와 경고 없음, 재작업 0', async () => {
  assert.deepEqual(defectTrendChart([]).data[0].x, []);
  assert.deepEqual(paretoChart([]).data[0].x, []);
  assert.equal(defectOverWarning([]), null);
  assert.equal(totalRework([]), 0);
});
