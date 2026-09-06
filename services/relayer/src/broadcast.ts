import { readFile } from 'node:fs/promises';
import type { Hex } from 'viem';
import { createRelayer, exportSelfBroadcast, type RelayManifest } from './relay.js';

const args = process.argv.slice(2);
const argument = (name: string) => { const position = args.indexOf(name); return position < 0 ? undefined : args[position + 1]; };
try {
  const path = argument('--proof');
  if (!path) throw new Error('Usage: pnpm --filter @null-protocol/relayer broadcast --proof claim.json [--send]');
  const payload: unknown = JSON.parse(await readFile(path, 'utf8'));
  if (!args.includes('--send')) {
    process.stdout.write(JSON.stringify(exportSelfBroadcast(payload), null, 2) + '\n');
  } else {
    const manifestPath = process.env.NULL_MANIFEST_PATH;
    const rpcUrl = argument('--rpc') ?? process.env.RELAYER_RPC_URL;
    const privateKey = process.env.BROADCAST_PRIVATE_KEY;
    if (!manifestPath || !rpcUrl || !privateKey) throw new Error('NULL_BROADCAST_CONFIG_REQUIRED');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as RelayManifest;
    const relayer = createRelayer({ manifest, rpcUrl, privateKey: privateKey as Hex });
    process.stdout.write(JSON.stringify(await relayer.relay(payload)) + '\n');
  }
} catch (error) { process.stderr.write((error instanceof Error && error.message.startsWith('NULL_') ? error.message : 'NULL_BROADCAST_FAILED') + '\n'); process.exitCode = 1; }
