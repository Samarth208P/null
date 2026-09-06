import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const directory = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = key => { const index = args.indexOf(key); return index < 0 ? undefined : args[index + 1]; };
const manifestPath = resolve(arg('--manifest') ?? resolve(directory, '../deployments/sepolia.json'));
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const pool = manifest.contracts?.nullPool;
const start = manifest.deploymentBlock;
if (manifest.status !== 'deployed' || manifest.chainId !== 11155111 || !/^0x[0-9a-fA-F]{40}$/.test(pool ?? '') || BigInt(pool) === 0n || !Number.isSafeInteger(start) || start < 0) throw new Error('NULL_GRAPH_DEPLOYMENT_REQUIRED');
let yaml = await readFile(resolve(directory, 'subgraph.template.yaml'), 'utf8');
const announcer = arg('--announcer');
if (announcer) {
  const announcerStart = arg('--announcer-start');
  if (!/^0x[0-9a-fA-F]{40}$/.test(announcer) || !/^[0-9]+$/.test(announcerStart ?? '')) throw new Error('NULL_ANNOUNCER_CONFIG_INVALID');
  yaml += await readFile(resolve(directory, 'erc5564.template.yaml'), 'utf8');
  yaml = yaml.replaceAll('{{ERC5564_ANNOUNCER}}', announcer).replaceAll('{{ERC5564_START_BLOCK}}', announcerStart);
}
yaml = yaml.replaceAll('{{NULL_POOL}}', pool).replaceAll('{{START_BLOCK}}', String(start)).replaceAll('{{CHAIN_ID}}', String(manifest.chainId));
await writeFile(resolve(directory, 'subgraph.yaml'), yaml);
process.stdout.write('Subgraph manifest generated from deployed chain context.\n');
