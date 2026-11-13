'use strict';

// 가상 데이터 생성: 설비 고장 이력(equipment_failures.csv)과 블록 지연 사유(delay_reasons.csv).
// 실행: npm run generate:extra
// 고정 시드를 쓰므로 여러 번 실행해도 같은 파일이 나온다 (기준 명세 §9 재현성).
const fs = require('node:fs');
const path = require('node:path');
const { TODAY } = require('../src/config');
const { blockStatus } = require('../src/domain/block-status');
const { parseCsv } = require('../src/db/csv');

const DATA = path.join(__dirname, '..', 'data');
const BOM = '﻿';

const CAUSES = ['유압 계통 누유', '베어링 마모', '센서 오류', '전원 차단', '제어 소프트웨어 오류', '냉각수 부족'];
const REASONS = ['자재 입고 지연', '설계 변경', '설비 고장', '인력 부족', '선행 공정 지연', '기상 악화'];

// 고정 시드 난수 (mulberry32)
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function readCsv(name) {
  return parseCsv(fs.readFileSync(path.join(DATA, name), 'utf8'));
}

function writeCsv(name, header, rows) {
  const lines = [header.join(',')];
  for (const r of rows) lines.push(header.map((h) => r[h]).join(','));
  fs.writeFileSync(path.join(DATA, name), BOM + lines.join('\n') + '\n', 'utf8');
  console.log(`${name}: ${rows.length}행`);
}

// 1) 설비 고장 이력: 설비마다 2~4건, 2026-09-01 ~ 10-31 사이에서 무작위
function makeFailures() {
  const eq = readCsv('equipment.csv');
  const byId = new Map();
  for (const r of eq) if (!byId.has(r.equipment_id)) byId.set(r.equipment_id, r);

  const rand = rng(20260901);
  const start = Date.UTC(2026, 8, 1);
  const days = Math.round((Date.UTC(2026, 9, 31) - start) / 86400000);
  const rows = [];
  let seq = 1;
  for (const [id, e] of [...byId.entries()].sort()) {
    const n = 2 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const d = new Date(start + Math.floor(rand() * (days + 1)) * 86400000);
      rows.push({
        failure_id: `F${String(seq++).padStart(3, '0')}`,
        date: d.toISOString().slice(0, 10),
        equipment_id: id,
        equipment_type: e.equipment_type,
        process: e.process,
        duration_min: String(30 + Math.floor(rand() * 451)),
        cause: CAUSES[Math.floor(rand() * CAUSES.length)],
      });
    }
  }
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.failure_id < b.failure_id ? -1 : 1));
  writeCsv('equipment_failures.csv', ['failure_id', 'date', 'equipment_id', 'equipment_type', 'process', 'duration_min', 'cause'], rows);
}

// 2) 지연 사유: 지연일수가 0보다 큰 블록-공정마다 사유 하나 (블록 ID로 고정 배정)
function makeReasons() {
  const blocks = readCsv('blocks.csv');
  const rows = [];
  for (const b of blocks) {
    const { delay_days } = blockStatus(b, TODAY);
    if (delay_days <= 0) continue;
    const rand = rng([...`${b.block_id}|${b.process}`].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7));
    rows.push({
      block_id: b.block_id,
      process: b.process,
      reason: REASONS[Math.floor(rand() * REASONS.length)],
      delay_days: String(delay_days),
    });
  }
  writeCsv('delay_reasons.csv', ['block_id', 'process', 'reason', 'delay_days'], rows);
}

makeFailures();
makeReasons();
