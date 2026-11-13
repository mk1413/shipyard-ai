'use strict';

// Stop 훅: 응답을 끝내기 전에 npm test를 돌린다.
// - 통과하면 그대로 끝낸다 (exit 0).
// - 실패하면 끝내기를 막고(exit 2) 실패한 테스트 줄을 Claude에게 돌려준다.
// - 훅이 이미 한 번 막은 뒤(stop_hook_active)에는 막지 않고 경고만 한다. 무한 반복을 피하기 위해서다.
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');

let input = '';
process.stdin.on('data', (chunk) => {
  input += chunk;
});
process.stdin.on('end', () => {
  let retrying = false;
  try {
    retrying = JSON.parse(input || '{}').stop_hook_active === true;
  } catch {
    retrying = false;
  }

  const r = spawnSync('npm test', { shell: true, cwd: ROOT, encoding: 'utf8' });
  if (r.status === 0) {
    process.exit(0);
  }

  const out = `${r.stdout || ''}${r.stderr || ''}`;
  const failing = [...new Set(out.split('\n').filter((line) => line.startsWith('✖ ')))].slice(0, 10);
  const summary = `npm test 실패. 실패한 항목 ${failing.length}개 (최대 10개 표시):\n${failing.join('\n')}`;

  if (retrying) {
    process.stderr.write(`${summary}\n경고: 훅이 이미 한 번 막았으므로 이번에는 끝냅니다.\n`);
    process.exit(0);
  }
  process.stderr.write(`${summary}\n테스트를 고친 뒤 다시 끝내세요.\n`);
  process.exit(2);
});
