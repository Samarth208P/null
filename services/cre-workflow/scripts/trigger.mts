import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parsePublicBundle, FIELD_MODULUS } from '@null-protocol/sdk';
const { readRootEnv, rootPath } = await import(new URL('../../../contracts/scripts/env.mjs', import.meta.url).href) as {
  readRootEnv: () => Record<string, string>; rootPath: string;
};

// Protocol: official triggering-deployed-workflows guide and cre-http-trigger source.
// ACCEPTED is asynchronous admission. No completed-result API is assumed here.
const gateway = 'https://01.enterprise-gateway.zone-a.cre.chain.link/';
const artifactDirectory = resolve(rootPath, '.artifacts/cre');
class TriggerError extends Error {}
function requireCondition(value: unknown, message: string): asserts value {
  if (!value) throw new TriggerError(message);
}
function exactObject(value: unknown, keys: string[]): asserts value is Record<string, unknown> {
  requireCondition(value && typeof value === 'object' && !Array.isArray(value), 'Invalid JSON object.');
  requireCondition(Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key)), 'Unexpected or missing JSON fields.');
}
function readJson(path: string, maximum: number): unknown {
  requireCondition(statSync(path).isFile() && statSync(path).size <= maximum, 'Input file is missing or exceeds its size limit.');
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { throw new TriggerError('Input must be valid JSON.'); }
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical((value as Record<string, unknown>)[key])).join(',') + '}';
  return JSON.stringify(value);
}
function digest(value: string) { return '0x' + createHash('sha256').update(value, 'utf8').digest('hex'); }
function record(path: string, value: unknown, first = false) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { flag: first ? 'wx' : 'w', mode: 0o600 });
}
async function responseJson(response: Response) {
  requireCondition(response.body, 'Gateway response body is missing; execution outcome is unknown.');
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.length;
      requireCondition(length <= 32_768, 'Gateway response exceeds the expected size; execution outcome is unknown.');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown; }
  catch { throw new TriggerError('Gateway returned invalid JSON; execution outcome is unknown.'); }
}

try {
  const options = process.argv.slice(2);
  if (options.includes('--help')) {
    process.stdout.write('Usage: trigger:cre --input <public-trigger.json> [--execute | --result <completed-output.json>]\nDefault: local plan only. --execute sends a signed public trigger. --result validates the exact local workflow output without claiming remote execution or attestation.\n');
    process.exit(0);
  }
  let inputPath = ''; let resultPath = ''; let execute = false;
  for (let position = 0; position < options.length; position++) {
    const option = options[position];
    if (option === '--execute') { requireCondition(!execute, 'Duplicate --execute option.'); execute = true; }
    else if (option === '--input' || option === '--result') {
      const value = options[++position]; requireCondition(value && !value.startsWith('--'), `Missing path for ${option}.`);
      if (option === '--input') { requireCondition(!inputPath, 'Duplicate --input option.'); inputPath = resolve(rootPath, value); }
      else { requireCondition(!resultPath, 'Duplicate --result option.'); resultPath = resolve(rootPath, value); }
    } else throw new TriggerError('Use --input, optional --execute, or optional --result.');
  }
  requireCondition(inputPath, 'Provide --input with the exported public trigger JSON.');
  requireCondition(!(execute && resultPath), '--execute and --result are separate operations.');
  const input = readJson(inputPath, 2_048);
  exactObject(input, ['batchId', 'expectedCommitment', 'expectedEnvelopeRoot']);
  requireCondition(typeof input.batchId === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(input.batchId), 'Invalid public batch reference.');
  requireCondition(typeof input.expectedCommitment === 'string' && /^0x[0-9a-fA-F]{64}$/.test(input.expectedCommitment) && BigInt(input.expectedCommitment) < FIELD_MODULUS, 'Invalid expected distribution commitment.');
  requireCondition(typeof input.expectedEnvelopeRoot === 'string' && /^0x[0-9a-fA-F]{64}$/.test(input.expectedEnvelopeRoot), 'Invalid expected envelope root.');
  const values = readRootEnv();
  const deployment = readJson(resolve(rootPath, values.NULL_MANIFEST_PATH || 'deployments/11155111.json'), 1_000_000) as { status?: unknown; chainId?: unknown; contracts?: { nullPool?: unknown } };
  const pool = deployment.contracts?.nullPool;
  requireCondition(deployment.status === 'deployed' && deployment.chainId === 11155111 && typeof pool === 'string' && /^0x[0-9a-fA-F]{40}$/.test(pool) && BigInt(pool) !== 0n, 'A completed Sepolia deployment manifest is required.');
  requireCondition(values.NULL_CHAIN_ID === '11155111' && (!values.NULL_POOL_ADDRESS || values.NULL_POOL_ADDRESS.toLowerCase() === pool.toLowerCase()), 'Root configuration does not match the Sepolia manifest.');

  if (resultPath) {
    const result = readJson(resultPath, 100_000);
    exactObject(result, ['mode', 'publicBundle']);
    requireCondition(result.mode === 'cre-tee', 'Expected the exact cre-tee callback output.');
    exactObject(result.publicBundle, ['version', 'chainId', 'poolAddress', 'expiry', 'envelopes', 'commitment', 'envelopeRoot', 'transportTag']);
    requireCondition(Array.isArray(result.publicBundle.envelopes) && result.publicBundle.envelopes.length === 8, 'The public bundle must contain exactly eight envelopes.');
    for (const envelope of result.publicBundle.envelopes) exactObject(envelope, ['version', 'slot', 'transportTag', 'ephemeralPubKey', 'viewTag', 'ciphertext']);
    let bundle;
    try { bundle = parsePublicBundle(JSON.stringify(result.publicBundle)); }
    catch { throw new TriggerError('Returned public bundle failed SDK shape or envelope-root validation.'); }
    requireCondition(bundle.chainId === '11155111' && bundle.poolAddress.toLowerCase() === pool.toLowerCase() && bundle.commitment.toLowerCase() === input.expectedCommitment.toLowerCase() && bundle.envelopeRoot.toLowerCase() === input.expectedEnvelopeRoot.toLowerCase(), 'Returned public bundle does not match the reviewed roots, chain, or pool.');
    const outputPath = resolve(artifactDirectory, `verified-bundle-${input.batchId}-${randomUUID()}.json`);
    record(outputPath, bundle, true);
    process.stdout.write(JSON.stringify({ status: 'public-bundle-validated', outputPath, chainId: 11155111, pool,
      rootsMatch: true, remoteExecutionVerified: false, attestationVerified: false,
      note: 'Local shape and root checks do not prove this file came from a CRE execution.' }, null, 2) + '\n');
    process.exit(0);
  }

  const workflowId = (values.NULL_CRE_WORKFLOW_ID || '').replace(/^0x/, '');
  const missing = ['NULL_CRE_TRIGGER_PRIVATE_KEY', 'NULL_CRE_TRIGGER_ADDRESS', 'NULL_CRE_WORKFLOW_ID'].filter(name => !values[name]);
  if (workflowId) requireCondition(/^[0-9a-fA-F]{64}$/.test(workflowId) && !/^0+$/.test(workflowId), 'NULL_CRE_WORKFLOW_ID must be the deployed 64-character workflow ID.');
  const configurationPath = resolve(artifactDirectory, 'config.staging.json');
  process.stdout.write(JSON.stringify({ mode: execute ? 'execute-requested' : 'local-plan', gateway, chainId: 11155111, pool,
    inputFields: ['batchId', 'expectedCommitment', 'expectedEnvelopeRoot'], inputDigest: digest(canonical(input)),
    missing, workflowConfigPresent: existsSync(configurationPath),
    resultHandling: 'Gateway acceptance only. Completed public output requires separate local --result validation.' }, null, 2) + '\n');
  if (!execute) process.exit(0);
  requireCondition(!missing.length, `Missing ${missing.join(', ')}. No request was sent.`);
  const configuration = readJson(configurationPath, 16_384) as Record<string, unknown>;
  requireCondition(configuration.chainId === '11155111' && typeof configuration.poolAddress === 'string' && configuration.poolAddress.toLowerCase() === pool.toLowerCase() && typeof configuration.authorizedPublicKey === 'string' && configuration.authorizedPublicKey.toLowerCase() === values.NULL_CRE_TRIGGER_ADDRESS.toLowerCase(), 'Regenerate CRE configuration for this chain, pool, and trigger signer.');
  requireCondition(!Object.entries(values).some(([name, value]) => name !== 'NULL_CRE_TRIGGER_PRIVATE_KEY' && name.endsWith('PRIVATE_KEY') && value?.toLowerCase() === values.NULL_CRE_TRIGGER_PRIVATE_KEY.toLowerCase()), 'Use a dedicated CRE trigger signer.');
  const requireContracts = createRequire(resolve(rootPath, 'packages/contracts/package.json'));
  const { privateKeyToAccount } = await import(pathToFileURL(requireContracts.resolve('viem/accounts')).href);
  let account;
  try { account = privateKeyToAccount(values.NULL_CRE_TRIGGER_PRIVATE_KEY); }
  catch { throw new TriggerError('Invalid CRE trigger private key.'); }
  requireCondition(account.address.toLowerCase() === values.NULL_CRE_TRIGGER_ADDRESS.toLowerCase(), 'CRE trigger key and address do not match.');

  const requestId = randomUUID();
  const request = { jsonrpc: '2.0', id: requestId, method: 'workflows.execute', params: { input, workflow: { workflowID: workflowId } } };
  const body = canonical(request); const now = Math.floor(Date.now() / 1_000);
  const header = Buffer.from(JSON.stringify({ alg: 'ETH', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ digest: digest(body), iss: account.address, iat: now, exp: now + 60, jti: randomUUID() })).toString('base64url');
  const message = `${header}.${payload}`;
  const signature = Buffer.from((await account.signMessage({ message })).slice(2), 'hex');
  requireCondition(signature.length === 65, 'Unexpected trigger signature length.');
  if (signature[64]! >= 27) signature[64] = signature[64]! - 27;
  requireCondition(signature[64] === 0 || signature[64] === 1, 'Invalid trigger signature recovery ID.');
  const token = `${message}.${signature.toString('base64url')}`;
  const receiptPath = resolve(artifactDirectory, `trigger-${requestId}.json`);
  const journal = { requestId, workflowId, gateway, inputDigest: digest(canonical(input)), requestDigest: digest(body), status: 'prepared', executionId: '', submittedAt: new Date().toISOString() };
  record(receiptPath, journal, true);
  let response;
  try { response = await fetch(gateway, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30_000), headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body }); }
  catch { journal.status = 'unknown'; record(receiptPath, journal); throw new TriggerError(`Gateway outcome is unknown; no automatic retry. Review request ${requestId} and ${receiptPath} before sending again.`); }
  journal.status = 'unknown'; record(receiptPath, journal);
  const reply = await responseJson(response);
  requireCondition(response.ok, `Gateway HTTP ${response.status}; no completed result was established. Review ${receiptPath} before retrying.`);
  exactObject(reply, ['jsonrpc', 'id', 'method', 'result']);
  requireCondition(reply.jsonrpc === '2.0' && reply.id === requestId && reply.method === 'workflows.execute', 'Gateway response context does not match this request.');
  exactObject(reply.result, ['workflow_id', 'workflow_execution_id', 'status']);
  requireCondition(typeof reply.result.workflow_id === 'string' && reply.result.workflow_id.replace(/^0x/, '').toLowerCase() === workflowId.toLowerCase() && typeof reply.result.workflow_execution_id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(reply.result.workflow_execution_id) && reply.result.status === 'ACCEPTED', 'Gateway did not return a valid acceptance receipt for this workflow.');
  journal.status = 'accepted'; journal.executionId = reply.result.workflow_execution_id; record(receiptPath, journal);
  process.stdout.write(JSON.stringify({ status: 'accepted', executionId: journal.executionId, receiptPath,
    completed: false, publicBundleReceived: false, attestationVerified: false,
    next: 'Track the execution in CRE. The accepted trigger is not a completed confidential compilation.' }, null, 2) + '\n');
} catch (error) {
  process.stderr.write((error instanceof TriggerError ? error.message : 'CRE trigger or result verification failed; inspect configuration and local input without exposing secrets.') + '\n');
  process.exitCode = 1;
}
