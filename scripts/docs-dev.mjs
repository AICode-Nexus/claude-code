import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const docsConfig = fileURLToPath(new URL('../docs.json', import.meta.url));
const args = process.argv.slice(2);

if (!existsSync(docsConfig)) {
  console.error('Missing docs.json in repository root. Mintlify preview cannot start.');
  process.exit(1);
}

const child = spawn('npm', ['exec', '--yes', 'mintlify', 'dev', '--', ...args], {
  cwd: repoRoot,
  stdio: 'inherit',
  env: process.env,
});

child.on('error', error => {
  console.error('Failed to launch Mintlify preview via npm exec.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

child.on('exit', code => {
  process.exit(code ?? 1);
});
