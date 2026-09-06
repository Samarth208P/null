import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { readRootEnv, updateRootEnv, rootPath } from './env.mjs';

const requireContracts = createRequire(resolve(rootPath, 'packages/contracts/package.json'));
const { createPublicClient, createWalletClient, http, parseEther, parseGwei, formatEther, keccak256,
  parseTransaction, recoverTransactionAddress, getAddress } = await import(pathToFileURL(requireContracts.resolve('viem')).href);
const { generatePrivateKey, privateKeyToAccount } = await import(pathToFileURL(requireContracts.resolve('viem/accounts')).href);
let env = readRootEnv();
if (env.NULL_CHAIN_ID !== '11155111' || !env.NULL_DEPLOYER_PRIVATE_KEY) throw new Error('Configure the funded Sepolia deployer in root .env first.');
const key = env.RELAYER_PRIVATE_KEY || generatePrivateKey();
const relayer = privateKeyToAccount(key);
const deployer = privateKeyToAccount(env.NULL_DEPLOYER_PRIVATE_KEY);
if (relayer.address === deployer.address) throw new Error('Use a separate relayer wallet.');
updateRootEnv({ RELAYER_PRIVATE_KEY: key, RELAYER_ADDRESS: relayer.address,
  RELAYER_RPC_URL: env.RELAYER_RPC_URL || env.NULL_RPC_URL,
  RELAYER_PORT: env.RELAYER_PORT || '8787',
  RELAYER_ALLOWED_ORIGINS: env.RELAYER_ALLOWED_ORIGINS || 'http://127.0.0.1:5173,http://localhost:5173',
  VITE_RELAYER_URL: `http://127.0.0.1:${env.RELAYER_PORT || '8787'}` });
env = readRootEnv();
const rpc = createPublicClient({ transport: http(env.NULL_RPC_URL, { timeout: 30_000 }) });
if (await rpc.getChainId() !== 11155111) throw new Error('RPC is not Ethereum Sepolia.');
const target = parseEther('0.05');
const balance = await rpc.getBalance({ address: relayer.address });
process.stdout.write(JSON.stringify({ relayer: relayer.address, balanceSepEth: formatEther(balance), targetSepEth: '0.05',
  endpoint: env.VITE_RELAYER_URL, configuration: 'root .env', mode: process.argv.includes('--fund') ? 'fund-if-needed' : 'plan' }, null, 2) + '\n');
if (!process.argv.includes('--fund')) process.exit(0);
const manifest = JSON.parse(readFileSync(resolve(rootPath, 'deployments/11155111.json'), 'utf8'));
if (manifest.status !== 'deployed' || manifest.chainId !== 11155111) throw new Error('Finish the Sepolia deployment first.');
const journalPath = resolve(rootPath, '.artifacts/relayer-funding.json');
let saved = existsSync(journalPath) ? JSON.parse(readFileSync(journalPath, 'utf8')) : undefined;
if (!saved && balance >= target) { process.stdout.write('Relayer already has its funding allowance.\n'); process.exit(0); }
if (!saved) {
  const nonce = await rpc.getTransactionCount({ address: deployer.address, blockTag: 'pending' });
  if (nonce !== await rpc.getTransactionCount({ address: deployer.address, blockTag: 'latest' })) throw new Error('Wait for deployer transactions to confirm.');
  const fees = await rpc.estimateFeesPerGas();
  if (fees.maxFeePerGas > parseGwei(env.NULL_MAX_FEE_GWEI || '10')) throw new Error('Funding fees exceed configured cap.');
  const chain = { id: 11155111, name: 'Sepolia', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [env.NULL_RPC_URL] } } };
  const wallet = createWalletClient({ account: deployer, chain, transport: http(env.NULL_RPC_URL) });
  const value = target - balance;
  const gas = await rpc.estimateGas({ account: deployer.address, to: relayer.address, value });
  if (await rpc.getBalance({ address: deployer.address }) < value + gas * fees.maxFeePerGas) throw new Error('Insufficient deployer balance.');
  const rawTransaction = await wallet.signTransaction({ account: deployer, chain, to: relayer.address, value, gas, nonce, ...fees });
  saved = { from: deployer.address, to: relayer.address, hash: keccak256(rawTransaction), rawTransaction };
  mkdirSync(resolve(rootPath, '.artifacts'), { recursive: true });
  writeFileSync(journalPath, JSON.stringify(saved, null, 2) + '\n', { flag: 'wx' });
}
const transaction = parseTransaction(saved.rawTransaction);
if (saved.from !== deployer.address || saved.to !== relayer.address || keccak256(saved.rawTransaction) !== saved.hash ||
  getAddress(await recoverTransactionAddress({ serializedTransaction: saved.rawTransaction })) !== deployer.address ||
  transaction.chainId !== 11155111 || getAddress(transaction.to) !== relayer.address || transaction.value > target || transaction.data)
  throw new Error('Funding journal does not match this local setup.');
let receipt;
try { receipt = await rpc.getTransactionReceipt({ hash: saved.hash }); }
catch (error) { if (error.name !== 'TransactionReceiptNotFoundError') throw error; }
if (!receipt) {
  let pending;
  try { pending = await rpc.getTransaction({ hash: saved.hash }); }
  catch (error) { if (error.name !== 'TransactionNotFoundError') throw error; }
  if (!pending) {
    if (transaction.maxFeePerGas > parseGwei(env.NULL_MAX_FEE_GWEI || '10')) throw new Error('Saved funding transaction exceeds fee cap.');
    if (await rpc.getTransactionCount({ address: deployer.address, blockTag: 'latest' }) > transaction.nonce) throw new Error('Funding nonce was consumed by another transaction.');
    await rpc.sendRawTransaction({ serializedTransaction: saved.rawTransaction });
  }
  process.stdout.write(`Waiting for relayer funding: ${saved.hash}\n`);
  receipt = await rpc.waitForTransactionReceipt({ hash: saved.hash, confirmations: 3, timeout: 180_000 });
}
if (receipt.status !== 'success') throw new Error('Relayer funding transaction failed.');
process.stdout.write(JSON.stringify({ status: 'funded', address: relayer.address, transactionHash: saved.hash,
  balanceSepEth: formatEther(await rpc.getBalance({ address: relayer.address })) }, null, 2) + '\n');
