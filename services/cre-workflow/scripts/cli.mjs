import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { envPath, loadRootEnv } from '../../../contracts/scripts/env.mjs';

const directory = fileURLToPath(new URL('../', import.meta.url));
const mode = process.argv[2];
if (process.argv.length !== 3 || !['status', 'build'].includes(mode)) {
  process.stderr.write('Usage: cli.mjs status|build\n');
  process.exit(1);
}
loadRootEnv();
const commands = mode === 'status' ? [['version'], ['whoami'], ['registry', 'list']] : [
  ['workflow', 'build', '.', '--project-root', directory, '--env', envPath,
    '--target', 'staging-settings', '--output', 'build/compiler.wasm', '--non-interactive'],
];
let failed = false;
for (const args of commands) {
  const result = spawnSync('cre', args, { cwd: directory, env: process.env, stdio: 'inherit', windowsHide: true });
  if (result.error) {
    process.stderr.write('CRE CLI could not start. Install the official CRE CLI and ensure it is on PATH.\n');
    failed = true;
    break;
  }
  if (result.status !== 0) failed = true;
}
process.exitCode = failed ? 1 : 0;
