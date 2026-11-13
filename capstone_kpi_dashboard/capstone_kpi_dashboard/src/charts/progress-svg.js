'use strict';

// 진척도 그래프를 인라인 SVG 문자열로 만든다. 외부 라이브러리와 외부 주소를 쓰지 않는다 (원칙 5).
// 색은 CSS 변수(--s0 ~ --s3, 진척 단계 색)로 지정해서 라이트·다크 모드를 함께 따른다.

function esc(v) {
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const fmtPct = (v) => (v == null ? '-' : `${v.toFixed(1)}%`);

/**
 * 호선별 전체 진척률 가로 막대 그래프. 점선은 목표 90%.
 * @param {{ship_no: string, avg: number|null, level: string}[]} ships
 */
function shipBarsSvg(ships) {
  const W = 640;
  const rowH = 46;
  const left = 96;
  const right = 72;
  const top = 34;
  const H = top + ships.length * rowH + 10;
  const barW = W - left - right;
  const x90 = left + (barW * 90) / 100;

  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="호선별 전체 진척률 막대 그래프">`;
  s += `<line class="target" x1="${x90}" y1="${top - 10}" x2="${x90}" y2="${H - 6}"/>`;
  s += `<text class="axis" x="${x90}" y="${top - 16}" text-anchor="middle">목표 90%</text>`;
  ships.forEach((sh, i) => {
    const y = top + i * rowH;
    const pct = sh.avg == null ? 0 : Math.min(100, Math.max(0, sh.avg));
    const w = (barW * pct) / 100;
    s += `<text class="label" x="0" y="${y + 19}">${esc(sh.ship_no)}호선</text>`;
    s += `<rect class="track" x="${left}" y="${y + 8}" width="${barW}" height="20" rx="10"/>`;
    if (w > 0) s += `<rect class="fill ${esc(sh.level)}" x="${left}" y="${y + 8}" width="${w.toFixed(2)}" height="20" rx="10"/>`;
    s += `<text class="value" x="${W - right + 10}" y="${y + 23}">${fmtPct(sh.avg)}</text>`;
  });
  s += '</svg>';
  return s;
}

/**
 * 호선 × 공정 묶음 세로 막대 그래프. 한 묶음이 공정 하나, 막대 하나가 호선 하나다.
 * @param {{ship_no: string, cells: Record<string, {avg: number|null}>}[]} ships
 * @param {string[]} processes
 */
function processColumnsSvg(ships, processes) {
  const W = 760;
  const H = 320;
  const left = 46;
  const bottom = 44;
  const top = 18;
  const plotW = W - left - 12;
  const plotH = H - top - bottom;
  const groupW = plotW / processes.length;
  const colW = (groupW * 0.78) / Math.max(1, ships.length);

  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="호선별 공정 진척률 막대 그래프">`;
  for (const g of [0, 25, 50, 75, 100]) {
    const y = top + plotH - (plotH * g) / 100;
    s += `<line class="grid" x1="${left}" y1="${y}" x2="${W - 12}" y2="${y}"/>`;
    s += `<text class="axis" x="${left - 8}" y="${y + 4}" text-anchor="end">${g}%</text>`;
  }
  processes.forEach((proc, p) => {
    const gx = left + p * groupW + groupW * 0.11;
    ships.forEach((sh, i) => {
      const v = sh.cells[proc] ? sh.cells[proc].avg : null;
      const pct = v == null ? 0 : Math.min(100, Math.max(0, v));
      const h = (plotH * pct) / 100;
      const x = gx + i * colW;
      const y = top + plotH - h;
      s += `<rect class="col s${i}" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${(colW - 3).toFixed(2)}" height="${h.toFixed(2)}" rx="3">`;
      s += `<title>${esc(sh.ship_no)}호선 ${esc(proc)} ${fmtPct(v)}</title></rect>`;
    });
    s += `<text class="label" x="${(left + p * groupW + groupW / 2).toFixed(1)}" y="${H - 14}" text-anchor="middle">${esc(proc)}</text>`;
  });
  s += '</svg>';
  return s;
}

/**
 * 설비별 정지 시간 가로 막대그래프 (분). 가장 긴 막대가 100%다.
 * @param {{equipment_id: string, equipment_type: string, count: number, total_min: number}[]} items
 */
function equipmentBarsSvg(items) {
  if (items.length === 0) return '<p class="muted">고장 이력이 없습니다.</p>';
  const W = 640;
  const rowH = 40;
  const left = 150;
  const right = 96;
  const top = 12;
  const H = top + items.length * rowH + 8;
  const barW = W - left - right;
  const max = Math.max(...items.map((i) => Number(i.total_min)), 1);

  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="설비별 정지 시간 막대 그래프">`;
  items.forEach((it, i) => {
    const y = top + i * rowH;
    const w = (barW * Number(it.total_min)) / max;
    s += `<text class="label" x="0" y="${y + 19}">${esc(it.equipment_id)} <tspan class="axis">${esc(it.equipment_type)}</tspan></text>`;
    s += `<rect class="track" x="${left}" y="${y + 8}" width="${barW}" height="18" rx="9"/>`;
    s += `<rect class="fill crit" x="${left}" y="${y + 8}" width="${w.toFixed(2)}" height="18" rx="9"/>`;
    s += `<text class="value" x="${W - right + 10}" y="${y + 22}">${Number(it.total_min)}분 · ${Number(it.count)}건</text>`;
  });
  s += '</svg>';
  return s;
}

/**
 * 일별 생산 달성률 추이 꺾은선 그래프. 점선은 목표 95%.
 * @param {{date: string, pct: number}[]} points 날짜 오름차순
 */
function trendSvg(points, target = 95) {
  if (points.length === 0) return '<p class="muted">생산 데이터가 없습니다.</p>';
  const W = 760;
  const H = 260;
  const left = 46;
  const right = 14;
  const top = 16;
  const bottom = 30;
  const values = points.map((p) => p.pct);
  const lo = Math.floor(Math.min(...values, target) / 5) * 5 - 5;
  const hi = Math.ceil(Math.max(...values, target) / 5) * 5 + 5;
  const plotW = W - left - right;
  const plotH = H - top - bottom;
  const x = (i) => left + (points.length === 1 ? plotW / 2 : (plotW * i) / (points.length - 1));
  const y = (v) => top + plotH - (plotH * (v - lo)) / (hi - lo);

  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="일별 생산 달성률 추이 그래프">`;
  for (let g = lo; g <= hi; g += 5) {
    s += `<line class="grid" x1="${left}" y1="${y(g).toFixed(1)}" x2="${W - right}" y2="${y(g).toFixed(1)}"/>`;
    s += `<text class="axis" x="${left - 8}" y="${(y(g) + 4).toFixed(1)}" text-anchor="end">${g}%</text>`;
  }
  s += `<line class="target" x1="${left}" y1="${y(target).toFixed(1)}" x2="${W - right}" y2="${y(target).toFixed(1)}"/>`;
  s += `<text class="axis" x="${W - right}" y="${(y(target) - 6).toFixed(1)}" text-anchor="end">목표 ${target}%</text>`;
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.pct).toFixed(1)}`).join(' ');
  s += `<path class="trend-line" d="${path}" fill="none"/>`;
  points.forEach((p, i) => {
    s += `<circle class="trend-dot ${p.pct >= target ? 'good' : 'crit'}" cx="${x(i).toFixed(1)}" cy="${y(p.pct).toFixed(1)}" r="3.5">`;
    s += `<title>${esc(p.date)} ${p.pct.toFixed(1)}%</title></circle>`;
  });
  // 날짜 눈금은 최대 8개만 표시한다
  const step = Math.max(1, Math.ceil(points.length / 8));
  points.forEach((p, i) => {
    if (i % step === 0) s += `<text class="axis" x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(p.date.slice(5))}</text>`;
  });
  s += '</svg>';
  return s;
}

module.exports = { shipBarsSvg, processColumnsSvg, equipmentBarsSvg, trendSvg, esc };
