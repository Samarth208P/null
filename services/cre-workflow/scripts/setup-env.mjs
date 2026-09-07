import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readRootEnv, rootPath, updateRootEnv } from '../../../contracts/scripts/env.mjs';

const requireContracts = createRequire(resolve(rootPath, 'packages/contracts/package.json'));
const { generatePrivateKey, privateKeyToAccount } = await import(pathToFileURL(requireContracts.resolve('viem/accounts')).href);

function triggerAddress(values) {
  const key = values.NULL_CRE_TRIGGER_PRIVATE_KEY;
  if (!key) return values.NULL_CRE_TRIGGER_ADDRESS || '';
  let address;
  try { address = privateKeyToAccount(key).address; }
  catch { throw new Error('NULL_CRE_TRIGGER_PRIVATE_KEY must be a valid dedicated EVM private key.'); }
  if (values.NULL_CRE_TRIGGER_ADDRESS && address.toLowerCase() !== values.NULL_CRE_TRIGGER_ADDRESS.toLowerCase())
    throw new Error('The CRE trigger address does not match its private key; existing values were preserved.');
  if (Object.entries(values).some(([name, value]) => name !== 'NULL_CRE_TRIGGER_PRIVATE_KEY' && name.endsWith('PRIVATE_KEY') && value?.toLowerCase() === key.toLowerCase()))
    throw new Error('Use a dedicated CRE trigger key, separate from transaction and treasury wallets.');
  return address;
}

try {
  const options = process.argv.slice(2);
  if (options.some(option => option !== '--init-credentials')) throw new Error('Usage: setup:env [--init-credentials]');
  let values = readRootEnv();
  if (options.includes('--init-credentials')) {
    if (values.NULL_CRE_TRIGGER_ADDRESS && !values.NULL_CRE_TRIGGER_PRIVATE_KEY)
      throw new Error('A trigger address is already configured without its key; existing values were preserved.');
    const next = { ...values, NULL_CRE_TRIGGER_PRIVATE_KEY: values.NULL_CRE_TRIGGER_PRIVATE_KEY || generatePrivateKey() };
    const address = triggerAddress(next);
    updateRootEnv({
      NULL_CRE_TRIGGER_PRIVATE_KEY: next.NULL_CRE_TRIGGER_PRIVATE_KEY,
      NULL_CRE_TRIGGER_ADDRESS: address,
      NULL_PAYROLL_API_TOKEN: values.NULL_PAYROLL_API_TOKEN || randomBytes(32).toString('base64url'),
      NULL_PAYROLL_BASE_URL: values.NULL_PAYROLL_BASE_URL || '',
      NULL_CRE_WORKFLOW_ID: values.NULL_CRE_WORKFLOW_ID || '',
    });
    values = readRootEnv();
  }

  const manifest = JSON.parse(readFileSync(resolve(rootPath, values.NULL_MANIFEST_PATH || 'deployments/11155111.json'), 'utf8'));
  if (manifest.status !== 'deployed' || manifest.chainId !== 11155111 || values.NULL_CHAIN_ID !== '11155111')
    throw new Error('A completed Ethereum Sepolia deployment and matching root environment are required.');
  const poolAddress = manifest.contracts?.nullPool;
  if (!/^0x[0-9a-fA-F]{40}$/.test(poolAddress || '') || BigInt(poolAddress) === 0n ||
      (values.NULL_POOL_ADDRESS && values.NULL_POOL_ADDRESS.toLowerCase() !== poolAddress.toLowerCase()))
    throw new Error('Root pool configuration does not match the completed deployment manifest.');

  const address = triggerAddress(values);
  if (address && (!/^0x[0-9a-fA-F]{40}$/.test(address) || BigInt(address) === 0n))
    throw new Error('NULL_CRE_TRIGGER_ADDRESS must be a nonzero EVM address, not a raw public key.');
  let payrollBaseUrl = '';
  if (values.NULL_PAYROLL_BASE_URL) {
    let url;
    try { url = new URL(values.NULL_PAYROLL_BASE_URL); }
    catch { throw new Error('NULL_PAYROLL_BASE_URL must be a valid public HTTPS batches endpoint.'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.hostname.endsWith('.invalid'))
      throw new Error('NULL_PAYROLL_BASE_URL must use HTTPS without embedded credentials, query strings or fragments.');
    payrollBaseUrl = url.href.replace(/\/$/, '');
  }
  const missing = [
    ...(!address ? ['NULL_CRE_TRIGGER_PRIVATE_KEY or NULL_CRE_TRIGGER_ADDRESS'] : []),
    ...(!payrollBaseUrl ? ['NULL_PAYROLL_BASE_URL'] : []),
    ...(!values.NULL_PAYROLL_API_TOKEN ? ['NULL_PAYROLL_API_TOKEN'] : []),
  ];
  if (missing.length) {
    process.stdout.write(JSON.stringify({ ready: false, missing, credentials: 'Root .env only; secret values are never printed.',
      next: !address || !values.NULL_PAYROLL_API_TOKEN ? 'Initialize dedicated local credentials with --init-credentials, then supply an authorized HTTPS payroll API. No config was generated.' : 'Set NULL_PAYROLL_BASE_URL to an authorized HTTPS payroll API, then rerun setup:env. No config was generated.' }, null, 2) + '\n');
    process.exitCode = 2;
  } else {
    const directory = resolve(rootPath, '.artifacts/cre');
    mkdirSync(directory, { recursive: true });
    writeFileSync(resolve(directory, 'config.staging.json'), JSON.stringify({ chainId: '11155111', poolAddress,
      payrollBaseUrl, payrollSecretId: 'NULL_PAYROLL_API_TOKEN', authorizedPublicKey: address }, null, 2) + '\n');
    process.stdout.write(JSON.stringify({ ready: true, config: '.artifacts/cre/config.staging.json',
      registry: 'private', triggerAddress: address, gasRequiredForTriggerKey: false,
      note: 'Local configuration is ready. Deploy access, separate confidential access, secret upload, and a completed remote execution are still required.' }, null, 2) + '\n');
  }
} catch (error) {
  process.stderr.write((error instanceof Error ? error.message : 'CRE setup failed.') + '\n');
  process.exitCode = 1;
}
