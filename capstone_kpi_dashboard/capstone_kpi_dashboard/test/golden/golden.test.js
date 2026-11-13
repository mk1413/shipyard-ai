// Python 원본(app.py, kpi_alerts.py)에서 저장한 기준값과 Node 계산이 같은지 확인한다.
// 기준값은 test/golden/baseline.json이다. 값이 달라지면 Node 쪽을 고친다 (기술 설계 R3).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { openDatabase } = require('../../src/db/open');
const { migrateUp } = require('../../src/db/migrate');
const { importAll } = require('../../src/db/import-csv');
const { normalizeFilters, bounds, productionRows, equipmentRows, blockRows } = require('../../src/repo/queries');
const { achieve, defectRate, oeeCalc, mhEfficiency, delayedBlockCount } = require('../../src/domain/kpi');
const { blocksInPeriod } = require('../../src/domain/period');
const { kpiStatus } = require('../../src/domain/alerts');
const { TODAY, PROCESSES } = require('../../src/config');

const ROOT = path.join(__dirname, '..', '..');
const BASELINE = JSON.parse(fs.readFileSync(path.join(__dirname, 'baseline.json'), 'utf8'));

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpi-golden-'));
let db;
// 골든 DB 준비는 한 번만 하고, 각 테스트가 이 준비를 기다린다.
const ready = (async () => {
  db = await openDatabase(path.join(dir, 'app.db'));
  await migrateUp(db, path.join(ROOT, 'src', 'db', 'migrations'));
  await importAll(db, path.join(ROOT, 'data'));
})();

async function summarize(start, end) {
  const b = await bounds(db);
  const f = normalizeFilters({ f: '1', start, end, processes: PROCESSES, ships: b.ships }, b);
  const P = await productionRows(db, f);
  const E = await equipmentRows(db, f);
  const B = await blockRows(db, { ...f, processes: PROCESSES });
  const mh = mhEfficiency(blocksInPeriod(B, f.start, f.end, TODAY));

  const byDate = new Map();
  for (const r of P) {
    const cur = byDate.get(r.date) || { defect: 0, inspected: 0 };
    cur.defect += r.defect_cnt;
    cur.inspected += r.inspected_cnt;
    byDate.set(r.date, cur);
  }
  const rates = [...byDate.entries()].map(([d, v]) => [d, (v.defect / v.inspected) * 100]);
  const over = rates.filter(([, r]) => r > 3);
  const [maxDate, maxRate] = rates.reduce((a, b) => (b[1] > a[1] ? b : a));

  const procAch = {};
  for (const p of PROCESSES) {
    const rows = P.filter((r) => r.process === p);
    if (rows.length) procAch[p] = achieve(rows);
  }
  const eqOee = {};
  for (const id of [...new Set(E.map((r) => r.equipment_id))]) {
    eqOee[id] = oeeCalc(E.filter((r) => r.equipment_id === id)).oee;
  }

  const ach = achieve(P);
  const oee = oeeCalc(E).oee;
  const dfc = defectRate(P);
  const delayed = delayedBlockCount(B);
  return {
    achieve: ach,
    oee,
    defect: dfc,
    mh_eff: mh,
    delayed_blocks: delayed,
    defect_over_days: over.length,
    defect_max: maxRate,
    defect_max_date: maxDate.slice(5).replace('-', '/'),
    process_achieve: procAch,
    equipment_oee: eqOee,
    status: {
      achieve: kpiStatus('achieve', ach),
      oee: kpiStatus('oee', oee),
      defect: kpiStatus('defect', dfc),
      mh_eff: kpiStatus('mh_eff', mh),
      delay: kpiStatus('delay', delayed),
    },
  };
}

const CASES = {
  // 전체 기간 (데이터 기준: 2026-09-01 ~ 10-31, README 참고)
  full: ['2026-09-01', '2026-10-31'],
  ac08_1013_1017: ['2026-10-13', '2026-10-17'],
  ac09_0914_0919: ['2026-09-14', '2026-09-19'],
};

// 소수 첫째 자리 값은 0.05, 둘째 자리 값은 0.005 안이면 같은 값으로 본다 (반올림 차이 허용).
function close(actual, expected, digits, label) {
  const tol = digits === 2 ? 0.005 : 0.05;
  assert.ok(Math.abs(actual - expected) <= tol, `${label}: ${actual} ≠ ${expected}`);
}

for (const [name, [start, end]] of Object.entries(CASES)) {
  const want = BASELINE[name];
  test(`골든 ${name}: 달성률, OEE, 맨아워 효율, 불량률 값이 기준과 같다`, async () => {
    await ready;
    const got = await summarize(start, end);
    close(got.achieve, want.achieve, 1, `${name} achieve`);
    close(got.oee, want.oee, 1, `${name} oee`);
    close(got.defect, want.defect, 2, `${name} defect`);
    close(got.mh_eff, want.mh_eff, 1, `${name} mh_eff`);
  });

  test(`골든 ${name}: 지연 블록 수, 불량 초과 일수, 최고 불량률과 날짜가 기준과 같다`, async () => {
    await ready;
    const got = await summarize(start, end);
    assert.equal(got.delayed_blocks, want.delayed_blocks, `${name} delayed`);
    assert.equal(got.defect_over_days, want.defect_over_days, `${name} over days`);
    close(got.defect_max, want.defect_max, 2, `${name} defect_max`);
    assert.equal(got.defect_max_date, want.defect_max_date, `${name} defect_max_date`);
  });

  test(`골든 ${name}: 공정별 달성률과 설비별 OEE가 기준과 같다`, async () => {
    await ready;
    const got = await summarize(start, end);
    for (const [p, v] of Object.entries(want.process_achieve)) {
      close(got.process_achieve[p], v, 1, `${name} ${p}`);
    }
    for (const [id, v] of Object.entries(want.equipment_oee)) {
      close(got.equipment_oee[id], v, 1, `${name} ${id}`);
    }
  });

  test(`골든 ${name}: 상태 판정(정상, 주의, 미달)이 기준과 같다`, async () => {
    await ready;
    const got = await summarize(start, end);
    assert.deepEqual(got.status, want.status);
  });
}

test('골든 AC-08: 10/13~10/17 대조립 달성률은 미달이고 CR-02 OEE는 설비 경고 대상이다', async () => {
    await ready;
  const got = await summarize('2026-10-13', '2026-10-17');
  assert.equal(got.process_achieve['대조립'] < 95, true);
  assert.ok(got.equipment_oee['CR-02'] < 75);
});

test('정리: 골든 테스트 DB 삭제', async () => {
    await ready;
  db.close();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* Windows에서 libsql이 파일 핸들을 늦게 놓아 임시 폴더 삭제가 실패할 수 있다 */ }
});
