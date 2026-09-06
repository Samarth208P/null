import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const requireContracts = createRequire(resolve(root, 'packages/contracts/package.json'));
const { createPublicClient, createWalletClient, http, keccak256, getAddress } = await import(pathToFileURL(requireContracts.resolve('viem')).href);
const { privateKeyToAccount } = await import(pathToFileURL(requireContracts.resolve('viem/accounts')).href);
const { poseidonContract } = requireContracts('circomlibjs');
const artifacts = JSON.parse(readFileSync(resolve(root, 'circuits/target/manifest.json'), 'utf8'));
if (artifacts.status !== 'generated' || artifacts.verifierTarget !== 'evm')
  throw new Error('Generate all ZK-enabled verifiers before deployment.');
const integrity = JSON.parse(readFileSync(resolve(root, 'contracts/artifacts/build-integrity.json'), 'utf8'));
const sha = bytes => '0x' + createHash('sha256').update(bytes).digest('hex');
for (const [path, expected] of Object.entries(integrity.sources)) {
  if (sha(readFileSync(resolve(root, 'contracts', path))) !== expected) throw new Error('Solidity source changed; rebuild before deployment.');
}
const asset = process.env.NULL_ASSET_ADDRESS;
const rpc = process.env.NULL_RPC_URL;
const key = process.env.NULL_DEPLOYER_PRIVATE_KEY;
if (!asset || !rpc || !key) throw new Error('NULL_ASSET_ADDRESS, NULL_RPC_URL and NULL_DEPLOYER_PRIVATE_KEY are required.');
const chainId = Number(process.env.NULL_CHAIN_ID ?? '11155111');
if (![11155111, 31337].includes(chainId)) throw new Error('Deployment is restricted to Sepolia or local development.');
const publicClient = createPublicClient({ transport: http(rpc) });
if (await publicClient.getChainId() !== chainId) throw new Error('RPC chain mismatch.');
const assetCode = await publicClient.getCode({ address: getAddress(asset) });
if (!assetCode || assetCode === '0x') throw new Error('Configured asset is not a contract.');
const decimals = await publicClient.readContract({ address: getAddress(asset),
  abi: [{ type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] }], functionName: 'decimals' });
if (decimals !== 6) throw new Error('Only six-decimal assets are supported.');
const chain = { id: chainId, name: chainId === 11155111 ? 'Sepolia' : 'Local development',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [rpc] } } };
const account = privateKeyToAccount(key);
const wallet = createWalletClient({ account, chain, transport: http(rpc) });
const names = { shield: 'ShieldVerifier', create_distribution: 'CreateDistributionVerifier', claim: 'ClaimVerifier' };
const compiled = {};
for (const [kind, name] of Object.entries(names)) {
  const expected = artifacts.circuits[kind];
  if (!expected?.verificationKeySha256 || !expected.verifierSourceSha256) throw new Error('Incomplete circuit manifest.');
  const source = readFileSync(resolve(root, `contracts/src/generated/${name}.sol`));
  const hash = '0x' + createHash('sha256').update(source).digest('hex');
  if (hash !== expected.verifierSourceSha256) throw new Error('Generated verifier source mismatch.');
  compiled[name] = JSON.parse(readFileSync(resolve(root, `contracts/artifacts/${name}.json`), 'utf8'));
}
for (const name of ['NullAuthRegistry', 'NullPool'])
  compiled[name] = JSON.parse(readFileSync(resolve(root, `contracts/artifacts/${name}.json`), 'utf8'));
for (const name of Object.keys(compiled)) {
  if (sha(readFileSync(resolve(root, `contracts/artifacts/${name}.json`))) !== integrity.artifacts[name])
    throw new Error('Compiled artifact changed; rebuild before deployment.');
}
if (!process.argv.includes('--broadcast')) {
  process.stdout.write(JSON.stringify({ mode: 'deployment-plan', chainId, asset: getAddress(asset),
    deployer: account.address, steps: ['Poseidon3', 'NullAuthRegistry', ...Object.values(names), 'NullPool'],
    circuits: artifacts.circuits, warning: 'Unaudited prototype; private notes have no withdrawal path in v1.' }, null, 2) + '\n');
  process.exit(0);
}
// User must deliberately pass --broadcast; this script never approves tokens or shields funds.
const output = resolve(root, `deployments/${chainId}.json`);
if (existsSync(output)) throw new Error('Deployment manifest already exists; preserve immutable deployment history.');
async function deploy(abi, bytecode, args = []) {
  const hash = await wallet.deployContract({ abi, bytecode, args });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success' || !receipt.contractAddress) throw new Error('Deployment failed.');
  return { address: receipt.contractAddress, block: Number(receipt.blockNumber) };
}
async function contract(name, args = []) { return deploy(compiled[name].abi, compiled[name].bytecode, args); }
const poseidon = await deploy(poseidonContract.generateABI(3), poseidonContract.createCode(3));
const registry = await contract('NullAuthRegistry', [poseidon.address]);
const shield = await contract('ShieldVerifier');
const distribution = await contract('CreateDistributionVerifier');
const claim = await contract('ClaimVerifier');
const pool = await contract('NullPool', [getAddress(asset), poseidon.address, registry.address,
  shield.address, distribution.address, claim.address]);
const manifest = JSON.parse(readFileSync(resolve(root, 'deployments/sepolia.template.json'), 'utf8'));
manifest.status = 'deployed'; manifest.chainId = chainId; manifest.deploymentBlock = registry.block;
manifest.asset.address = getAddress(asset);
manifest.codeHashes.asset = keccak256(assetCode);
manifest.contracts = { nullPool: pool.address, nullAuthRegistry: registry.address, poseidon3: poseidon.address,
  shieldVerifier: shield.address, createDistributionVerifier: distribution.address, claimVerifier: claim.address };
for (const [name, address] of Object.entries(manifest.contracts)) {
  const code = await publicClient.getCode({ address });
  if (!code || code === '0x') throw new Error('Deployed code unavailable.');
  manifest.codeHashes[name] = keccak256(code);
}
manifest.build.circuitArtifacts = artifacts.circuits;
manifest.build.gitCommit = process.env.NULL_GIT_COMMIT ?? null;
writeFileSync(output, JSON.stringify(manifest, null, 2) + '\n');
process.stdout.write(`Deployment manifest written to ${output}. No funds shielded.\n`);
