'use strict';

const { PROCESSES } = require('../config');

// 블록 탭 차트 (기준 명세 FR-8). Plotly 설정 객체 {data, layout}를 만드는 순수 함수다.

const PLAN_COLOR = '#9ca3af';
const ACTUAL_COLOR = '#2563eb';
const DELAY_LINE_COLOR = '#dc2626';

/**
 * 간트차트 막대 한 블록-공정분 (FR-8).
 * 계획 막대는 계획 시작일과 종료일을 쓴다.
 * 실적 막대는 실적 시작일이 있을 때만 그리고, 종료일이 없으면 기준일까지 그린다 (AC-11).
 */
function ganttBars(row, today) {
  const bars = [{ kind: '계획', start: row.planned_start, end: row.planned_end }];
  if (row.actual_start != null && row.actual_start !== '') {
    const end = row.actual_end != null && row.actual_end !== '' ? row.actual_end : today;
    bars.push({ kind: '실적', start: row.actual_start, end });
  }
  return bars;
}

/**
 * 블록-공정 한 행의 간트차트 (FR-8 3번).
 * 막대는 가로 선으로 그린다 (날짜 축). 기준일에 빨간 점선 세로선을 하나 둔다.
 */
function ganttChart(row, today) {
  const label = `${row.block_id} ${row.process}`;
  const data = ganttBars(row, today).map((b) => ({
    type: 'scatter',
    mode: 'lines',
    name: b.kind,
    x: [b.start, b.end],
    y: [label, label],
    line: { width: 12, color: b.kind === '계획' ? PLAN_COLOR : ACTUAL_COLOR },
  }));

  return {
    data,
    layout: {
      title: '블록 간트차트',
      height: 220,
      xaxis: { type: 'date' },
      yaxis: { automargin: true },
      shapes: [
        {
          type: 'line',
          xref: 'x',
          x0: today,
          x1: today,
          yref: 'paper',
          y0: 0,
          y1: 1,
          line: { color: DELAY_LINE_COLOR, dash: 'dot' },
        },
      ],
      legend: { orientation: 'h', y: 1.2 },
    },
  };
}

// 블록 상태 5종 (FR-8 1번). 순서와 라벨은 고정이다. 대기(지연)은 시작 전 행이 지연 0이라 나오지 않는다.
const STATUS_LABELS = ['대기', '진행', '완료', '진행(지연)', '완료(지연)'];

/** 블록-공정 상태 도넛. 각 라벨의 건수를 세고, 알 수 없는 상태는 세지 않는다. */
function statusDonutChart(rows) {
  const counts = new Map(STATUS_LABELS.map((l) => [l, 0]));
  for (const r of rows) {
    if (counts.has(r.status)) counts.set(r.status, counts.get(r.status) + 1);
  }
  return {
    data: [
      {
        type: 'pie',
        labels: STATUS_LABELS,
        values: STATUS_LABELS.map((l) => counts.get(l)),
        hole: 0.5,
        sort: false,
        textinfo: 'label+value',
      },
    ],
    layout: { title: '블록 상태', height: 360, legend: { orientation: 'h', y: -0.1 } },
  };
}

/**
 * 호선·공정별 평균 진척률 묶음 막대 (FR-8 2번).
 * 평균은 행별 progress_pct의 단순 평균이다. 데이터가 없는 호선·공정 조합은 막대를 만들지 않는다.
 * 공정 순서는 PROCESSES를 따르고, 호선은 호선 번호 순서다.
 */
function progressBarChart(rows) {
  const ships = [...new Set(rows.map((r) => r.ship_no))].sort();
  const data = [];
  for (const proc of PROCESSES) {
    const mine = rows.filter((r) => r.process === proc);
    if (mine.length === 0) continue;
    const x = [];
    const y = [];
    for (const ship of ships) {
      const cell = mine.filter((r) => r.ship_no === ship);
      if (cell.length === 0) continue;
      x.push(ship);
      y.push(cell.reduce((sum, r) => sum + Number(r.progress_pct), 0) / cell.length);
    }
    data.push({ type: 'bar', name: proc, x, y });
  }
  return {
    data,
    layout: { title: '호선·공정별 평균 진척률(%)', barmode: 'group', height: 380, yaxis: { title: '진척률(%)', range: [0, 100] } },
  };
}

module.exports = { ganttBars, ganttChart, statusDonutChart, progressBarChart };
