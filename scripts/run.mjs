import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const [tool, ...args] = process.argv.slice(2);
const entries = { next: 'next/dist/bin/next', tsc: 'typescript/bin/tsc', tsx: 'tsx/cli' };
let runtime = process.execPath;
if (Number(process.versions.node.split('.')[0]) < 22) {
  runtime = ['/opt/homebrew/bin/node', '/usr/local/bin/node'].find(candidate => {
    if (!existsSync(candidate)) return false;
    try { return Number(execFileSync(candidate, ['--version'], { encoding: 'utf8' }).trim().slice(1).split('.')[0]) >= 22; } catch { return false; }
  });
}
if (!runtime || (!entries[tool] && tool !== 'test')) {
  console.error('Signage TV cần Node.js 22+. Chạy nvm install 22 && nvm use 22 rồi thử lại.');
  process.exit(1);
}
const child = spawn(runtime, tool === 'test' ? ['--import', 'tsx', '--test', ...args] : [(tool === 'tsc' ? join(dirname(require.resolve('typescript/package.json')), 'bin/tsc') : require.resolve(entries[tool])), ...args], { stdio: 'inherit', env: { ...process.env, PATH: dirname(runtime) + (process.platform === 'win32' ? ';' : ':') + process.env.PATH } });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', error => { console.error(error.message); process.exit(1); });
child.on('exit', code => process.exit(code ?? 1));
