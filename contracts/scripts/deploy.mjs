import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { preflightDeployments } from './preflight.mjs';
import { updateRootEnv } from './env.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const requireContracts = createRequire(resolve(root, 'packages/contracts/package.json'));
const { createPublicClient, createWalletClient, http, keccak256, getAddress, encodeDeployData,
  getContractAddress, parseEther, parseGwei, formatEther, formatGwei, parseTransaction,
  recoverTransactionAddress } = await import(pathToFileURL(requireContracts.resolve('viem')).href);
const { privateKeyToAccount } = await import(pathToFileURL(requireContracts.resolve('viem/accounts')).href);
const { poseidonContract } = requireContracts('circomlibjs');
const readJson = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const sha = bytes => '0x' + createHash('sha256').update(bytes).digest('hex');
const artifacts = readJson('circuits/target/manifest.json');
const integrity = readJson('contracts/artifacts/build-integrity.json');
if (artifacts.status !== 'generated' || artifacts.verifierTarget !== 'evm' || !integrity.qualifiedArtifacts)
  throw new Error('Generate ZK-enabled verifiers and rebuild contracts with library link metadata.');
for (const [path, expected] of Object.entries(integrity.sources)) {
  if (sha(readFileSync(resolve(root, 'contracts', path))) !== expected) throw new Error('Solidity source changed; rebuild before deployment.');
}
const asset = getAddress(process.env.NULL_ASSET_ADDRESS ?? '');
const rpc = process.env.NULL_RPC_URL;
const key = process.env.NULL_DEPLOYER_PRIVATE_KEY;
if (!rpc || !key) throw new Error('NULL_ASSET_ADDRESS, NULL_RPC_URL and NULL_DEPLOYER_PRIVATE_KEY are required. Run pnpm setup:sepolia.');
const chainId = Number(process.env.NULL_CHAIN_ID ?? '11155111');
if (![11155111, 31337].includes(chainId)) throw new Error('Deployment is restricted to Sepolia or local development.');
if (process.argv.includes('--sepolia') && chainId !== 11155111) throw new Error('deploy:sepolia requires Ethereum Sepolia.');
if (process.argv.includes('--broadcast') && process.env.NULL_CHAIN_ID !== '11155111' && process.env.NULL_CHAIN_ID !== '31337')
  throw new Error('Set NULL_CHAIN_ID explicitly before broadcasting.');
const account = privateKeyToAccount(key);
const publicClient = createPublicClient({ transport: http(rpc, { timeout: 30_000, retryCount: 2 }) });
const chain = { id: chainId, name: chainId === 11155111 ? 'Sepolia' : 'Local development',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [rpc] } } };
const wallet = createWalletClient({ account, chain, transport: http(rpc) });
if (await publicClient.getChainId() !== chainId) throw new Error('RPC chain mismatch.');
const assetCode = await publicClient.getCode({ address: asset });
if (!assetCode || assetCode === '0x') throw new Error('Configured asset is not a contract.');
const decimals = await publicClient.readContract({ address: asset,
  abi: [{ type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] }], functionName: 'decimals' });
if (decimals !== 6) throw new Error('Only six-decimal assets are supported.');

function artifact(name) {
  const bytes = readFileSync(resolve(root, `contracts/artifacts/${name}.json`));
  if (sha(bytes) !== integrity.artifacts[name]) throw new Error(`Compiled artifact changed: ${name}. Rebuild contracts.`);
  const value = JSON.parse(bytes);
  if ((value.deployedBytecode.length - 2) / 2 > 24_576) throw new Error(`Runtime exceeds EIP-170: ${name}.`);
  return value;
}
const names = { shield: 'ShieldVerifier', create_distribution: 'CreateDistributionVerifier', claim: 'ClaimVerifier', withdraw: 'WithdrawVerifier' };
const compiled = {};
for (const [kind, name] of Object.entries(names)) {
  const expected = artifacts.circuits[kind];
  if (!expected?.verificationKeySha256 || !expected.verifierSourceSha256 || expected.verifierTarget !== 'evm') throw new Error('Incomplete circuit manifest.');
  for (const [path, hash] of [
    [`contracts/src/generated/${name}.sol`, expected.verifierSourceSha256],
    [`circuits/target/${kind}.json`, expected.sha256],
    [`circuits/target/${kind}.vk`, expected.verificationKeySha256],
  ]) if (sha(readFileSync(resolve(root, path))) !== hash) throw new Error(`Circuit artifact mismatch: ${path}.`);
  compiled[name] = artifact(name);
}
for (const name of ['NullAuthRegistry', 'NullPool']) compiled[name] = artifact(name);

// Deduplicate only compiler-identical library instructions and ABIs. Metadata records
// each source FQN separately; the deployed representative and every alias are retained.
function instructions(code) {
  const length = parseInt(code.slice(-4), 16) * 2 + 4;
  if (!Number.isFinite(length) || length <= 4 || length >= code.length - 2) throw new Error('Invalid Solidity metadata trailer.');
  return code.slice(0, -length);
}
const libraries = [];
const libraryAliases = {};
for (const contract of Object.values(compiled)) {
  for (const [source, refs] of Object.entries(contract.linkReferences)) {
    for (const name of Object.keys(refs)) {
      const fqn = `${source}:${name}`;
      if (libraryAliases[fqn]) continue;
      const path = integrity.qualifiedArtifacts[fqn];
      if (!path) throw new Error(`Missing library artifact: ${fqn}.`);
      const value = artifact(path);
      if (Object.keys(value.linkReferences).length || Object.keys(value.immutableReferences).length)
        throw new Error('Nested library links or library immutables require explicit deployment support.');
      const identity = sha(JSON.stringify([instructions(value.bytecode), instructions(value.deployedBytecode), value.abi]));
      let existing = libraries.find(lib => lib.identity === identity);
      if (!existing) { existing = { id: fqn, identity, ...value }; libraries.push(existing); }
      libraryAliases[fqn] = existing.id;
    }
  }
}
function link(contract, addresses, runtime = false) {
  let code = runtime ? contract.deployedBytecode : contract.bytecode;
  for (const [source, refs] of Object.entries(runtime ? contract.deployedLinkReferences : contract.linkReferences)) {
    for (const [name, positions] of Object.entries(refs)) {
      const address = addresses[libraryAliases[`${source}:${name}`]];
      if (!address) throw new Error(`Library not deployed: ${source}:${name}.`);
      for (const { start, length } of positions) {
        if (length !== 20) throw new Error('Unexpected Solidity library reference size.');
        code = code.slice(0, 2 + start * 2) + address.slice(2).toLowerCase() + code.slice(2 + (start + length) * 2);
      }
    }
  }
  if (!/^0x[0-9a-fA-F]+$/.test(code)) throw new Error('Deployment bytecode contains unresolved library references.');
  return code;
}
const output = resolve(root, `deployments/${chainId}-withdrawals-v2.json`);
const journalPath = resolve(root, `.artifacts/deployment-${chainId}-withdrawals-v2.json`);
const fingerprint = sha(JSON.stringify({ chainId, asset, deployer: account.address, integrity, artifacts }));
const journal = existsSync(journalPath) ? readJson(`.artifacts/deployment-${chainId}-withdrawals-v2.json`) :
  { fingerprint, chainId, deployer: account.address, steps: [] };
if (journal.fingerprint !== fingerprint) throw new Error('Deployment journal belongs to a different wallet/build/configuration. Preserve it and resolve the mismatch.');
const latestNonce = await publicClient.getTransactionCount({ address: account.address, blockTag: 'latest' });
const pendingNonce = await publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' });
const startNonce = journal.steps[0]?.nonce ?? latestNonce;
if (!journal.steps.length && pendingNonce !== latestNonce) throw new Error('Deployer has pending transactions. Resolve them before deployment.');
const steps = [
  { id: 'poseidon3', abi: poseidonContract.generateABI(3), bytecode: poseidonContract.createCode(3), linkReferences: {} },
  ...libraries,
  { id: 'nullAuthRegistry', ...compiled.NullAuthRegistry, args: a => [a.poseidon3] },
  { id: 'shieldVerifier', ...compiled.ShieldVerifier },
  { id: 'createDistributionVerifier', ...compiled.CreateDistributionVerifier },
  { id: 'claimVerifier', ...compiled.ClaimVerifier },
  { id: 'withdrawVerifier', ...compiled.WithdrawVerifier },
  { id: 'nullPool', ...compiled.NullPool, args: a => [asset, a.poseidon3, a.nullAuthRegistry, a.shieldVerifier, a.createDistributionVerifier, a.claimVerifier, a.withdrawVerifier] },
];
const addresses = Object.fromEntries(steps.map((step, i) => [step.id, getContractAddress({ from: account.address, nonce: BigInt(startNonce + i) })]));
for (const [i, step] of steps.entries()) {
  step.nonce = startNonce + i;
  step.address = addresses[step.id];
  step.data = encodeDeployData({ abi: step.abi, bytecode: link(step, addresses), args: step.args?.(addresses) ?? [] });
  if ((step.data.length - 2) / 2 > 49_152) throw new Error(`Init code exceeds EIP-3860: ${step.id}.`);
}
// Reproduce the constructor simulations before this deployment began. Some RPCs
// retain CREATE collision checks for already-mined accounts despite state overrides.
const firstMinedBlock = journal.steps.find(step => step.receipt)?.receipt.blockNumber;
const preflight = await preflightDeployments({ publicClient, account: account.address, steps,
  atBlock: firstMinedBlock ? BigInt(firstMinedBlock) - 1n : undefined });
const feeCap = parseGwei(process.env.NULL_MAX_FEE_GWEI ?? '10');
const budget = parseEther(process.env.NULL_MAX_DEPLOYMENT_ETH ?? '0.05');
if (feeCap <= 0n || budget <= 0n) throw new Error('Deployment fee cap and budget must be positive.');
const fees = await publicClient.estimateFeesPerGas();
const balance = await publicClient.getBalance({ address: account.address });
const remaining = steps.filter(step => !journal.steps.find(saved => saved.id === step.id)?.receipt);
const gasAllowance = remaining.reduce((total, step) => total + step.gasAllowance, 0n);
const fundingAllowance = gasAllowance * fees.maxFeePerGas;
const plan = { mode: 'deployment-plan', chainId, asset, deployer: account.address,
  balanceEth: formatEther(balance), maxFeePerGasGwei: formatGwei(fees.maxFeePerGas),
  fundingAllowanceEth: formatEther(fundingAllowance), fundingShortfallEth: formatEther(fundingAllowance > balance ? fundingAllowance - balance : 0n),
  maxDeploymentBudgetEth: formatEther(budget), maxFeeCapGwei: formatGwei(feeCap),
  estimate: 'RPC constructor simulations with a 20% gas margin at the current fee quote. Rechecked before every send.',
  simulatedAtBlock: Number(preflight.blockNumber),
  steps: steps.map(step => ({ name: step.id, address: step.address, nonce: step.nonce, gasAllowance: step.gasAllowance.toString(), runtimeCodeHash: keccak256(step.expectedRuntime), confirmed: Boolean(journal.steps.find(saved => saved.id === step.id)?.receipt) })),
  libraryAliases, warning: 'Unaudited testnet prototype with public withdrawals. Contract deployment does not validate the Privy-approved production flow.' };
mkdirSync(resolve(root, '.artifacts'), { recursive: true });
writeFileSync(resolve(root, `.artifacts/deployment-plan-${chainId}.json`), JSON.stringify(plan, null, 2) + '\n');
process.stdout.write(JSON.stringify(plan, null, 2) + '\n');
if (!process.argv.includes('--broadcast')) process.exit(0);
if (existsSync(output) && (journal.steps.length !== steps.length || remaining.length))
  throw new Error('Existing manifest has no matching completed deployment journal. Preserve immutable deployment history.');
if (remaining.length && fees.maxFeePerGas > feeCap) throw new Error('Current fees exceed NULL_MAX_FEE_GWEI. No transaction sent.');
if (fundingAllowance > budget || balance < fundingAllowance) throw new Error('Fund the deployer to the displayed allowance, or wait for lower fees within the configured budget. No transaction sent.');
function saveJournal() {
  writeFileSync(`${journalPath}.tmp`, JSON.stringify(journal, null, 2) + '\n');
  renameSync(`${journalPath}.tmp`, journalPath);
}
for (const step of steps) {
  let saved = journal.steps.find(value => value.id === step.id);
  if (saved && (saved.nonce !== step.nonce || saved.address !== step.address || saved.dataHash !== keccak256(step.data)))
    throw new Error('Journal transaction does not match the reviewed deployment plan.');
  if (!saved) {
    if (await publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' }) !== step.nonce)
      throw new Error('Deployer nonce changed. Stop using this wallet for other transactions during deployment.');
    const currentFees = await publicClient.estimateFeesPerGas();
    if (currentFees.maxFeePerGas > feeCap) throw new Error('Fees exceed configured cap; rerun later to resume.');
    const estimate = await publicClient.estimateGas({ account: account.address, data: step.data });
    const gas = estimate * 120n / 100n;
    const spent = journal.steps.reduce((total, value) => total + (value.receipt ? BigInt(value.receipt.gasUsed) * BigInt(value.receipt.effectiveGasPrice) : 0n), 0n);
    if (spent + gas * currentFees.maxFeePerGas > budget) throw new Error('Transaction would exceed the total deployment budget.');
    if (await publicClient.getBalance({ address: account.address }) < gas * currentFees.maxFeePerGas) throw new Error('Insufficient Sepolia ETH; top up the same deployer to resume.');
    const rawTransaction = await wallet.signTransaction({ account, chain, nonce: step.nonce, data: step.data, gas,
      maxFeePerGas: currentFees.maxFeePerGas, maxPriorityFeePerGas: currentFees.maxPriorityFeePerGas, value: 0n });
    saved = { id: step.id, address: step.address, nonce: step.nonce, dataHash: keccak256(step.data), hash: keccak256(rawTransaction), rawTransaction };
    journal.steps.push(saved); saveJournal(); // Persist hash before any possibly ambiguous RPC response.
  }
  const transaction = parseTransaction(saved.rawTransaction);
  if (keccak256(saved.rawTransaction) !== saved.hash || transaction.chainId !== chainId || transaction.nonce !== step.nonce ||
    transaction.to || (transaction.value ?? 0n) !== 0n || !transaction.data || keccak256(transaction.data) !== saved.dataHash ||
    getAddress(await recoverTransactionAddress({ serializedTransaction: saved.rawTransaction })) !== account.address)
    throw new Error('Saved transaction does not match the deployer and planned creation.');
  let receipt;
  try { receipt = await publicClient.getTransactionReceipt({ hash: saved.hash }); }
  catch (error) { if (error.name !== 'TransactionReceiptNotFoundError') throw error; }
  if (!receipt) {
    let pending;
    try { pending = await publicClient.getTransaction({ hash: saved.hash }); }
    catch (error) { if (error.name !== 'TransactionNotFoundError') throw error; }
    if (!pending) {
      const spent = journal.steps.reduce((total, value) => total + (value.receipt ? BigInt(value.receipt.gasUsed) * BigInt(value.receipt.effectiveGasPrice) : 0n), 0n);
      if (!transaction.gas || !transaction.maxFeePerGas || transaction.maxFeePerGas > feeCap || spent + transaction.gas * transaction.maxFeePerGas > budget)
        throw new Error('Saved transaction exceeds current deployment fee or budget limits.');
      if (await publicClient.getTransactionCount({ address: account.address, blockTag: 'latest' }) > saved.nonce)
        throw new Error('Saved deployment nonce was consumed by another transaction.');
      await publicClient.sendRawTransaction({ serializedTransaction: saved.rawTransaction });
    }
    process.stdout.write(`Waiting for ${step.id}: ${saved.hash}\n`);
    receipt = await publicClient.waitForTransactionReceipt({ hash: saved.hash, confirmations: 3, timeout: 180_000 });
  } else if (await publicClient.getBlockNumber() < receipt.blockNumber + 2n) {
    receipt = await publicClient.waitForTransactionReceipt({ hash: saved.hash, confirmations: 3, timeout: 180_000 });
  }
  if (receipt.status !== 'success' || !receipt.contractAddress || getAddress(receipt.contractAddress) !== step.address)
    throw new Error('Deployment transaction failed or created an unexpected address.');
  const code = await publicClient.getCode({ address: step.address });
  if (!code || code === '0x') throw new Error('Deployed runtime code unavailable.');
  if (code.toLowerCase() !== step.expectedRuntime.toLowerCase()) throw new Error(`Deployed runtime differs from constructor simulation: ${step.id}.`);
  if (step.deployedBytecode) {
    let expected = link(step, addresses, true).toLowerCase();
    let actual = code.toLowerCase();
    // Solidity libraries embed their own deployment address in the first PUSH20.
    if (libraries.some(library => library.id === step.id)) {
      if (!expected.startsWith('0x73' + '0'.repeat(40))) throw new Error('Unknown Solidity library self-address layout.');
      expected = '0x73' + step.address.slice(2).toLowerCase() + expected.slice(44);
    }
    // Exact immutables are covered by the constructor simulation above, with
    // available dependency getters checked again before manifest publication.
    for (const references of Object.values(step.immutableReferences)) {
      for (const { start, length } of references) {
        const zero = '0'.repeat(length * 2);
        expected = expected.slice(0, 2 + start * 2) + zero + expected.slice(2 + (start + length) * 2);
        actual = actual.slice(0, 2 + start * 2) + zero + actual.slice(2 + (start + length) * 2);
      }
    }
    if (actual !== expected) throw new Error(`Deployed runtime does not match linked compiler output: ${step.id}.`);
  }
  const codeHash = keccak256(code);
  if (saved.codeHash && saved.codeHash !== codeHash) throw new Error('Previously deployed runtime changed.');
  saved.codeHash = codeHash;
  saved.receipt = { blockNumber: Number(receipt.blockNumber), blockHash: receipt.blockHash,
    gasUsed: receipt.gasUsed.toString(), effectiveGasPrice: receipt.effectiveGasPrice.toString() };
  saveJournal();
  process.stdout.write(`Confirmed ${step.id}: ${step.address}\n`);
}
const manifest = readJson('deployments/sepolia.template.json');
manifest.protocolVersion = '0.2.0'; manifest.security.withdrawalsImplemented = true;
manifest.status = 'deployed'; manifest.chainId = chainId;
manifest.deploymentBlock = Math.min(...journal.steps.map(step => step.receipt.blockNumber));
manifest.asset.address = asset; manifest.codeHashes.asset = keccak256(assetCode);
manifest.contracts = Object.fromEntries(['nullPool', 'nullAuthRegistry', 'poseidon3', 'shieldVerifier', 'createDistributionVerifier', 'claimVerifier', 'withdrawVerifier'].map(name => [name, addresses[name]]));
for (const name of Object.keys(manifest.contracts)) manifest.codeHashes[name] = journal.steps.find(step => step.id === name).codeHash;
manifest.build.circuitArtifacts = artifacts.circuits;
manifest.build.gitCommit = process.env.NULL_GIT_COMMIT ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
manifest.build.solidityIntegritySha256 = sha(readFileSync(resolve(root, 'contracts/artifacts/build-integrity.json')));
manifest.build.workingTreeDirty = Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim());
manifest.libraries = Object.fromEntries(Object.entries(libraryAliases).map(([fqn, id]) => [fqn, { address: addresses[id], codeHash: journal.steps.find(step => step.id === id).codeHash }]));
manifest.transactions = journal.steps.map(({ id, address, hash, receipt }) => ({ name: id, address, hash, ...receipt }));
// Verify constructor bindings against the real chain before publishing a live manifest.
for (const [name, expected] of Object.entries({ ASSET: asset, HASHER: addresses.poseidon3, AUTH_REGISTRY: addresses.nullAuthRegistry,
  shieldVerifier: addresses.shieldVerifier, createDistributionVerifier: addresses.createDistributionVerifier, claimVerifier: addresses.claimVerifier, withdrawVerifier: addresses.withdrawVerifier })) {
  const actual = await publicClient.readContract({ address: addresses.nullPool, abi: compiled.NullPool.abi, functionName: name });
  if (getAddress(actual) !== expected) throw new Error(`Pool constructor binding mismatch: ${name}.`);
}
if (getAddress(await publicClient.readContract({ address: addresses.nullAuthRegistry, abi: compiled.NullAuthRegistry.abi, functionName: 'HASHER' })) !== addresses.poseidon3)
  throw new Error('Registry hasher mismatch.');
for (const name of ['shieldVerifier', 'createDistributionVerifier', 'claimVerifier', 'withdrawVerifier']) {
  const actual = await publicClient.readContract({ address: addresses.nullPool, abi: compiled.NullPool.abi, functionName: `${name}CodeHash` });
  if (actual !== manifest.codeHashes[name]) throw new Error(`Immutable verifier code hash mismatch: ${name}.`);
}
if (existsSync(output)) {
  const previous = readJson(`deployments/${chainId}-withdrawals-v2.json`);
  for (const field of ['status', 'chainId', 'deploymentBlock', 'asset', 'contracts', 'codeHashes', 'libraries', 'transactions'])
    if (JSON.stringify(previous[field]) !== JSON.stringify(manifest[field])) throw new Error(`Existing manifest differs from confirmed deployment: ${field}.`);
  if (JSON.stringify(previous.build.circuitArtifacts) !== JSON.stringify(manifest.build.circuitArtifacts)) throw new Error('Existing manifest artifact mismatch.');
} else writeFileSync(output, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
copyFileSync(output, resolve(root, 'apps/web/public/deployment.json'));
for (const kind of Object.keys(names)) copyFileSync(resolve(root, `circuits/target/${kind}.json`), resolve(root, `apps/web/public/circuits/${kind}.json`));
copyFileSync(resolve(root, 'circuits/target/manifest.json'), resolve(root, 'apps/web/public/circuits/manifest.json'));
// Keep the browser's public RPC setting. Deployment URLs can carry credentials in paths.
updateRootEnv({ NULL_POOL_ADDRESS: addresses.nullPool, NULL_MANIFEST_PATH: `deployments/${chainId}-withdrawals-v2.json`,
  VITE_POOL_ADDRESS: addresses.nullPool, VITE_DEFAULT_ENVIRONMENT: 'testnet',
  VITE_DEPLOYMENT_BLOCK: String(manifest.deploymentBlock), VITE_DEPLOYMENT_MANIFEST_URL: '/deployment.json' });
process.stdout.write(`Deployment manifest written to ${output}; public artifacts and root .env synchronized. Restart Vite.\n`);
