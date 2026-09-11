import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, copyFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const packageDirectory = resolve(root, 'dist/npm/payouts');
const consumer = await mkdtemp(resolve(tmpdir(), 'null-npm-consumer-'));
const npmCli = [
  resolve(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
  resolve(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js'),
].find(existsSync);
if (!npmCli) throw new Error('Cannot locate npm CLI beside Node.js. Run with a standard Node.js installation.');
function npm(args, capture = false) {
  return execFileSync(process.execPath, [npmCli, ...args], { cwd: consumer, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit' });
}
console.log(`Testing outside the workspace: ${consumer}`);
const [packed] = JSON.parse(npm(['pack', packageDirectory, '--pack-destination', consumer, '--json', '--ignore-scripts'], true));
assert.ok(packed.files.length > 0);
for (const file of packed.files) assert.match(file.path, /^(package\.json|README\.md|INTEGRATION\.md|LICENSE|dist\/[a-z-]+\/src\/[a-z-]+\.(js|d\.ts))$/);
const manifest = JSON.parse(await readFile(resolve(packageDirectory, 'package.json'), 'utf8'));
const fromRegistry = process.argv.includes('--registry');
if (fromRegistry) {
  const integrity = JSON.parse(npm(['view', `${manifest.name}@${manifest.version}`, 'dist.integrity', '--json', '--registry=https://registry.npmjs.org'], true));
  assert.equal(integrity, packed.integrity, 'Registry package must match the verified local tarball');
}
assert.equal(manifest.license, 'MIT');
assert.ok(packed.files.some(file => file.path === 'LICENSE'));
assert.ok(!JSON.stringify(manifest.dependencies).includes('workspace:'));
assert.ok(Object.keys(manifest.dependencies).every(name => !name.startsWith('@null-protocol/')));
await writeFile(resolve(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
const webPackage = JSON.parse(await readFile(resolve(root, 'apps/web/package.json'), 'utf8'));
npm(['install', '--ignore-scripts', '--no-audit', '--no-fund', '--registry=https://registry.npmjs.org', fromRegistry ? `${manifest.name}@${manifest.version}` : resolve(consumer, packed.filename), `typescript@${webPackage.devDependencies.typescript}`, `vite@${webPackage.devDependencies.vite}`]);
for (const [source, destination] of [['consumer-smoke.mjs', 'smoke.mjs'], ['consumer-types.ts', 'main.ts']]) {
  await copyFile(resolve(root, 'tools/npm', source), resolve(consumer, destination));
}
execFileSync(process.execPath, ['smoke.mjs'], { cwd: consumer, stdio: 'inherit' });
await writeFile(resolve(consumer, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
  target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, noEmit: true, skipLibCheck: true,
  lib: ['ES2022', 'DOM', 'DOM.Iterable'],
}, include: ['main.ts'] }));
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--project', 'tsconfig.json'], { cwd: consumer, stdio: 'inherit' });
await writeFile(resolve(consumer, 'index.html'), '<!doctype html><html><body><script type="module" src="/browser.ts"></script></body></html>');
await writeFile(resolve(consumer, 'browser.ts'), `import { api, prepare } from './main';\nObject.assign(globalThis, { nullPayouts: { api, prepare } });\n`);
await writeFile(resolve(consumer, 'vite.config.mjs'), `export default { worker: { format: 'es' }, build: { target: 'es2022' } };\n`);
execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], { cwd: consumer, stdio: 'inherit' });
const assets = await readdir(resolve(consumer, 'dist/assets'));
assert.ok(assets.some(name => /^worker-.*\.js$/.test(name)), 'Browser build must include the proof worker');
assert.ok(assets.some(name => name.endsWith('.wasm')), 'Browser build must include proving WASM');
console.log(`npm consumer verification passed (${packed.files.length} packed files). Consumer retained for inspection: ${consumer}`);
