'use strict';

// 탭 1 생산실적 차트 (기준 명세 FR-7). Plotly 설정 객체를 만드는 순수 함수다.
// 화면에서는 이 객체를 JSON으로 내려서 Plotly.newPlot에 넘긴다.

const TARGET_ACHIEVE = 95;

/** 일별 계획과 실적 막대, 달성률 선 (오른쪽 축 40~110, 목표 95% 점선). */
function dailyChart(rows) {
  const byDate = new Map();
  for (const r of rows) {
    const cur = byDate.get(r.date) || { plan: 0, actual: 0 };
    cur.plan += Number(r.planned_ton);
    cur.actual += Number(r.actual_ton);
    byDate.set(r.date, cur);
  }
  const dates = [...byDate.keys()].sort();
  const plan = dates.map((d) => byDate.get(d).plan);
  const actual = dates.map((d) => byDate.get(d).actual);
  const rate = dates.map((d, i) => (plan[i] === 0 ? null : (actual[i] / plan[i]) * 100));

  return {
    data: [
      { type: 'bar', name: '계획(ton)', x: dates, y: plan, marker: { color: '#cbd5e1' } },
      { type: 'bar', name: '실적(ton)', x: dates, y: actual, marker: { color: '#2563eb' } },
      { type: 'scatter', mode: 'lines+markers', name: '달성률(%)', x: dates, y: rate, yaxis: 'y2', line: { color: '#dc2626' } },
    ],
    layout: {
      title: '일별 계획 대비 실적',
      barmode: 'overlay',
      height: 420,
      yaxis: { title: '물량(ton)' },
      yaxis2: { title: '달성률(%)', overlaying: 'y', side: 'right', range: [40, 110] },
      shapes: [
        { type: 'line', xref: 'paper', x0: 0, x1: 1, yref: 'y2', y0: TARGET_ACHIEVE, y1: TARGET_ACHIEVE, line: { color: '#dc2626', dash: 'dot' } },
      ],
      legend: { orientation: 'h', y: 1.1 },
    },
  };
}

/**
 * 공정별 달성률 막대 (색 범위 80~100, 목표 95% 기준선).
 * 공정 순서는 order 배열 순서를 따르고, 데이터가 있는 공정만 그린다.
 */
function processAchieveChart(rows, order) {
  const processes = order.filter((p) => rows.some((r) => r.process === p));
  const values = processes.map((p) => {
    const mine = rows.filter((r) => r.process === p);
    const plan = mine.reduce((s, r) => s + Number(r.planned_ton), 0);
    const actual = mine.reduce((s, r) => s + Number(r.actual_ton), 0);
    return plan === 0 ? null : (actual / plan) * 100;
  });

  return {
    data: [
      {
        type: 'bar',
        name: '공정별 달성률(%)',
        x: processes,
        y: values,
        text: values.map((v) => (v == null ? '' : v.toFixed(1))),
        textposition: 'outside',
        marker: { color: values, colorscale: 'RdYlGn', cmin: 80, cmax: 100 },
      },
    ],
    layout: {
      title: '공정별 계획 달성률(%)',
      height: 380,
      yaxis: { title: '달성률(%)' },
      shapes: [
        { type: 'line', xref: 'paper', x0: 0, x1: 1, y0: TARGET_ACHIEVE, y1: TARGET_ACHIEVE, line: { color: '#475569', dash: 'dot' } },
      ],
    },
  };
}

module.exports = { dailyChart, processAchieveChart, TARGET_ACHIEVE };
