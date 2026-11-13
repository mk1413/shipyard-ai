// 수용 기준 AC-14: generate_data.py를 두 번 실행하면 CSV 내용이 같다.
// 실제 data/ 폴더는 건드리지 않도록 임시 폴더에서 실행한다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..', '..');
const FILES = ['daily_production.csv', 'equipment.csv', 'blocks.csv'];

function hashOf(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function runOnce(dir) {
  fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'generate_data.py'), path.join(dir, 'generate_data.py'));
  execFileSync('python', ['generate_data.py'], { cwd: dir, stdio: 'pipe' });
  return Object.fromEntries(FILES.map((f) => [f, hashOf(path.join(dir, 'data', f))]));
}

test('AC-14: generate_data.py를 두 번 실행하면 CSV 해시가 같다', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'kpi-acc-gen-'));
  const first = runOnce(path.join(base, 'run1'));
  const second = runOnce(path.join(base, 'run2'));
  assert.deepEqual(second, first);
  fs.rmSync(base, { recursive: true, force: true });
});
