import { build } from 'esbuild';
import { builtinModules } from 'node:module';
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

// Netlify's modern runtime traces external modules from its generated entry.
// Bundle workspace dependencies first so Windows pnpm links never reach Lambda.
const result = await build({
  entryPoints: ['netlify/functions/organization.ts'],
  outfile: 'dist/netlify/functions/organization.mjs',
  platform: 'node', target: 'node22', format: 'esm', bundle: true, metafile: true,
  banner: { js: 'import { createRequire as createNodeRequire } from "node:module"; const require = createNodeRequire(import.meta.url);' },
  logLevel: 'warning',
});
const builtins = new Set(builtinModules.flatMap(name => [name, `node:${name}`]));
for (const output of Object.values(result.metafile.outputs)) {
  for (const dependency of output.imports) {
    if (dependency.external && !builtins.has(dependency.path)) throw new Error(`Unbundled server dependency: ${dependency.path}`);
  }
}
const isolated = await mkdtemp(join(tmpdir(), 'null-organization-build-'));
try {
  const entry = join(isolated, 'organization.mjs');
  await copyFile('dist/netlify/functions/organization.mjs', entry);
  const check = spawnSync(process.execPath, ['--input-type=module', '-e', 'const m = await import(process.argv[1]); if (typeof m.default !== "function") throw new Error("Missing organization handler");', pathToFileURL(entry).href], { cwd: isolated, stdio: 'inherit' });
  if (check.error || check.status !== 0) throw new Error('Packaged organization function could not load independently.');
} finally {
  if (dirname(resolve(isolated)) !== resolve(tmpdir())) throw new Error('Unexpected temporary build directory.');
  await rm(isolated, { recursive: true, force: true });
}
console.log('Built self-contained organization function; isolated import passed and only Node built-ins remain external.');
