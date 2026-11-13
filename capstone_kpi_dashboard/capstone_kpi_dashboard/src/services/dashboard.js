'use strict';

const { TODAY } = require('../config');
const { PROCESSES } = require('../config');
const { bounds, normalizeFilters, productionRows, equipmentRows, blockRows, topDelayed } = require('../repo/queries');
const { achieve, defectRate, oeeCalc, mhEfficiency, delayedBlockCount } = require('../domain/kpi');
const { blocksInPeriod, previousPeriod } = require('../domain/period');
const { TARGET, STATUS_ICON, kpiStatus, gapText } = require('../domain/alerts');
const { dailyChart, processAchieveChart } = require('../charts/production');
const { oeeBarChart, equipmentWarnings, equipmentSummary, downtimeTrendChart } = require('../charts/equipment');
const { defectTrendChart, paretoChart, defectOverWarning, totalRework } = require('../charts/quality');
const { ganttChart, statusDonutChart, progressBarChart } = require('../charts/blocks');

// KPI 카드 정의 (기준 명세 FR-4, FR-6). 표시 순서가 화면 순서다.
const KPI_DEFS = [
  { key: 'achieve', name: '생산계획 달성률', target: `${TARGET.achieve}% 이상`, delta: true },
  { key: 'oee', name: '설비 종합효율(OEE)', target: `${TARGET.oee}% 이상`, delta: true },
  { key: 'defect', name: '용접·검사 불량률', target: `${TARGET.defect}% 이하`, delta: true },
  { key: 'mh_eff', name: '맨아워 효율', target: `${TARGET.mh_eff}% 이상`, delta: false },
  { key: 'delay', name: '지연 블록 수', target: `${TARGET.delay}개 이하`, delta: false },
];

function formatValue(key, v) {
  if (v == null) return '데이터 없음';
  if (key === 'delay') return `${v}개`;
  if (key === 'defect') return `${v.toFixed(2)}%`;
  return `${v.toFixed(1)}%`;
}

// 직전 기간 대비 증감 (FR-5). 예: '+1.2%p'
function formatDelta(key, diff) {
  const digits = key === 'defect' ? 2 : 1;
  return `${diff < 0 ? '-' : '+'}${Math.abs(diff).toFixed(digits)}%p`;
}

/**
 * 대시보드 화면에 필요한 값을 만든다.
 * 생산 데이터가 없으면 { empty: true }만 돌려준다 (FR-3).
 */
async function buildDashboard(db, raw) {
  const b = await bounds(db);
  const f = normalizeFilters(raw, b);
  const P = await productionRows(db, f);
  const E = await equipmentRows(db, f);
  const B = await blockRows(db, f);

  if (P.length === 0) {
    return { empty: true, filters: f, bounds: b };
  }

  const values = {
    achieve: achieve(P),
    oee: oeeCalc(E).oee,
    defect: defectRate(P),
    mh_eff: mhEfficiency(blocksInPeriod(B, f.start, f.end, TODAY)),
    delay: delayedBlockCount(B),
  };

  // 직전 기간 (FR-5). 직전 기간 생산 데이터가 하나도 없으면 증감을 생략한다 (AC-06).
  const prev = previousPeriod(f.start, f.end);
  const pf = { ...f, start: prev.start, end: prev.end };
  const Pp = await productionRows(db, pf);
  const Ep = await equipmentRows(db, pf);
  const prevValues = Pp.length
    ? { achieve: achieve(Pp), oee: oeeCalc(Ep).oee, defect: defectRate(Pp) }
    : null;

  const kpis = KPI_DEFS.map((def) => {
    const value = values[def.key];
    const status = kpiStatus(def.key, value);
    const hasDelta = def.delta && prevValues && prevValues[def.key] != null && value != null;
    return {
      key: def.key,
      name: def.name,
      target: def.target,
      value,
      text: formatValue(def.key, value),
      status,
      icon: STATUS_ICON[status],
      gap: value == null ? null : gapText(def.key, value),
      delta: hasDelta ? formatDelta(def.key, value - prevValues[def.key]) : null,
    };
  });

  // 주의와 미달 항목마다 한 줄씩 경고 (FR-6). 미달은 crit, 주의는 warn.
  const problems = kpis
    .filter((k) => k.status === 'warn' || k.status === 'crit')
    .map((k) => ({
      level: k.status,
      message: `${k.icon} ${k.name} ${k.text} · 목표 ${k.target} · 목표 대비 ${k.gap}`,
    }));

  // 탭별 세부 경고 (FR-7 ~ FR-10). 주의와 미달인 항목만 만든다.
  const tabAlerts = [];
  for (const proc of PROCESSES.filter((p) => f.processes.includes(p))) {
    const rows = P.filter((r) => r.process === proc);
    if (rows.length === 0) continue;
    const v = achieve(rows);
    const s = kpiStatus('achieve', v);
    if (s === 'warn' || s === 'crit') {
      tabAlerts.push({ tab: 'production', level: s, message: `공정 ${proc} 달성률 ${v.toFixed(1)}% · 목표 ${TARGET.achieve}% 미달` });
    }
  }
  for (const w of equipmentWarnings(E)) {
    tabAlerts.push({ tab: 'equipment', level: w.level, message: w.message });
  }
  const defectWarning = defectOverWarning(P);
  if (defectWarning) {
    tabAlerts.push({ tab: 'quality', level: defectWarning.level, message: defectWarning.message });
  }

  const top = await topDelayed(db, f, 10);

  // 블록 탭 (FR-8). 블록 선택 목록은 호선·공정 필터만 따르고 기간 필터는 적용하지 않는다.
  const blocks = B.map((r) => ({
    key: `${r.block_id}|${r.process}`,
    label: `${r.block_id} ${r.process}`,
    block_id: r.block_id,
    ship_no: r.ship_no,
    process: r.process,
  }));
  const selectedBlock = blocks.find((b) => b.key === raw.block) || null;
  const selectedRow = selectedBlock
    ? B.find((r) => r.block_id === selectedBlock.block_id && r.process === selectedBlock.process)
    : null;

  const charts = {
    daily: dailyChart(P),
    process: processAchieveChart(P, f.processes),
    equipment: oeeBarChart(E),
    downtime: downtimeTrendChart(E),
    defect: defectTrendChart(P),
    pareto: paretoChart(P),
    blockDonut: statusDonutChart(B),
    blockProgress: progressBarChart(B),
  };
  if (selectedRow) charts.gantt = ganttChart(selectedRow, TODAY);

  return {
    empty: false,
    filters: f,
    bounds: b,
    kpis,
    problems,
    allOk: problems.length === 0,
    tabAlerts,
    top,
    charts,
    blocks,
    selectedBlock,
    rework: totalRework(P),
    equipSummary: equipmentSummary(E),
    raw: P,
  };
}

module.exports = { buildDashboard, formatValue, formatDelta };
