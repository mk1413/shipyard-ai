// 집계 → 감사 → 보고 문장 파이프라인 테스트
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { openDatabase } = require('../../src/db/open');
const { migrateUp } = require('../../src/db/migrate');
const { importAll } = require('../../src/db/import-csv');
const { aggregate } = require('../../src/report/aggregate');
const { audit } = require('../../src/report/audit');
const { sentences } = require('../../src/report/sentences');
const { runPipeline } = require('../../src/report/pipeline');

const ROOT = path.join(__dirname, '..', '..');
const PROCESSES = ['절단', '소조립', '중조립', '대조립', '도장', '탑재'];
const SHIPS = ['2401', '2402', '2403', '2404'];
let dir;
let db;

before(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpi-report-'));
  db = openDatabase(path.join(dir, 'app.db'));
  migrateUp(db, path.join(ROOT, 'src', 'db', 'migrations'));
  importAll(db, path.join(ROOT, 'data'));
});

after(() => {
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

const FULL = { start: '2026-09-01', end: '2026-10-31', processes: PROCESSES, ships: SHIPS };

// --- 집계 ---
test('집계: 전체 기간 달성률은 95.5% (AC-01 기준값)', () => {
  const f = aggregate(db, FULL);
  assert.ok(Math.abs(f.production.achieve - 95.5) < 0.05);
});

test('집계: 전체 기간 지연 블록은 18개 (AC-10 기준값)', () => {
  assert.equal(aggregate(db, FULL).blocks.delayed, 18);
});

test('집계: 공정이 없으면 빈 집계이고 empty가 true다', () => {
  const f = aggregate(db, { ...FULL, processes: [] });
  assert.equal(f.empty, true);
  assert.equal(f.production.rows, 0);
});

// --- 감사 ---
test('감사: 정상 집계는 문제가 없다', () => {
  const r = audit(aggregate(db, FULL));
  assert.equal(r.ok, true);
  assert.deepEqual(r.issues, []);
});

test('감사: 불량 건수가 검사 건수보다 많으면 문제로 잡는다', () => {
  const f = aggregate(db, FULL);
  f.production.defects = f.production.inspected + 1;
  const r = audit(f);
  assert.equal(r.ok, false);
  assert.ok(r.issues.some((i) => i.code === 'defects_exceed_inspected'));
});

test('감사: 지연 블록 수가 블록 행 수보다 많으면 문제로 잡는다', () => {
  const f = aggregate(db, FULL);
  f.blocks.delayed = f.blocks.rows + 1;
  assert.ok(audit(f).issues.some((i) => i.code === 'delayed_exceeds_rows'));
});

test('감사: 달성률이 0~200 범위를 벗어나면 문제로 잡는다', () => {
  const f = aggregate(db, FULL);
  f.production.achieve = 250;
  assert.ok(audit(f).issues.some((i) => i.code === 'achieve_out_of_range'));
});

test('감사: 빈 집계는 정상이다 (데이터가 없다는 것이 정답일 수 있다)', () => {
  const r = audit(aggregate(db, { ...FULL, processes: [] }));
  assert.equal(r.ok, true);
});

// --- 보고 문장 ---
test('보고: 달성률 문장은 목표 충족 여부를 말한다', () => {
  const s = sentences(aggregate(db, FULL), audit(aggregate(db, FULL)));
  assert.ok(s.some((x) => x.includes('생산계획 달성률은 95.5%') && x.includes('목표 95% 이상을 충족')));
});

test('보고: 지연 블록 문장은 개수와 목표를 포함한다', () => {
  const s = sentences(aggregate(db, FULL), audit(aggregate(db, FULL)));
  assert.ok(s.some((x) => x.includes('지연 블록은 18개') && x.includes('목표 0개 이하')));
});

test('보고: 감사에서 문제가 있으면 그 사실을 맨 앞 문장으로 말한다', () => {
  const f = aggregate(db, FULL);
  f.production.defects = f.production.inspected + 1;
  const s = sentences(f, audit(f));
  assert.match(s[0], /감사에서 \d+건의 문제/);
});

test('보고: 데이터가 없으면 안내 문장 하나만 나온다', () => {
  const f = aggregate(db, { ...FULL, processes: [] });
  assert.deepEqual(sentences(f, audit(f)), ['선택한 조건에 해당하는 데이터가 없습니다.']);
});

test('보고: 문장에 사번이나 이름이 없다 (원칙 3)', () => {
  const s = sentences(aggregate(db, FULL), audit(aggregate(db, FULL))).join('\n');
  assert.equal(/사번|이름/.test(s), false);
});

// --- 전체 파이프라인 ---
test('파이프라인: 집계, 감사, 문장을 한 번에 돌려준다', () => {
  const r = runPipeline(db, { f: '1', start: FULL.start, end: FULL.end, processes: PROCESSES, ships: SHIPS }, { ...FULL });
  assert.ok(r.figures && r.audit && Array.isArray(r.sentences));
  assert.equal(r.audit.ok, true);
  assert.ok(r.sentences.length >= 3);
});
