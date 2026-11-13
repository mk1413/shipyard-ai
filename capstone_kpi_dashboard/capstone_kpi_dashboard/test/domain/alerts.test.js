const { test } = require('node:test');
const assert = require('node:assert/strict');
const { kpiStatus, gapText, TARGET } = require('../../src/domain/alerts');

test('목표 상수는 기준 명세 FR-6과 같다', () => {
  assert.deepEqual(TARGET, { achieve: 95, oee: 75, defect: 3, mh_eff: 95, delay: 0 });
});

test('달성률: 95 이상 정상, 92 이상 95 미만 주의, 92 미만 미달', () => {
  assert.equal(kpiStatus('achieve', 95), 'ok');
  assert.equal(kpiStatus('achieve', 94.9), 'warn');
  assert.equal(kpiStatus('achieve', 92), 'warn');
  assert.equal(kpiStatus('achieve', 91.9), 'crit');
});

test('OEE: 75 이상 정상, 70 이상 75 미만 주의, 70 미만 미달', () => {
  assert.equal(kpiStatus('oee', 75), 'ok');
  assert.equal(kpiStatus('oee', 70), 'warn');
  assert.equal(kpiStatus('oee', 69.9), 'crit');
});

test('불량률: 3 이하 정상, 3.5 이하 주의, 3.5 초과 미달', () => {
  assert.equal(kpiStatus('defect', 3), 'ok');
  assert.equal(kpiStatus('defect', 3.2), 'warn');
  assert.equal(kpiStatus('defect', 3.5), 'warn');
  assert.equal(kpiStatus('defect', 3.51), 'crit');
});

test('맨아워 효율은 달성률과 같은 구간을 쓴다', () => {
  assert.equal(kpiStatus('mh_eff', 95), 'ok');
  assert.equal(kpiStatus('mh_eff', 92), 'warn');
  assert.equal(kpiStatus('mh_eff', 91.9), 'crit');
});

test('지연 블록 수: 0 정상, 1~4 주의, 5 이상 미달', () => {
  assert.equal(kpiStatus('delay', 0), 'ok');
  assert.equal(kpiStatus('delay', 1), 'warn');
  assert.equal(kpiStatus('delay', 4), 'warn');
  assert.equal(kpiStatus('delay', 5), 'crit');
});

test('AC-05: 값이 없으면 na (null, undefined, NaN 모두)', () => {
  assert.equal(kpiStatus('achieve', null), 'na');
  assert.equal(kpiStatus('achieve', undefined), 'na');
  assert.equal(kpiStatus('achieve', NaN), 'na');
});

test('AC-02: 목표 대비 차이 문구 (달성률은 %p, 지연은 건)', () => {
  assert.equal(gapText('achieve', 91.2), '-3.8%p');
  assert.equal(gapText('defect', 3.2), '+0.2%p');
  assert.equal(gapText('delay', 5), '+5건');
});
