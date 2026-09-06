import { closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, renameSync, statSync, writeFileSync, chmodSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { rootPath, readRootEnv, updateRootEnv, loadRootEnv } from '../contracts/scripts/env.mjs';
import { authPolicyCommitment, deriveField, distributionIntentDigest, FIELD_MODULUS, fromHex, randomBytes,
  secp256k1, toHex, utf8, type AuthPolicyOpening, type Hex } from '../packages/sdk/src/index.ts';
import { NullLiveClient, validateDeploymentManifest, type DeploymentManifest } from '../packages/client/src/index.ts';
import { nullAuthRegistryAbi, nullPoolAbi } from '../packages/contracts/src/index.ts';
import { validateDistributionIntent } from '../packages/auth/src/index.ts';

const root = resolve(rootPath);
const privateDirectory = resolve(root, '.artifacts');
const policyPath = resolve(privateDirectory, 'treasury-policy.json');
const requireContracts = createRequire(resolve(root, 'packages/contracts/package.json'));
const { createPublicClient, createWalletClient, http, keccak256, encodeFunctionData, parseGwei, parseEther,
  formatEther, formatGwei, decodeEventLog, parseTransaction, recoverTransactionAddress } =
  await import(pathToFileURL(requireContracts.resolve('viem')).href);
const { generatePrivateKey, privateKeyToAccount } = await import(pathToFileURL(requireContracts.resolve('viem/accounts')).href);
const signerVariable = 'NULL_TREASURY_SIGNER_PRIVATE_KEY';
const metadataVariable = 'NULL_TREASURY_POLICY_METADATA';
const blinderVariable = 'NULL_TREASURY_REGISTRATION_BLINDER';
class CliError extends Error {}
function fail(message: string): never { throw new CliError(message); }
const print = (value: unknown) => process.stdout.write(JSON.stringify(value, null, 2) + '\n');

function options(command: string) {
  const accepted = command === 'sign' ? ['--input', '--digest', '--output'] : command === 'register' ? ['--broadcast'] : [];
  const result: Record<string, string | boolean> = {};
  for (let i = 3; i < process.argv.length; i++) {
    const name = process.argv[i]!;
    if (!accepted.includes(name) || name in result) fail('Unknown or repeated option. Run treasury --help for usage.');
    if (name === '--broadcast') result[name] = true;
    else {
      const value = process.argv[++i];
      if (!value || value.startsWith('--')) fail('A command option is missing its value.');
      result[name] = value;
    }
  }
  return result;
}

function protect(path: string) {
  if (process.platform === 'win32') {
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      '$p = $env:NULL_PRIVATE_FILE; $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().User; ' +
      '$acl = [System.IO.File]::GetAccessControl($p); $acl.SetAccessRuleProtection($true, $false); ' +
      'foreach ($existing in $acl.Access) { $acl.RemoveAccessRuleAll($existing); } ' +
      '$rule = New-Object System.Security.AccessControl.FileSystemAccessRule($identity, "FullControl", "Allow"); ' +
      '$acl.AddAccessRule($rule); [System.IO.File]::SetAccessControl($p, $acl);',
    ], { env: { ...process.env, NULL_PRIVATE_FILE: path }, stdio: 'pipe' });
  } else chmodSync(path, 0o600);
}

/** Only ignored local artifact paths may contain policy openings or approval witnesses. */
function privatePath(path: string): string {
  const resolved = resolve(root, path);
  if (!resolved.startsWith(privateDirectory + sep)) fail('Private output must be inside the repository .artifacts directory.');
  for (let current = resolved; current !== root; current = dirname(current)) {
    if (dirname(current) === current) fail('Private output must stay inside the repository.');
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) fail('Private output paths must not contain symbolic links or junctions.');
  }
  execFileSync('git', ['check-ignore', '--quiet', '--no-index', relative(root, resolved)], { cwd: root, stdio: 'pipe' });
  return resolved;
}

function writePrivate(path: string, contents: string, replace = false) {
  path = privatePath(path);
  mkdirSync(dirname(path), { recursive: true });
  if (!replace && existsSync(path)) {
    if (readFileSync(path, 'utf8') !== contents) fail('The private output already exists with different content; choose a new output path.');
    protect(path); return;
  }
  const temporary = `${path}.${process.pid}.tmp`;
  closeSync(openSync(temporary, 'wx', 0o600));
  protect(temporary); // Restrict access before any sensitive bytes reach disk.
  writeFileSync(temporary, contents);
  renameSync(temporary, path);
  protect(path);
}

function jsonFile(path: string, maximumBytes: number): unknown {
  if (!existsSync(path) || statSync(path).size > maximumBytes) fail('A required local file is missing or exceeds its size limit.');
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fail('A required local file is not valid JSON.'); }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('Expected a JSON object.');
  return value as Record<string, unknown>;
}

function secretField(value: string | undefined, name: string): bigint {
  if (!value || !/^(0|[1-9][0-9]{0,77})$/.test(value)) return fail(`Missing or invalid ${name}; preserve the existing environment and restore its treasury settings.`);
  const field = BigInt(value);
  if (field <= 0n || field >= FIELD_MODULUS) return fail(`Invalid ${name}; restore the original treasury settings.`);
  return field;
}

function loadPolicy() {
  const saved = readRootEnv();
  const key = saved[signerVariable];
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) return fail('Run pnpm treasury:init to create a separate treasury signer.');
  const signer = privateKeyToAccount(key);
  if (saved.NULL_DEPLOYER_PRIVATE_KEY && signer.address.toLowerCase() === privateKeyToAccount(saved.NULL_DEPLOYER_PRIVATE_KEY).address.toLowerCase())
    fail('The treasury signer must be separate from the deployer wallet.');
  const opening: AuthPolicyOpening = {
    signerPublicKey: toHex(secp256k1.getPublicKey(fromHex(key, 32), true)),
    policyMetadata: secretField(saved[metadataVariable], metadataVariable),
    registrationBlinder: secretField(saved[blinderVariable], blinderVariable),
  };
  const commitment = authPolicyCommitment(opening);
  const text = JSON.stringify({ signerPublicKey: opening.signerPublicKey, policyMetadata: opening.policyMetadata.toString(), registrationBlinder: opening.registrationBlinder.toString() }, null, 2) + '\n';
  return { saved, key: key as Hex, signer, opening, commitment, text };
}

async function initialize() {
  const saved = readRootEnv();
  if (!saved.NULL_DEPLOYER_PRIVATE_KEY || saved.NULL_CHAIN_ID !== '11155111') fail('Complete pnpm setup:sepolia before initializing the treasury.');
  const present = [signerVariable, metadataVariable, blinderVariable].filter(name => Boolean(saved[name]));
  if (present.length && present.length !== 3) fail('Treasury settings are incomplete; restore the original signer, metadata, and blinder together.');
  if (!present.length) {
    if (existsSync(policyPath)) fail('An existing policy file has no matching treasury settings. Restore its signer before continuing.');
    const key = generatePrivateKey();
    if (key.toLowerCase() === saved.NULL_DEPLOYER_PRIVATE_KEY.toLowerCase()) fail('Unexpected signer collision; no key was saved.');
    const entropy = randomBytes(32);
    try {
      await updateRootEnv({ [signerVariable]: key,
        [metadataVariable]: deriveField(entropy, utf8('null.local.treasury-policy.metadata.v1')).toString(),
        [blinderVariable]: deriveField(entropy, utf8('null.local.treasury-policy.registration.v1')).toString() });
    } finally { entropy.fill(0); }
  }
  const policy = loadPolicy();
  writePrivate(policyPath, policy.text);
  print({ status: present.length ? 'existing-treasury-restored' : 'treasury-created', policyFile: relative(root, policyPath),
    policyCommitment: policy.commitment, signerKey: 'Stored privately in the single root .env; separate from deployer.',
    next: 'Run pnpm treasury:register to review registration; add --broadcast to send after contract deployment.' });
}

async function deployment() {
  await loadRootEnv();
  const manifest = jsonFile(resolve(root, 'deployments/11155111.json'), 256_000) as DeploymentManifest;
  validateDeploymentManifest(manifest);
  if (manifest.chainId !== 11155111 || process.env.NULL_CHAIN_ID !== '11155111') fail('Treasury operations are restricted to the deployed Ethereum Sepolia environment.');
  if (process.env.NULL_POOL_ADDRESS && process.env.NULL_POOL_ADDRESS.toLowerCase() !== manifest.contracts.nullPool.toLowerCase()) fail('The configured pool differs from the deployment manifest.');
  const rpcUrl = process.env.NULL_RPC_URL;
  if (!rpcUrl) fail('Set NULL_RPC_URL in the root .env.');
  const live = new NullLiveClient({ manifest, rpcUrls: [rpcUrl], artifactBaseUrl: 'http://127.0.0.1:5173',
    persistLocalSecret: async () => { fail('This CLI does not create or persist treasury note witnesses.'); } });
  await live.verifyDeployment();
  const rpc = createPublicClient({ transport: http(rpcUrl, { timeout: 30_000, retryCount: 2 }) });
  const chain = { id: 11155111, name: 'Ethereum Sepolia', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [rpcUrl] } } };
  return { manifest, rpc, rpcUrl, chain };
}

async function register(broadcast: boolean) {
  const policy = loadPolicy();
  writePrivate(policyPath, policy.text);
  const { manifest, rpc, rpcUrl, chain } = await deployment();
  const registry = manifest.contracts.nullAuthRegistry;
  const registered = await rpc.readContract({ address: registry, abi: nullAuthRegistryAbi, functionName: 'registered', args: [BigInt(policy.commitment)] });
  if (registered) { print({ status: 'policy-already-registered', chainId: 11155111, registry, policyCommitment: policy.commitment, policyFile: relative(root, policyPath) }); return; }
  const deployerKey = policy.saved.NULL_DEPLOYER_PRIVATE_KEY;
  if (!deployerKey) fail('The root .env is missing the funded deployer key.');
  const account = privateKeyToAccount(deployerKey);
  const wallet = createWalletClient({ account, chain, transport: http(rpcUrl) });
  const data = encodeFunctionData({ abi: nullAuthRegistryAbi, functionName: 'register', args: [BigInt(policy.commitment)] });
  const journalPath = privatePath(resolve(privateDirectory, 'treasury-registration-11155111.json'));
  let journal: Record<string, unknown> | undefined = existsSync(journalPath) ? asRecord(jsonFile(journalPath, 32_000)) : undefined;
  if (journal) {
    if (journal.registry !== registry || journal.policyCommitment !== policy.commitment || typeof journal.rawTransaction !== 'string' || typeof journal.hash !== 'string') fail('An existing registration journal belongs to another policy or deployment.');
    const transaction = parseTransaction(journal.rawTransaction);
    if (transaction.chainId !== 11155111 || transaction.to?.toLowerCase() !== registry.toLowerCase() || transaction.data !== data || (transaction.value ?? 0n) !== 0n ||
      keccak256(journal.rawTransaction) !== journal.hash || (await recoverTransactionAddress({ serializedTransaction: journal.rawTransaction })).toLowerCase() !== account.address.toLowerCase())
      fail('The saved registration transaction does not match this exact policy, registry, chain, and deployer.');
    if (!transaction.gas || !transaction.maxFeePerGas || transaction.gas > 2_000_000n ||
      transaction.maxFeePerGas > parseGwei(process.env.NULL_MAX_FEE_GWEI || '10') || transaction.gas * transaction.maxFeePerGas > parseEther('0.01'))
      fail('The saved registration transaction exceeds its gas, fee, or 0.01 Sepolia ETH budget.');
    if (!broadcast) { print({ status: 'registration-prepared', transactionHash: journal.hash, next: 'Run pnpm treasury:register --broadcast to reconcile or resend the same saved transaction.' }); return; }
  } else {
    await rpc.call({ account: account.address, to: registry, data, value: 0n });
    const gas = (await rpc.estimateGas({ account: account.address, to: registry, data, value: 0n })) * 120n / 100n;
    const fees = await rpc.estimateFeesPerGas();
    const feeCap = parseGwei(process.env.NULL_MAX_FEE_GWEI || '10');
    const costCap = parseEther('0.01');
    const allowance = gas * fees.maxFeePerGas;
    print({ status: 'registration-plan', chainId: 11155111, registry, sender: account.address, policyCommitment: policy.commitment,
      gasAllowance: gas.toString(), maxFeePerGasGwei: formatGwei(fees.maxFeePerGas), fundingAllowanceEth: formatEther(allowance),
      policyFile: relative(root, policyPath), sendsTransaction: broadcast });
    if (!broadcast) return;
    if (feeCap <= 0n || fees.maxFeePerGas > feeCap || allowance > costCap || gas > 2_000_000n) fail('Policy registration exceeds its configured fee cap or 0.01 Sepolia ETH budget.');
    if (await rpc.getBalance({ address: account.address }) < allowance) fail('The deployer needs more Sepolia ETH for policy registration.');
    const latestNonce = await rpc.getTransactionCount({ address: account.address, blockTag: 'latest' });
    if (await rpc.getTransactionCount({ address: account.address, blockTag: 'pending' }) !== latestNonce) fail('The deployer has a pending transaction. Wait for deployment to finish first.');
    const rawTransaction = await wallet.signTransaction({ account, chain, nonce: latestNonce, to: registry, data, value: 0n, gas,
      maxFeePerGas: fees.maxFeePerGas, maxPriorityFeePerGas: fees.maxPriorityFeePerGas });
    journal = { registry, policyCommitment: policy.commitment, rawTransaction, hash: keccak256(rawTransaction) };
    writePrivate(journalPath, JSON.stringify(journal, null, 2) + '\n');
  }
  try {
    await rpc.sendRawTransaction({ serializedTransaction: journal.rawTransaction });
  } catch {
    // Already-known or uncertain sends are resolved by the saved transaction hash.
  }
  print({ status: 'registration-submitted-or-pending', transactionHash: journal.hash });
  let receipt;
  try { receipt = await rpc.waitForTransactionReceipt({ hash: journal.hash, confirmations: 3, timeout: 180_000 }); }
  catch { return fail('Registration confirmation is pending or uncertain. Keep the journal and rerun the same --broadcast command; do not create another policy.'); }
  if (receipt.status !== 'success') fail('The saved registration transaction reverted. Preserve the journal and inspect its public transaction receipt before retrying.');
  let policyIndex: number | undefined;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== registry.toLowerCase()) continue;
    try {
      const event = decodeEventLog({ abi: nullAuthRegistryAbi, data: log.data, topics: log.topics });
      if (event.eventName === 'PolicyRegistered' && event.args.policyCommitment === BigInt(policy.commitment)) policyIndex = Number(event.args.policyIndex);
    } catch { /* Ignore unrelated logs. */ }
  }
  if (policyIndex === undefined || !await rpc.readContract({ address: registry, abi: nullAuthRegistryAbi, functionName: 'registered', args: [BigInt(policy.commitment)] })) fail('The receipt did not confirm the expected policy registration.');
  print({ status: 'policy-registered', chainId: 11155111, registry, policyCommitment: policy.commitment, policyIndex,
    transactionHash: receipt.transactionHash, policyFile: relative(root, policyPath) });
}

async function signIntent(args: Record<string, string | boolean>) {
  if (typeof args['--input'] !== 'string' || typeof args['--digest'] !== 'string') fail('Signing requires --input <exported-intent.json> and --digest <reviewed UI digest>.');
  const expectedDigest = args['--digest'];
  if (!/^0x[0-9a-fA-F]{64}$/.test(expectedDigest)) fail('Copy the complete 32-byte approval digest from the review screen.');
  const intent = asRecord(jsonFile(resolve(root, args['--input']), 16_384));
  if (Object.keys(intent).length !== 2 || !('digest' in intent) || !('publicInputs' in intent) || !Array.isArray(intent.publicInputs) || intent.publicInputs.length !== 15 ||
    intent.publicInputs.some(value => typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value) || BigInt(value) >= FIELD_MODULUS)) fail('Use the unmodified public approval-intent JSON exported by the application.');
  const inputs = intent.publicInputs as Hex[];
  const digest = distributionIntentDigest(inputs);
  if (typeof intent.digest !== 'string' || digest !== intent.digest.toLowerCase() || digest !== expectedDigest.toLowerCase()) fail('The file, recomputed intent, and reviewed digest do not match.');
  const policy = loadPolicy();
  writePrivate(policyPath, policy.text);
  const { manifest, rpc } = await deployment();
  const block = await rpc.getBlock();
  const now = BigInt(Math.floor(Date.now() / 1000));
  const currentTime = now > block.timestamp ? now : block.timestamp;
  const envelopeRoot = `0x${((BigInt(inputs[8]!) << 128n) | BigInt(inputs[9]!)).toString(16).padStart(64, '0')}` as Hex;
  validateDistributionIntent(inputs, { chainId: 11155111n, poolAddress: manifest.contracts.nullPool, commitment: inputs[7]!, envelopeRoot }, currentTime);
  if (currentTime - block.timestamp > 120n || block.timestamp > now + 60n) fail('RPC block time and local time are inconsistent; refresh the RPC before signing.');
  if (BigInt(inputs[14]!) <= currentTime + 60n) fail('This intent expires too soon to prepare its proof. Export a fresh intent.');
  if ([3, 4, 5, 6, 7, 10, 13].some(index => BigInt(inputs[index]!) === 0n) || BigInt(inputs[5]!) === BigInt(inputs[6]!) ||
    [8, 9, 11, 12].some(index => BigInt(inputs[index]!) >= 1n << 128n)) fail('The intent contains invalid roots, nullifiers, commitments, nonce, or 128-bit fields.');
  const pool = manifest.contracts.nullPool;
  const registry = manifest.contracts.nullAuthRegistry;
  const [registered, knownNotes, knownPolicyRoot, spentFirst, spentSecond] = await Promise.all([
    rpc.readContract({ address: registry, abi: nullAuthRegistryAbi, functionName: 'registered', args: [BigInt(policy.commitment)] }),
    rpc.readContract({ address: pool, abi: nullPoolAbi, functionName: 'isKnownNoteRoot', args: [BigInt(inputs[3]!)] }),
    rpc.readContract({ address: registry, abi: nullAuthRegistryAbi, functionName: 'isKnownAuthRoot', args: [BigInt(inputs[4]!)] }),
    rpc.readContract({ address: pool, abi: nullPoolAbi, functionName: 'spentNoteNullifier', args: [BigInt(inputs[5]!)] }),
    rpc.readContract({ address: pool, abi: nullPoolAbi, functionName: 'spentNoteNullifier', args: [BigInt(inputs[6]!)] }),
  ]);
  if (!registered || !knownNotes || !knownPolicyRoot || spentFirst || spentSecond) fail('The policy is unregistered, a root is stale, or a treasury note was already consumed. Prepare a fresh intent.');
  let policyIndex: bigint | undefined;
  let rootIndex: bigint | undefined;
  for (let fromBlock = BigInt(manifest.deploymentBlock); fromBlock <= block.number; fromBlock += 2_000n) {
    const toBlock = fromBlock + 1_999n < block.number ? fromBlock + 1_999n : block.number;
    const logs = await rpc.getLogs({ address: registry, event: { type: 'event', name: 'PolicyRegistered', inputs: [
      { name: 'policyCommitment', type: 'uint256', indexed: true }, { name: 'policyIndex', type: 'uint256', indexed: true }, { name: 'postAuthRoot', type: 'uint256', indexed: false },
    ] }, fromBlock, toBlock });
    for (const log of logs) {
      if (log.removed) continue;
      if (log.args.policyCommitment === BigInt(policy.commitment)) policyIndex = log.args.policyIndex;
      if (log.args.postAuthRoot === BigInt(inputs[4]!)) rootIndex = log.args.policyIndex;
    }
  }
  if (policyIndex === undefined || rootIndex === undefined || policyIndex > rootIndex) fail('The requested authorization root does not include the expected local treasury policy.');
  const keyBytes = fromHex(policy.key, 32);
  let signatureBytes: Uint8Array | undefined;
  try {
    signatureBytes = secp256k1.sign(fromHex(digest, 32), keyBytes, { lowS: true, prehash: false }).toCompactRawBytes();
    if (!secp256k1.verify(signatureBytes, fromHex(digest, 32), fromHex(policy.opening.signerPublicKey), { lowS: true, prehash: false })) fail('The generated signature did not match the expected local policy signer.');
    const output = typeof args['--output'] === 'string' ? privatePath(args['--output']) : privatePath(resolve(privateDirectory, `treasury-approval-${digest.slice(2, 18)}.txt`));
    writePrivate(output, toHex(signatureBytes) + '\n');
    print({ status: 'approval-saved', chainId: 11155111, pool, digest, validUntil: BigInt(inputs[14]!).toString(), signatureFile: relative(root, output),
      next: 'Open the private signature file locally, paste its value into Compact signature for this same pending intent, and choose Use this approval. The signature was not printed.' });
  } finally { keyBytes.fill(0); signatureBytes?.fill(0); }
}

try {
  const command = process.argv[2];
  if (!command || command === '--help' || command === 'help') {
    process.stdout.write('Local Sepolia treasury\n\n' +
      'pnpm treasury:init\n' +
      'pnpm treasury:register [--broadcast]\n' +
      'pnpm treasury:sign --input <exported-intent.json> --digest <reviewed-digest> [--output .artifacts/approval.txt]\n\n' +
      'Init creates a separate private signer and a policy import file. Registration sends only with --broadcast.\n' +
      'Signing writes a private compact approval file; it never broadcasts or exposes the signing key.\n');
  } else if (command === 'init') { options(command); await initialize(); }
  else if (command === 'register') await register(Boolean(options(command)['--broadcast']));
  else if (command === 'sign') await signIntent(options(command));
  else fail('Unknown command. Use init, register, sign, or --help.');
} catch (error) {
  // Dependency/RPC exceptions can carry request data. Never dump them or stack traces.
  const message = error instanceof CliError ? error.message : 'The operation failed while checking local configuration, deployment, or RPC state. No private values were logged; preserve existing files and verify configuration.';
  process.stderr.write(message + '\n');
  process.exitCode = 1;
}
