import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';
import { rootPath, readRootEnv, updateRootEnv } from './env.mjs';

const requireContracts = createRequire(resolve(rootPath, 'packages/contracts/package.json'));
const { generatePrivateKey, privateKeyToAccount } = await import(pathToFileURL(requireContracts.resolve('viem/accounts')).href);
const defaults = parseEnv(readFileSync(resolve(rootPath, '.env.example'), 'utf8'));
const existing = readRootEnv();
const migrated = {};
const legacyPaths = ['.env.sepolia', 'apps/web/.env.local', 'services/relayer/.env', 'services/organization/.env'];
const presentLegacyPaths = [];
for (const path of legacyPaths) {
  const absolutePath = resolve(rootPath, path);
  if (!existsSync(absolutePath)) continue;
  presentLegacyPaths.push(path);
  const values = parseEnv(readFileSync(absolutePath, 'utf8'));
  if (path === 'services/relayer/.env' && values.NULL_MANIFEST_PATH && !isAbsolute(values.NULL_MANIFEST_PATH))
    values.NULL_MANIFEST_PATH = relative(rootPath, resolve(dirname(absolutePath), values.NULL_MANIFEST_PATH)).replaceAll('\\', '/');
  for (const [name, value] of Object.entries(values)) {
    if (!value) continue;
    if ((migrated[name] && migrated[name] !== value) || (existing[name] && existing[name] !== value))
      throw new Error(`Conflicting nonempty ${name} configuration; legacy files were preserved.`);
    migrated[name] = value;
  }
}
const values = { ...defaults, ...migrated, ...Object.fromEntries(Object.entries(existing).filter(([, value]) => value !== '')) };
if (!values.NULL_DEPLOYER_PRIVATE_KEY) values.NULL_DEPLOYER_PRIVATE_KEY = generatePrivateKey();
if (values.NULL_CHAIN_ID !== '11155111') throw new Error('Existing configuration is not Sepolia; it was preserved.');
const account = privateKeyToAccount(values.NULL_DEPLOYER_PRIVATE_KEY);
updateRootEnv(values);
const saved = readRootEnv();
if (Object.entries(values).some(([name, value]) => saved[name] !== value)) throw new Error('Root environment verification failed.');
if (privateKeyToAccount(saved.NULL_DEPLOYER_PRIVATE_KEY).address !== account.address) throw new Error('Wallet preservation check failed.');
const consolidate = process.argv.includes('--consolidate');
if (consolidate) for (const path of presentLegacyPaths) unlinkSync(resolve(rootPath, path));
process.stdout.write(JSON.stringify({
  chain: 'Ethereum Sepolia', chainId: 11155111, deployer: account.address,
  privateKeyFile: '.env (Git-ignored, current-user access)',
  wallet: 'Existing wallet reused on subsequent runs; private key is never printed.',
  configuration: 'One root .env for deployment, browser public values, and local services.',
  ...(consolidate ? { legacyFilesRemovedAfterVerification: presentLegacyPaths } : { legacyFilesPreserved: presentLegacyPaths }),
  next: 'pnpm deploy:plan',
}, null, 2) + '\n');
