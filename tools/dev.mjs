import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { rootPath, envPath, readRootEnv } from '../contracts/scripts/env.mjs';

const env = readRootEnv();
if (!env.VITE_POOL_ADDRESS || !env.RELAYER_PRIVATE_KEY) throw new Error('Complete the Sepolia deployment and local relayer setup first.');
const webRoot = resolve(rootPath, 'apps/web');
const requireWeb = createRequire(resolve(webRoot, 'package.json'));
const vite = resolve(dirname(requireWeb.resolve('vite/package.json')), 'bin/vite.js');
const children = [
  spawn(process.execPath, [vite, '--host', '127.0.0.1'], { cwd: webRoot, stdio: 'inherit', windowsHide: true }),
  spawn(process.execPath, [`--env-file=${envPath}`, '--import', 'tsx', 'services/relayer/src/server.ts'],
    { cwd: rootPath, stdio: 'inherit', windowsHide: true }),
];
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM');
}
for (const child of children) {
  child.on('error', error => { process.stderr.write(`Local service could not start: ${error.message}\n`); stop(1); });
  child.on('exit', code => { if (!stopping) stop(code ?? 1); });
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
