import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readRootEnv, rootPath } from '../contracts/scripts/env.mjs';

const directory = dirname(fileURLToPath(import.meta.url));
const node = 'https://api.studio.thegraph.com/deploy/';
const options = process.argv.slice(2);
if (options.some(value => !['--deploy', '--help', '--substreams'].includes(value))) throw new Error('Use graph:deploy [--deploy] [--substreams].');
const substreams = options.includes('--substreams');
if (substreams && options.includes('--deploy')) throw new Error('Graph Studio no longer supports Substreams-powered subgraphs (verified 2026-09-07). Use the standalone provider path in substreams/private-payments/README.md.');
if (options.includes('--help')) {
  process.stdout.write('graph:deploy prints a local Studio deployment plan. Add --deploy only after configuring GRAPH_STUDIO_SLUG, GRAPH_STUDIO_DEPLOY_KEY and GRAPH_VERSION_LABEL in root .env.\n');
  process.exit(0);
}

const saved = readRootEnv();
const environment = name => (process.env[name] ?? saved[name] ?? '').trim();
const manifestPath = resolve(rootPath, environment('NULL_MANIFEST_PATH') || 'deployments/11155111.json');
const deployment = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (deployment.status !== 'deployed' || deployment.chainId !== 11155111 ||
  !/^0x[0-9a-fA-F]{40}$/.test(deployment.contracts?.nullPool ?? '') ||
  !Number.isSafeInteger(deployment.deploymentBlock) || deployment.deploymentBlock < 0)
  throw new Error('A confirmed Sepolia deployment manifest is required.');

const names = ['GRAPH_STUDIO_SLUG', 'GRAPH_STUDIO_DEPLOY_KEY', 'GRAPH_VERSION_LABEL'];
const missing = names.filter(name => !environment(name));
const slug = environment('GRAPH_STUDIO_SLUG');
const key = environment('GRAPH_STUDIO_DEPLOY_KEY');
const version = substreams ? 'v0.2.0-sps' : environment('GRAPH_VERSION_LABEL');
if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('GRAPH_STUDIO_SLUG must be the existing Studio project slug.');
if (key && (!/^[\x21-\x7e]+$/.test(key) || key.length > 4_096 || key.startsWith('-'))) throw new Error('GRAPH_STUDIO_DEPLOY_KEY must be a valid opaque token without whitespace or control characters.');
if (version && !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(version)) throw new Error('GRAPH_VERSION_LABEL must be a simple label such as v0.1.0.');
process.stdout.write(JSON.stringify({
  mode: options.includes('--deploy') ? 'studio-deployment' : 'local-plan',
  node, chainId: deployment.chainId, pool: deployment.contracts.nullPool, startBlock: deployment.deploymentBlock,
  projectConfigured: Boolean(slug), deployKeyConfigured: Boolean(key), versionConfigured: Boolean(version),
  missing, publication: 'Studio development version only; no decentralized-network publishing or billing setup.',
}, null, 2) + '\n');
if (!options.includes('--deploy')) process.exit(0);
if (missing.length) throw new Error(`Configure ${missing.join(', ')} in the single root .env. Nothing was deployed.`);

// Refresh the manifest and types from the actual chain record before uploading.
if (!substreams) execFileSync(process.execPath, [resolve(directory, 'configure.mjs'), '--manifest', manifestPath], { cwd: directory, stdio: 'inherit' });
const requireSubgraph = createRequire(resolve(directory, 'package.json'));
const cliRoot = dirname(requireSubgraph.resolve('@graphprotocol/graph-cli/package.json'));
if (!substreams) execFileSync(process.execPath, [resolve(cliRoot, 'bin/run.js'), 'codegen', 'subgraph.yaml'], { cwd: directory, stdio: 'inherit' });

// Invoke the pinned CLI in this process so the deploy key never appears in an OS
// command line or a persistent Graph CLI credential file. Only public build files upload.
delete process.env.DEBUG;
const { run } = await import(pathToFileURL(resolve(cliRoot, 'dist/index.js')).href);
process.chdir(directory);
try {
  await run(['deploy', slug, substreams ? 'subgraph.sps.yaml' : 'subgraph.yaml', '--node', node, '--version-label', version, '--deploy-key', key], { root: cliRoot });
} catch {
  process.stderr.write('Graph Studio deployment failed. Check the project, version label, and deploy key locally; no secret was printed.\n');
  process.exitCode = 1;
}
