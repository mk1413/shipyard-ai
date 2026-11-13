'use strict';

// 탭 4 품질 차트와 경고 (기준 명세 FR-10, AC-09). 순수 함수다.

const { TARGET, kpiStatus } = require('../domain/alerts');

/** 날짜별 불량 합계와 검사 합계. */
function dailyDefects(rows) {
  const byDate = new Map();
  for (const r of rows) {
    const cur = byDate.get(r.date) || { defect: 0, inspected: 0 };
    cur.defect += Number(r.defect_cnt);
    cur.inspected += Number(r.inspected_cnt);
    byDate.set(r.date, cur);
  }
  return [...byDate.keys()].sort().map((d) => {
    const v = byDate.get(d);
    return { date: d, rate: v.inspected === 0 ? null : (v.defect / v.inspected) * 100 };
  });
}

/** 일별 불량률 추이 선, 목표 상한 3% 점선. */
function defectTrendChart(rows) {
  const days = dailyDefects(rows);
  return {
    data: [
      {
        type: 'scatter',
        mode: 'lines+markers',
        name: '불량률(%)',
        x: days.map((d) => d.date),
        y: days.map((d) => d.rate),
        line: { color: '#2563eb' },
      },
    ],
    layout: {
      title: '일별 불량률 추이(%)',
      height: 400,
      shapes: [
        { type: 'line', xref: 'paper', x0: 0, x1: 1, y0: TARGET.defect, y1: TARGET.defect, line: { color: '#dc2626', dash: 'dot' } },
      ],
    },
  };
}

/**
 * 불량률 상한 초과 경고 (AC-09). 상한을 넘은 날이 없으면 null.
 * 경고 강도는 최고값 기준이다.
 */
function defectOverWarning(rows) {
  const days = dailyDefects(rows);
  const over = days.filter((d) => d.rate != null && d.rate > TARGET.defect);
  if (over.length === 0) return null;
  const worst = over.reduce((a, c) => (c.rate > a.rate ? c : a));
  const level = kpiStatus('defect', worst.rate);
  if (level !== 'warn' && level !== 'crit') return null;
  return {
    over_days: over.length,
    level,
    message: `불량률 목표 상한 초과 ${over.length}일 · 최고 ${worst.rate.toFixed(2)}% (${worst.date.slice(5).replace('-', '/')})`,
  };
}

/** 공정별 불량 파레토: 불량 건수 내림차순 막대, 누적 비율 선 (오른쪽 축 0~105). */
function paretoChart(rows) {
  const byProc = new Map();
  for (const r of rows) {
    byProc.set(r.process, (byProc.get(r.process) || 0) + Number(r.defect_cnt));
  }
  const sorted = [...byProc.entries()].sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((s, [, n]) => s + n, 0);
  let running = 0;
  const cumulative = sorted.map(([, n]) => {
    running += n;
    return total === 0 ? 0 : (running / total) * 100;
  });

  return {
    data: [
      { type: 'bar', name: '불량 건수', x: sorted.map(([p]) => p), y: sorted.map(([, n]) => n), marker: { color: '#f59e0b' } },
      { type: 'scatter', mode: 'lines+markers', name: '누적 비율(%)', x: sorted.map(([p]) => p), y: cumulative, yaxis: 'y2', line: { color: '#dc2626' } },
    ],
    layout: {
      title: '공정별 불량 파레토',
      height: 400,
      yaxis2: { overlaying: 'y', side: 'right', range: [0, 105] },
      legend: { orientation: 'h', y: 1.1 },
    },
  };
}

/** 총 재작업 시간(시간). */
function totalRework(rows) {
  return rows.reduce((s, r) => s + Number(r.rework_hr || 0), 0);
}

module.exports = { defectTrendChart, paretoChart, defectOverWarning, totalRework };
