import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compilePayroll, parsePayroll } from '../../services/cre-workflow/src/compiler.ts';
import { bigintToBytes, profileFromKeys, sha256, toHex, utf8 } from '../../packages/crypto/src/index.ts';
import { parsePublicBundle } from '../../packages/sdk/src/index.ts';

// Host-side simulation helper only. This file is never compiled into the workflow.
const projectDir = fileURLToPath(new URL('../', import.meta.url));
const repositoryDir = resolve(projectDir, '..');
let artifactsDir = resolve(projectDir, '.artifacts');
const port = 8791;
let batchId = 'null-cre-synthetic-payroll-v1';
const workflowLog = 'NULL payroll simulation: validated batch and compiled 8 encrypted envelopes.';
const maximumOutputBytes = 2 * 1024 * 1024;
let receiptPath = resolve(artifactsDir, 'simulation-receipt.json');
let runStartedAt: string | undefined;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

async function writeImmutablePublicJson(name: string, value: unknown): Promise<string> {
  const path = resolve(artifactsDir, name);
  const encoded = `${JSON.stringify(value, null, 2)}\n`;
  try { await writeFile(path, encoded, { flag: 'wx' }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST' || await readFile(path, 'utf8') !== encoded) {
      throw new Error('Existing simulation fixture differs; preserve it and choose a new fixture version.');
    }
  }
  return path;
}

function publicProfile(spend: bigint, view: bigint): string {
  // These small, publicly documented scalars are synthetic fixtures, never wallet credentials.
  const spendPrivateKey = bigintToBytes(spend);
  const viewPrivateKey = bigintToBytes(view);
  try { return profileFromKeys({ spendPrivateKey, viewPrivateKey }).stealthMetaAddress; }
  finally { spendPrivateKey.fill(0); viewPrivateKey.fill(0); }
}

function simulationResult(output: string): Record<string, unknown> {
  const marker = 'Workflow Simulation Result:';
  const start = output.indexOf(marker);
  if (start < 0) throw new Error('CRE returned no documented Workflow Simulation Result section.');
  const remainder = output.slice(start + marker.length).trimStart();
  if (remainder[0] !== '{') throw new Error('CRE result format requires inspection before validation.');
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < remainder.length; index++) {
    const character = remainder[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === '{' || character === '[') depth++;
    else if (character === '}' || character === ']') {
      depth--;
      if (depth === 0) return JSON.parse(remainder.slice(0, index + 1)) as Record<string, unknown>;
    }
  }
  throw new Error('CRE returned an incomplete simulation result.');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter(argument => argument !== '--');
  const inputFile = args[0] === '--input' && args.length === 2 ? resolve(args[1]) : undefined;
  if (!inputFile && args.length && !(args.length === 1 && args[0] === '--prepare')) throw new Error('Use --prepare or --input PATH_TO_PRIVATE_INPUT.json');
  let importedBatch;
  if (inputFile) {
    if ((await stat(inputFile)).size > 65_536) throw new Error('Private input exceeds 64 KB.');
    try { importedBatch = parsePayroll(JSON.parse(await readFile(inputFile, 'utf8'))); }
    catch { throw new Error('The private input is not a valid payroll export.'); }
    batchId = importedBatch.batchId;
    artifactsDir = resolve(projectDir, '.artifacts', `payment-${batchId}`);
    receiptPath = resolve(artifactsDir, 'simulation-receipt.json');
  }
  if (!process.argv.includes('--prepare')) {
    await mkdir(artifactsDir, { recursive: true });
    runStartedAt = new Date().toISOString();
    await writeFile(receiptPath, `${JSON.stringify({ verified: false, status: 'running', startedAt: runStartedAt }, null, 2)}\n`);
  }
  const manifest = JSON.parse(await readFile(resolve(repositoryDir, 'deployments/11155111.json'), 'utf8'));
  if (manifest.status !== 'deployed' || manifest.chainId !== 11155111 || !/^0x[0-9a-fA-F]{40}$/.test(manifest.contracts?.nullPool)) {
    throw new Error('The public Sepolia deployment manifest is missing its deployed pool.');
  }
  const context = { chainId: String(manifest.chainId), poolAddress: manifest.contracts.nullPool as `0x${string}` };
  const batch = importedBatch ?? parsePayroll({
    batchId,
    batchEntropyHex: toHex(sha256(utf8('NULL CRE SYNTHETIC FIXTURE ONLY - NEVER FUND OR REUSE'))),
    recipients: [
      { employeeRef: 'SYNTHETIC-ALICE', amountAtomic: '1250000', stealthMetaAddress: publicProfile(1n, 2n) },
      { employeeRef: 'SYNTHETIC-BOB', amountAtomic: '2500000', stealthMetaAddress: publicProfile(3n, 4n) },
    ],
  });
  const expected = await compilePayroll(batch, context);
  await mkdir(artifactsDir, { recursive: true });
  const inputPath = await writeImmutablePublicJson('http-payload.json', {
    batchId, expectedCommitment: expected.commitment, expectedEnvelopeRoot: expected.envelopeRoot,
  });
  await writeImmutablePublicJson('expected-public-result.json', { mode: 'cre-tee-simulation', publicBundle: expected });
  if (process.argv.includes('--prepare')) {
    console.log(JSON.stringify({ prepared: true, syntheticOnly: true, batchId, ...context, commitment: expected.commitment, envelopeRoot: expected.envelopeRoot, envelopes: expected.envelopes.length }));
    return;
  }

  // An ephemeral bearer token exists only in memory and the child process environment.
  const tokenBytes = randomBytes(32);
  const token = tokenBytes.toString('hex');
  const expectedAuthorization = createHash('sha256').update(`Bearer ${token}`).digest();
  const body = Buffer.from(JSON.stringify(batch));
  let authorizedFetches = 0;
  const server = createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Connection', 'close');
    if (request.headers.origin || request.method !== 'GET') { response.writeHead(403).end('{}'); return; }
    const authorization = request.headers.authorization ?? '';
    const candidate = createHash('sha256').update(authorization).digest();
    const authenticated = request.headersDistinct.authorization?.length === 1 && timingSafeEqual(candidate, expectedAuthorization);
    candidate.fill(0);
    if (!authenticated) { response.writeHead(401).end('{}'); return; }
    if (request.url !== `/batches/${batchId}` || request.headers['transfer-encoding'] || Number(request.headers['content-length'] ?? 0) !== 0) {
      response.writeHead(404).end('{}'); return;
    }
    authorizedFetches++;
    response.writeHead(200, { 'Content-Length': body.length }).end(body);
  });
  server.requestTimeout = 5_000;
  server.headersTimeout = 5_000;
  server.maxConnections = 8;
  try {
    await new Promise<void>((accept, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', () => { server.off('error', reject); accept(); });
    });
    const args = ['workflow', 'simulate', 'payroll', '--target', 'staging-settings', '--non-interactive', '--trigger-index', '0', '--http-payload', inputPath, '--env', resolve(repositoryDir, '.env')];
    console.log(`Running CRE simulation with an authenticated loopback ${inputFile ? 'exported payment' : 'synthetic payroll fixture'}.`);
    const captured = await new Promise<{ code: number | null; output: string }>((accept, reject) => {
      const child = spawn('cre', args, { cwd: projectDir, env: { ...process.env, NULL_CRE_SIMULATION_TOKEN: token, NO_COLOR: '1' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      const chunks: Buffer[] = [];
      let bytes = 0;
      let failure: Error | undefined;
      const timer = setTimeout(() => { failure = new Error('CRE simulation exceeded five minutes.'); child.kill(); }, 300_000);
      const append = (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > maximumOutputBytes) { failure = new Error('CRE simulation output exceeded the bounded capture limit.'); child.kill(); return; }
        chunks.push(Buffer.from(chunk));
      };
      child.stdout.on('data', append);
      child.stderr.on('data', append);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('close', code => {
        clearTimeout(timer);
        if (failure) { for (const chunk of chunks) chunk.fill(0); reject(failure); return; }
        const output = Buffer.concat(chunks).toString('utf8');
        for (const chunk of chunks) chunk.fill(0);
        accept({ code, output });
      });
    });
    const output = captured.output.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '');
    if (output.includes(token) || output.includes(batch.batchEntropyHex) || batch.recipients.some(recipient => output.includes(recipient.stealthMetaAddress)) || /batchEntropyHex|employeeRef|amountAtomic|stealthMetaAddress/.test(output)) {
      throw new Error('CRE output contained confidential-input markers; output was withheld and no log was saved.');
    }
    await writeFile(resolve(artifactsDir, 'simulation.log'), output);
    if (captured.code !== 0) {
      if (!inputFile) console.error(output);
      throw new Error(`CRE simulation exited with code ${captured.code}; inspect .artifacts/simulation.log.`);
    }
    const result = simulationResult(output);
    if (canonical(Object.keys(result).sort()) !== canonical(['mode', 'publicBundle']) || result.mode !== 'cre-tee-simulation') throw new Error('Unexpected CRE simulation result contract.');
    parsePublicBundle(JSON.stringify(result.publicBundle));
    if (canonical(result.publicBundle) !== canonical(expected)) throw new Error('CRE output differs from the independent local public compilation.');
    if (!output.includes(workflowLog) || authorizedFetches < 1) throw new Error('CRE did not log completion or fetch the authenticated synthetic fixture.');
    const receipt = { verified: true, status: 'passed', startedAt: runStartedAt, finishedAt: new Date().toISOString(), syntheticOnly: !inputFile, localSimulation: true, remoteExecutionVerified: false, attestationVerified: false, ...context, batchId, commitment: expected.commitment, envelopeRoot: expected.envelopeRoot, encryptedEnvelopes: expected.envelopes.length, authenticatedFixtureFetches: authorizedFetches };
    await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
    await writeFile(resolve(artifactsDir, 'payment-result.json'), `${JSON.stringify({ version: 1, mode: 'cre-local-simulation', batchId, publicBundle: result.publicBundle }, null, 2)}\n`);
    for (const line of output.split(/\r?\n/).filter(line => line.includes('[SIMULATION]') || line.includes('[USER LOG]') || line.includes('Workflow compiled'))) console.log(line);
    console.log(`Workflow Simulation Result: ${JSON.stringify(receipt)}`);
    console.log(`Result directory: ${artifactsDir}`);
  } finally {
    if (server.listening) await new Promise<void>((accept, reject) => server.close(error => error ? reject(error) : accept()));
    body.fill(0);
    tokenBytes.fill(0);
    expectedAuthorization.fill(0);
  }
}

main().catch(async error => {
  if (runStartedAt) {
    try {
      await writeFile(receiptPath, `${JSON.stringify({ verified: false, status: 'failed', startedAt: runStartedAt, finishedAt: new Date().toISOString() }, null, 2)}\n`);
    } catch { console.error('Could not save the failed simulation receipt.'); }
  }
  console.error(error instanceof Error ? error.message : 'Simulation failed.');
  process.exitCode = 1;
});
