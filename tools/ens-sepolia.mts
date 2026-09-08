/** Real Sepolia integration verification. Default is read-only; --broadcast creates/updates
 * only a dedicated ENS test namespace. Secrets remain in the protected, ignored root env.
 * No payroll transaction is submitted, and no existing recipient profile is used. */
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { readRootEnv, updateRootEnv } from '../contracts/scripts/env.mjs';
import { createPublicClient, createWalletClient, http, encodeFunctionData, keccak256, stringToHex, zeroAddress, zeroHash, parseEventLogs, ContractFunctionRevertedError, type Abi, type Address, type Hex } from '../apps/web/node_modules/viem/_esm/index.js';
import { privateKeyToAccount, generatePrivateKey } from '../apps/web/node_modules/viem/_esm/accounts/index.js';
import { sepolia } from '../apps/web/node_modules/viem/_esm/chains/index.js';
import { namehash, packetToBytes } from '../apps/web/node_modules/viem/_esm/ens/index.js';
import { profileFromKeys, fromHex, toHex, compileDistribution, scanEnvelopes } from '../packages/sdk/src/index.ts';
import { ENS_V2, PAYMENT_RECORD, PaymentNameError, resolvePaymentName, recheckPaymentNames, prepareProfileWrite, preparePaymentDelegate, paymentEditorAccess } from '../packages/ens/src/index.ts';

const broadcast = process.argv.includes('--broadcast');
const rpc = createPublicClient({ chain: sepolia, transport: http('https://ethereum-sepolia-rpc.publicnode.com', { timeout: 25_000, retryCount: 1 }), cacheTime: 0 });
const source = JSON.parse(await readFile('tools/ens/sepolia-contracts.json', 'utf8'));
const contracts = source.contracts as Record<string, { address: Address; abi: Abi }>;
const registrar = contracts.ETHRegistrar, registry = contracts.ETHRegistry, factory = contracts.VerifiableFactory, resolver = contracts.PermissionedResolverImpl, userRegistry = contracts.UserRegistryImpl, token = contracts.MockUSDC;
const statePath = '.artifacts/ens-sepolia-state.json';
type State = { name: string; resolver?: Address; registry?: Address; transactions: { step: string; hash: Hex; gasReserve: string }[]; reserved: string; completed?: boolean };
let state: State;
try { state = JSON.parse(await readFile(statePath, 'utf8')); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; state = { name: 'nullpay2026.eth', transactions: [], reserved: '0' }; }
let stage = 'read-only preflight';
const duration = 31_536_000n, maxFeePerGas = 2_000_000_000n, maxPriorityFeePerGas = 100_000_000n, budget = 15_000_000_000_000_000n;
const label = state.name.slice(0, -4), child = `receive.${state.name}`, alias = `pay.${state.name}`;
const read = (contract: {address: Address; abi: Abi}, functionName: string, args: unknown[] = []) => rpc.readContract({ ...contract, functionName, args });
async function save() { await mkdir('.artifacts', { recursive: true }); await writeFile(`${statePath}.tmp`, JSON.stringify(state, null, 2)); await rename(`${statePath}.tmp`, statePath); }

async function main() {
  assert.equal(await rpc.getChainId(), 11155111);
  for (const contract of Object.values(contracts)) assert.ok((await rpc.getCode({ address: contract.address }))?.length! > 2, 'Missing official ENSv2 deployment');
  const env = readRootEnv();
  const owner = privateKeyToAccount(env.NULL_DEPLOYER_PRIVATE_KEY as Hex);
  const available = await read(registrar, 'isAvailable', [label]);
  const balance = await rpc.getBalance({ address: owner.address });
  console.log(JSON.stringify({ mode: broadcast ? 'broadcast' : 'plan', chainId: 11155111, namespace: state.name, paymentName: child, owner: owner.address, available, alreadyStarted: state.transactions.length > 0, maxGasBudgetTestETH: '0.015', editorFundingTestETH: '0.0005', testEthBalanceAtomic: balance.toString(), registrationToken: 'Official ENS Sepolia MockUSDC (free mint, no monetary value)', actualPaymentBroadcast: false }, null, 2));
  if (!broadcast) {
    if (available) { const price = await read(registrar, 'getRegisterPrice', [label, duration, token.address]) as bigint[]; console.log(JSON.stringify({ registrationFeeAtomic: (price[0] + price[1]).toString() })); }
    if (state.completed) { const snapshot = await resolvePaymentName(rpc, child); console.log(JSON.stringify({ name: snapshot.name, fingerprint: snapshot.fingerprint, blockNumber: snapshot.blockNumber, liveResolution: true })); }
    return;
  }
  if (state.completed) { await resolvePaymentName(rpc, child); console.log('Existing ENS verification is complete; live name resolution passed. No new transactions sent.'); return; }
  assert.ok(available || state.transactions.length > 0, 'Namespace already exists without this local setup journal. Use pnpm ens:status; do not deploy duplicate infrastructure.');
  assert.ok(balance >= budget, 'Insufficient Sepolia funds for bounded ENS setup');
  const needed = ['NULL_ENS_COMMIT_SECRET', 'NULL_ENS_EDITOR_PRIVATE_KEY', 'NULL_ENS_SPEND_PRIVATE_KEY', 'NULL_ENS_VIEW_PRIVATE_KEY', 'NULL_ENS_ALT_VIEW_PRIVATE_KEY'];
  const updates: Record<string, string> = {};
  for (const key of needed) if (!env[key]) updates[key] = key === 'NULL_ENS_COMMIT_SECRET' ? `0x${randomBytes(32).toString('hex')}` : generatePrivateKey();
  if (Object.keys(updates).length) { assert.equal(state.transactions.length, 0, 'Cannot regenerate secrets for an existing run'); updateRootEnv(updates); }
  const secrets = readRootEnv();
  const editor = privateKeyToAccount(secrets.NULL_ENS_EDITOR_PRIVATE_KEY as Hex);
  const keys = { spendPrivateKey: fromHex(secrets.NULL_ENS_SPEND_PRIVATE_KEY), viewPrivateKey: fromHex(secrets.NULL_ENS_VIEW_PRIVATE_KEY) };
  const profile = profileFromKeys(keys).stealthMetaAddress;
  const alternate = profileFromKeys({ spendPrivateKey: keys.spendPrivateKey, viewPrivateKey: fromHex(secrets.NULL_ENS_ALT_VIEW_PRIVATE_KEY) }).stealthMetaAddress;
  const ownerWallet = createWalletClient({ account: owner, chain: sepolia, transport: http(rpc.transport.url, { retryCount: 0 }) });
  const editorWallet = createWalletClient({ account: editor, chain: sepolia, transport: http(rpc.transport.url, { retryCount: 0 }) });

  async function send(step: string, to: Address, data: Hex, useEditor = false, value = 0n) {
    stage = step;
    const existing = state.transactions.find(item => item.step === step);
    if (existing) { const receipt = await rpc.waitForTransactionReceipt({ hash: existing.hash, confirmations: 2, timeout: 90_000 }); assert.equal(receipt.status, 'success', `Previously submitted ${step} reverted`); return receipt; }
    const wallet = useEditor ? editorWallet : ownerWallet;
    const estimate = await rpc.estimateGas({ account: wallet.account.address, to, data, value });
    const gas = estimate * 125n / 100n;
    const reserve = gas * maxFeePerGas;
    assert.ok(BigInt(state.reserved) + reserve <= budget, 'ENS gas cap reached');
    assert.ok((await rpc.getBlock()).baseFeePerGas! < maxFeePerGas - maxPriorityFeePerGas, 'ENS fee cap reached');
    const request = await wallet.prepareTransactionRequest({ to, data, value, gas, maxFeePerGas, maxPriorityFeePerGas });
    const serialized = await wallet.signTransaction(request);
    const hash = keccak256(serialized);
    // Store the hash BEFORE broadcast. On any ambiguous failure, later runs reconcile
    // this exact transaction; they never sign a duplicate or increment nonce blindly.
    state.transactions.push({ step, hash, gasReserve: reserve.toString() }); state.reserved = (BigInt(state.reserved) + reserve).toString(); await save();
    console.log(`${step}: submitted ${hash}`);
    await rpc.sendRawTransaction({ serializedTransaction: serialized });
    const receipt = await rpc.waitForTransactionReceipt({ hash, confirmations: 2, timeout: 90_000 });
    assert.equal(receipt.status, 'success', `${step} reverted`); return receipt;
  }
  const encode = (contract: {abi: Abi}, functionName: string, args: unknown[] = []) => encodeFunctionData({ abi: contract.abi, functionName, args });
  const both = (roles: bigint) => roles | (roles << 128n);
  async function proxy(step: string, implementation: Address, initialization: Hex) {
    const salt = BigInt(keccak256(stringToHex(`NULL ENSv2 ${state.name} ${step} ${owner.address}`)));
    const receipt = await send(step, factory.address, encode(factory, 'deployProxy', [implementation, salt, initialization]));
    const logs = parseEventLogs({ abi: factory.abi, logs: receipt.logs, eventName: 'ProxyDeployed' });
    const args = logs[0]?.args as unknown as Record<string, Address>;
    assert.ok(args?.proxyAddress, 'No proxy address in deployment receipt'); return args.proxyAddress;
  }
  if (!state.resolver) { state.resolver = await proxy('deploy-resolver', resolver.address, encode(resolver, 'initialize', [owner.address, both((1n << 4n) | (1n << 28n) | (1n << 124n)), []])); await save(); }
  if (!state.registry) { state.registry = await proxy('deploy-subregistry', userRegistry.address, encode(userRegistry, 'initialize', [owner.address, both(1n | (1n << 8n))])); await save(); }
  assert.equal((await read(factory, 'verifyContract', [state.resolver]) as string).toLowerCase(), ENS_V2.resolverImplementation);
  const localRegistry = { address: state.registry, abi: userRegistry.abi };
  await send('set-registry-parent', localRegistry.address, encode(localRegistry, 'setParent', [registry.address, label]));
  if (available) {
    const price = await read(registrar, 'getRegisterPrice', [label, duration, token.address]) as bigint[];
    const fee = price[0] + price[1]; assert.ok(fee <= 10_000_000n, 'ENS registration fee exceeds 10 official test USDC');
    await send('mint-registration-test-token', token.address, encode(token, 'mint', [owner.address, 10_000_000n]));
    await send('approve-registration-fee', token.address, encode(token, 'approve', [registrar.address, 10_000_000n]));
    const commitmentArgs = [label, owner.address, secrets.NULL_ENS_COMMIT_SECRET, state.registry, state.resolver, duration, zeroHash];
    const commitment = await read(registrar, 'makeCommitment', commitmentArgs);
    await send('commit-name', registrar.address, encode(registrar, 'commit', [commitment]));
    const committedAt = await read(registrar, 'commitmentAt', [commitment]) as bigint;
    const minAge = await read(registrar, 'MIN_COMMITMENT_AGE') as bigint;
    console.log('Waiting for the ENS commit-reveal interval…');
    while ((await rpc.getBlock()).timestamp < committedAt + minAge + 1n) await new Promise(resolve => setTimeout(resolve, 10_000));
    await send('register-name', registrar.address, encode(registrar, 'register', [...commitmentArgs.slice(0, 6), token.address, zeroHash]));
  }
  await send('clear-registration-allowance', token.address, encode(token, 'approve', [registrar.address, 0n]));
  const parentState = await read(registry, 'getState', [BigInt(keccak256(stringToHex(label)))]) as {latestOwner: Address; expiry: bigint};
  assert.equal(parentState.latestOwner.toLowerCase(), owner.address.toLowerCase(), 'Namespace is not owned by this signer');
  assert.equal((await read(registry, 'getSubregistry', [label]) as string).toLowerCase(), state.registry.toLowerCase());
  assert.equal((await read(registry, 'getResolver', [label]) as string).toLowerCase(), state.resolver.toLowerCase());
  const childRoles = both((1n << 20n) | (1n << 24n)) | (1n << 156n);
  await send('register-recipient-subname', localRegistry.address, encode(localRegistry, 'register', ['receive', owner.address, zeroAddress, state.resolver, childRoles, parentState.expiry]));
  const delegation = await preparePaymentDelegate(rpc, child, editor.address, true, owner.address, state.resolver);
  await send('delegate-payment-record', state.resolver, encodeFunctionData(delegation.request));
  if (!state.transactions.some(item => item.step === 'fund-record-editor')) await send('fund-record-editor', editor.address, '0x', false, 500_000_000_000_000n);
  const firstWrite = await prepareProfileWrite(rpc, child, profile, editor.address, state.resolver);
  await send('publish-payment-record', state.resolver, encodeFunctionData(firstWrite.request), true);
  const original = await resolvePaymentName(rpc, child);
  assert.equal(original.profile, profile);
  const access = await paymentEditorAccess(rpc, child, editor.address); assert.deepEqual(access, {allowed: true, broaderAccess: false, recordAccess: true});
  const forbidden: string[] = [];
  async function mustRevert(label: string, functionName: string, args: unknown[]) {
    try { await rpc.simulateContract({ address: state.resolver!, abi: resolver.abi, functionName, args, account: editor.address }); }
    catch (error) {
      const reverted = (error as {walk?: (fn: (value: unknown) => boolean) => unknown}).walk?.(value => value instanceof ContractFunctionRevertedError);
      assert.ok(reverted && (reverted as ContractFunctionRevertedError).data?.errorName?.startsWith('EAC'), 'Expected EAC contract rejection, not a transport failure'); forbidden.push(label); return;
    }
    throw new Error(`Forbidden operation succeeded: ${label}`);
  }
  await mustRevert('different text key', 'setText', [namehash(child), 'avatar', 'https://example.invalid/avatar']);
  await mustRevert('different name', 'setText', [namehash(state.name), PAYMENT_RECORD, profile]);
  await mustRevert('wallet address record', 'setAddr', [namehash(child), editor.address]);
  await mustRevert('delegate admin escalation', 'authorizeTextRoles', [toHex(packetToBytes(child)), PAYMENT_RECORD, owner.address, true]);
  const rotation = await prepareProfileWrite(rpc, child, alternate, editor.address, state.resolver);
  await send('rotate-payment-record', state.resolver, encodeFunctionData(rotation.request), true);
  await assert.rejects(recheckPaymentNames(rpc, [original]), error => error instanceof PaymentNameError && error.code === 'changed');
  const restore = await prepareProfileWrite(rpc, child, profile, editor.address, state.resolver);
  await send('restore-payment-record', state.resolver, encodeFunctionData(restore.request), true);
  await send('create-payment-alias', state.resolver, encode(resolver, 'setAlias', [toHex(packetToBytes(alias)), toHex(packetToBytes(child))]));
  assert.equal((await resolvePaymentName(rpc, alias)).profile, profile);
  await assert.rejects(prepareProfileWrite(rpc, alias, profile, owner.address, state.resolver), error => error instanceof PaymentNameError && error.code === 'alias');
  const revoked = await preparePaymentDelegate(rpc, child, editor.address, false, owner.address, state.resolver);
  await send('revoke-payment-record-access', state.resolver, encodeFunctionData(revoked.request));
  await mustRevert('write after revocation', 'setText', [namehash(child), PAYMENT_RECORD, alternate]);
  assert.equal((await paymentEditorAccess(rpc, child, editor.address)).allowed, false);
  const resolved = await resolvePaymentName(rpc, child);
  const deployment = JSON.parse(await readFile('apps/web/public/deployment.json', 'utf8'));
  const context = { chainId: 11155111n, poolAddress: deployment.contracts.nullPool as Hex };
  const compiled = await compileDistribution({ context, recipients: [{ employeeRef: 'ENS integration verification', amountAtomic: 100_000n, stealthMetaAddress: resolved.profile }] });
  // Real local cryptography over a live ENS result; this is not an onchain payment receipt.
  const discovered = await scanEnvelopes({ envelopes: compiled.envelopes, distributions: [compiled.publicBundle], keys, context, source: 'local' });
  assert.equal(discovered.length, 1); assert.equal(discovered[0].amountAtomic, 100_000n);
  for (const allocation of discovered) allocation.stealthPrivateKey.fill(0);
  keys.spendPrivateKey.fill(0); keys.viewPrivateKey.fill(0);
  state.completed = true; await save();
  await writeFile('deployments/ens-sepolia.json', JSON.stringify({ version: 1, chainId: 11155111, verifiedAt: new Date().toISOString(), sourceRevision: ENS_V2.sourceRevision, namespace: state.name, paymentName: child, alias, owner: owner.address, editor: editor.address, editorAccessAfterVerification: 'revoked', registry: state.registry, resolver: state.resolver, recordKey: PAYMENT_RECORD, profileFingerprint: resolved.fingerprint, lastVerifiedBlock: resolved.blockNumber, transactions: state.transactions.map(({step,hash}) => ({step,hash})), checks: { scopedRecordWrite: true, forbiddenOperationsRejected: forbidden, changedDestinationBlocked: true, aliasResolution: true, aliasWriteBlocked: true, liveNameToEncryptedAllocationDiscovery: true, onchainPayment: false } }, null, 2) + '\n');
  console.log(JSON.stringify({ completed: true, paymentName: child, alias, resolver: state.resolver, blockedOperations: forbidden, liveNameToEncryptedAllocationDiscovery: true, paymentTransactionBroadcast: false }));
}
try { await main(); } catch (error) { console.error(`ENS verification stopped during ${stage}. No secret values are logged. ${error instanceof PaymentNameError ? error.message : error instanceof assert.AssertionError ? error.message.split('\n')[0] : 'Inspect the saved transaction hashes and chain state before retrying.'}`); process.exitCode = 1; }
