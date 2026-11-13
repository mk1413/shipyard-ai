'use strict';

// 탭 3 설비 OEE 차트 (기준 명세 FR-9). Plotly 설정 객체를 만드는 순서 없는 순수 함수.

const { oeeCalc } = require('../domain/kpi');
const { TARGET, kpiStatus } = require('../domain/alerts');

/** 설비별 OEE 계산. 설비 id마다 한 줄이고, 설비 종류를 함께 돌려준다. */
function equipmentOee(equipment) {
  const ids = [...new Set(equipment.map((r) => r.equipment_id))];
  return ids
    .map((id) => {
      const rows = equipment.filter((r) => r.equipment_id === id);
      return { equipment_id: id, equipment_type: rows[0].equipment_type, oee: oeeCalc(rows).oee };
    })
    .sort((a, b) => a.oee - b.oee);
}

/** 설비별 OEE 막대: 낮은 순 정렬, 색 범위 50~85, 기준선 75%. */
function oeeBarChart(equipment) {
  const rows = equipmentOee(equipment);
  return {
    data: [
      {
        type: 'bar',
        orientation: 'h',
        name: '설비별 OEE(%)',
        y: rows.map((r) => r.equipment_id),
        x: rows.map((r) => r.oee),
        text: rows.map((r) => r.oee.toFixed(1)),
        textposition: 'outside',
        hovertext: rows.map((r) => `${r.equipment_id} · ${r.equipment_type} · OEE ${r.oee.toFixed(1)}%`),
        hoverinfo: 'text',
        marker: { color: rows.map((r) => r.oee), colorscale: 'RdYlGn', cmin: 50, cmax: 85 },
      },
    ],
    layout: {
      title: '설비별 OEE(%)',
      height: 400,
      xaxis: { title: 'OEE(%)' },
      yaxis: { automargin: true },
      shapes: [
        { type: 'line', yref: 'paper', y0: 0, y1: 1, xref: 'x', x0: TARGET.oee, x1: TARGET.oee, line: { color: '#475569', dash: 'dot' } },
      ],
      showlegend: false,
    },
  };
}

/**
 * 목표(75%) 미달 설비의 경고 목록 (FR-9). 정상 설비는 빠진다. OEE가 낮은 순서다.
 * @returns {{equipment_id: string, equipment_type: string, oee: number, level: 'warn'|'crit', message: string}[]}
 */
function equipmentWarnings(equipment) {
  return equipmentOee(equipment)
    .map((r) => ({ ...r, level: kpiStatus('oee', r.oee) }))
    .filter((r) => r.level === 'warn' || r.level === 'crit')
    .map((r) => ({
      equipment_id: r.equipment_id,
      equipment_type: r.equipment_type,
      oee: r.oee,
      level: r.level,
      message: `설비 ${r.equipment_id} (${r.equipment_type}) OEE ${r.oee.toFixed(1)}% · 목표 ${TARGET.oee}% 미달`,
    }));
}

/** 요약 카드 4개 값: 가동률, 성능효율, 양품률, OEE (설비 전체 기준, %). */
function equipmentSummary(equipment) {
  return oeeCalc(equipment);
}

/** 설비별 일 정지시간 추이 (분). 설비마다 한 선이고, 데이터가 없는 날은 0이다. */
function downtimeTrendChart(equipment) {
  const dates = [...new Set(equipment.map((r) => r.date))].sort();
  const ids = [...new Set(equipment.map((r) => r.equipment_id))].sort();
  const data = ids.map((id) => ({
    type: 'scatter',
    mode: 'lines+markers',
    name: id,
    x: dates,
    y: dates.map((d) =>
      equipment
        .filter((r) => r.equipment_id === id && r.date === d)
        .reduce((s, r) => s + Number(r.downtime_min), 0),
    ),
  }));
  return {
    data: ids.length === 0 ? [] : data,
    layout: { title: '설비별 일 정지시간(분)', height: 400, yaxis: { title: '정지시간(분)' } },
  };
}

module.exports = { oeeBarChart, equipmentWarnings, equipmentSummary, downtimeTrendChart };
