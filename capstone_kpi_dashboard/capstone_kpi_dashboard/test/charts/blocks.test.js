// 수용 기준 AC-11: 간트차트에서 실적 종료일이 없는 막대는 기준일(2026-10-31)까지 그려진다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ganttBars, ganttChart, statusDonutChart, progressBarChart } = require('../../src/charts/blocks');

const TODAY = '2026-10-31';

test('AC-11: 진행 중인 블록의 실적 막대는 기준일까지 그려진다', () => {
  const row = {
    planned_start: '2026-10-01',
    planned_end: '2026-10-20',
    actual_start: '2026-10-02',
    actual_end: null,
  };
  const bars = ganttBars(row, TODAY);
  const actual = bars.find((b) => b.kind === '실적');
  assert.equal(actual.end, TODAY);
});

test('계획 막대는 계획 시작일과 종료일을 그대로 쓴다', () => {
  const row = { planned_start: '2026-10-01', planned_end: '2026-10-20', actual_start: null, actual_end: null };
  const bars = ganttBars(row, TODAY);
  assert.deepEqual(bars, [{ kind: '계획', start: '2026-10-01', end: '2026-10-20' }]);
});

test('완료한 블록의 실적 막대는 실적 종료일에서 끝난다', () => {
  const row = {
    planned_start: '2026-09-01',
    planned_end: '2026-09-10',
    actual_start: '2026-09-02',
    actual_end: '2026-09-12',
  };
  const actual = ganttBars(row, TODAY).find((b) => b.kind === '실적');
  assert.equal(actual.end, '2026-09-12');
});

// P1: 간트 차트 설정 (FR-8 3번, AC-11, T035, T036)
test('P1: 계획 막대는 회색, 실적 막대는 파란색이고, 실적 종료일이 없으면 기준일까지 그린다', () => {
  const row = {
    block_id: 'B-001',
    process: '절단',
    planned_start: '2026-10-01',
    planned_end: '2026-10-20',
    actual_start: '2026-10-02',
    actual_end: null,
  };
  const chart = ganttChart(row, TODAY);
  const plan = chart.data.find((t) => t.name === '계획');
  const actual = chart.data.find((t) => t.name === '실적');
  assert.equal(plan.line.color, '#9ca3af');
  assert.equal(actual.line.color, '#2563eb');
  assert.deepEqual(plan.x, ['2026-10-01', '2026-10-20']);
  assert.deepEqual(actual.x, ['2026-10-02', TODAY]);
});

test('P1: 기준일 세로선이 2026-10-31 위치에 하나 있다', () => {
  const row = {
    block_id: 'B-001',
    process: '절단',
    planned_start: '2026-10-01',
    planned_end: '2026-10-20',
    actual_start: '2026-10-02',
    actual_end: null,
  };
  const chart = ganttChart(row, TODAY);
  const lines = chart.layout.shapes.filter((s) => s.type === 'line' && s.x0 === TODAY && s.x1 === TODAY);
  assert.equal(lines.length, 1);
});

test('P1: 실적 시작일이 없으면 실적 트레이스가 없다', () => {
  const row = {
    block_id: 'B-002',
    process: '절단',
    planned_start: '2026-10-01',
    planned_end: '2026-10-20',
    actual_start: null,
    actual_end: null,
  };
  const chart = ganttChart(row, TODAY);
  assert.equal(chart.data.some((t) => t.name === '실적'), false);
  assert.equal(chart.data.some((t) => t.name === '계획'), true);
});

// P2: 상태 도넛 (FR-8 1번, T035, T036)
test('P2: 상태 도넛 라벨은 5개 순서로 고정되고, 건수가 0이어도 라벨이 빠지지 않는다', () => {
  const rows = [{ status: '완료' }, { status: '완료' }, { status: '대기' }];
  const chart = statusDonutChart(rows);
  const pie = chart.data[0];
  assert.deepEqual(pie.labels, ['대기', '진행', '완료', '진행(지연)', '완료(지연)']);
  assert.deepEqual(pie.values, [1, 0, 2, 0, 0]);
});

test('P2: 건수 합계는 입력 행 수와 같다', () => {
  const rows = [
    { status: '대기' },
    { status: '진행' },
    { status: '진행(지연)' },
    { status: '완료' },
    { status: '완료(지연)' },
    { status: '완료' },
  ];
  const pie = statusDonutChart(rows).data[0];
  assert.equal(pie.values.reduce((s, v) => s + v, 0), rows.length);
});

test('P2: 알 수 없는 상태 문자열은 세지 않아 합계가 입력 행 수보다 작다', () => {
  const rows = [{ status: '완료' }, { status: '알수없음' }];
  const pie = statusDonutChart(rows).data[0];
  assert.equal(pie.values.reduce((s, v) => s + v, 0), 1);
});

test('P2: 도넛 구멍(hole)이 설정된 pie 트레이스다', () => {
  const pie = statusDonutChart([{ status: '대기' }]).data[0];
  assert.equal(pie.type, 'pie');
  assert.ok(pie.hole > 0);
});

// P3: 호선·공정별 평균 진척률 막대 (FR-8 2번, T036)
test('P3: 호선마다 공정별 progress_pct 단순 평균을 구한다 (행별 평균)', () => {
  const rows = [
    { ship_no: '2401', process: '절단', progress_pct: 40 },
    { ship_no: '2401', process: '절단', progress_pct: 60 },
    { ship_no: '2401', process: '탑재', progress_pct: 80 },
  ];
  const chart = progressBarChart(rows);
  const cut = chart.data.find((t) => t.name === '절단');
  assert.deepEqual(cut.x, ['2401']);
  assert.deepEqual(cut.y, [50]);
});

test('P3: 공정 순서는 PROCESSES 순서(절단 → 탑재)로 고정된다', () => {
  const rows = [
    { ship_no: '2401', process: '탑재', progress_pct: 10 },
    { ship_no: '2401', process: '절단', progress_pct: 20 },
    { ship_no: '2401', process: '도장', progress_pct: 30 },
  ];
  const names = progressBarChart(rows).data.map((t) => t.name);
  assert.deepEqual(names, ['절단', '도장', '탑재']);
});

test('P3: 데이터가 없는 호선·공정 조합은 막대를 만들지 않는다 (0으로 채우지 않는다)', () => {
  const rows = [
    { ship_no: '2401', process: '절단', progress_pct: 50 },
    { ship_no: '2402', process: '탑재', progress_pct: 70 },
  ];
  const chart = progressBarChart(rows);
  const cut = chart.data.find((t) => t.name === '절단');
  const load = chart.data.find((t) => t.name === '탑재');
  assert.deepEqual(cut.x, ['2401']);
  assert.deepEqual(cut.y, [50]);
  assert.deepEqual(load.x, ['2402']);
  assert.deepEqual(load.y, [70]);
  assert.equal(chart.data.some((t) => t.y.includes(0)), false);
});
