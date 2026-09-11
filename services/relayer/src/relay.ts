import { createPublicClient, createWalletClient, encodeFunctionData, http, keccak256, parseAbi, type Address, type Hex } from 'viem';
import { privateKeyToAccount, nonceManager } from 'viem/accounts';
import { nullPoolAbi } from '@null-protocol/contracts';

const FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
export interface RelayEnvelope { ephemeralPubKey: Hex; viewTag: Hex; ciphertext: Hex }
export interface RelayPayload { chainId: number; pool: Address; method: 'claim' | 'createDistribution' | 'withdraw' | 'withdrawPartial'; proof: Hex; publicInputs: Hex[]; envelopes?: RelayEnvelope[] }
export interface RelayManifest {
  status: string;
  chainId: number;
  contracts: { nullPool: Address; claimVerifier: Address; createDistributionVerifier: Address; withdrawVerifier?: Address; partialWithdrawVerifier?: Address };
  asset: { address: Address };
  codeHashes: { nullPool: Hex; claimVerifier: Hex; createDistributionVerifier: Hex; withdrawVerifier?: Hex; partialWithdrawVerifier?: Hex };
}
export class RelayError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}
function exactKeys(value: unknown, keys: string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) throw new RelayError('NULL_PAYLOAD_REJECTED');
}
function hex(value: unknown, bytes?: number): asserts value is Hex {
  if (typeof value !== 'string' || !/^0x(?:[0-9a-fA-F]{2})+$/.test(value) || (bytes !== undefined && value.length !== bytes * 2 + 2)) throw new RelayError('NULL_PAYLOAD_REJECTED');
}
/** Reject extras at every nesting level; never forward arbitrary calldata or metadata. */
export function validateRelayPayload(value: unknown): RelayPayload {
  exactKeys(value, ['chainId', 'pool', 'method', 'proof', 'publicInputs', 'envelopes']);
  if (!Number.isSafeInteger(value.chainId) || Number(value.chainId) <= 0) throw new RelayError('NULL_CONTEXT_MISMATCH');
  hex(value.pool, 20); hex(value.proof);
  if (value.proof.length > 262_146 || value.proof.length < 66) throw new RelayError('NULL_PAYLOAD_REJECTED');
  if (value.method !== 'claim' && value.method !== 'createDistribution' && value.method !== 'withdraw' && value.method !== 'withdrawPartial') throw new RelayError('NULL_METHOD_REJECTED');
  if (!Array.isArray(value.publicInputs) || value.publicInputs.length !== (value.method === 'claim' ? 8 : value.method === 'withdraw' ? 10 : value.method === 'withdrawPartial' ? 11 : 15)) throw new RelayError('NULL_PAYLOAD_REJECTED');
  for (const input of value.publicInputs) { hex(input, 32); if (BigInt(input) >= FIELD) throw new RelayError('NULL_PAYLOAD_REJECTED'); }
  if (BigInt(value.publicInputs[0]) !== 1n || BigInt(value.publicInputs[1]) !== BigInt(Number(value.chainId)) || BigInt(value.publicInputs[2]) !== BigInt(value.pool)) throw new RelayError('NULL_CONTEXT_MISMATCH');
  if (value.method !== 'createDistribution' && value.envelopes !== undefined) throw new RelayError('NULL_PAYLOAD_REJECTED');
  if (value.method === 'createDistribution') {
    if (!Array.isArray(value.envelopes) || value.envelopes.length !== 8) throw new RelayError('NULL_PAYLOAD_REJECTED');
    for (const envelope of value.envelopes) {
      exactKeys(envelope, ['ephemeralPubKey', 'viewTag', 'ciphertext']);
      hex(envelope.ephemeralPubKey, 33); hex(envelope.viewTag, 1); hex(envelope.ciphertext, 540);
      if (!/^0x0[23]/.test(envelope.ephemeralPubKey)) throw new RelayError('NULL_PAYLOAD_REJECTED');
    }
  }
  return value as unknown as RelayPayload;
}
const partialAbi = parseAbi(['function withdrawPartial(bytes proof, bytes32[] inputs)', 'function partialWithdrawVerifier() view returns (address)', 'function partialWithdrawVerifierCodeHash() view returns (bytes32)']);
export function exportSelfBroadcast(value: unknown) {
  const payload = validateRelayPayload(value);
  type EightEnvelopes = [RelayEnvelope, RelayEnvelope, RelayEnvelope, RelayEnvelope, RelayEnvelope, RelayEnvelope, RelayEnvelope, RelayEnvelope];
  const data = payload.method === 'withdrawPartial' ? encodeFunctionData({ abi: partialAbi, functionName: 'withdrawPartial', args: [payload.proof, payload.publicInputs] }) : payload.method !== 'createDistribution'
    ? encodeFunctionData({ abi: nullPoolAbi, functionName: payload.method, args: [payload.proof, payload.publicInputs] })
    : encodeFunctionData({ abi: nullPoolAbi, functionName: 'createDistribution', args: [payload.proof, payload.publicInputs, payload.envelopes as EightEnvelopes] });
  return { chainId: payload.chainId, to: payload.pool, value: '0x0', data, method: payload.method };
}
export function createRelayer(config: { manifest: RelayManifest; rpcUrl: string; privateKey: Hex; maxGas?: bigint }) {
  const manifest = config.manifest;
  if (manifest.status !== 'deployed') throw new RelayError('NULL_DEPLOYMENT_UNAVAILABLE', 503);
  for (const value of Object.values(manifest.contracts)) hex(value, 20);
  for (const name of ['nullPool', 'claimVerifier', 'createDistributionVerifier'] as const) hex(manifest.codeHashes?.[name], 32);
  hex(manifest.asset.address, 20);
  const rpc = createPublicClient({ transport: http(config.rpcUrl, { timeout: 15_000, retryCount: 1 }) });
  const account = privateKeyToAccount(config.privateKey, { nonceManager });
  const wallet = createWalletClient({ account, transport: http(config.rpcUrl) });
  type ReadFunction = 'ASSET' | 'claimVerifier' | 'createDistributionVerifier' | 'claimVerifierCodeHash' | 'createDistributionVerifierCodeHash' | 'isKnownNoteRoot' | 'isKnownDistributionRoot' | 'spentClaimNullifier' | 'spentNoteNullifier';
  const read = (functionName: ReadFunction, args: [] | [bigint] = []) => rpc.readContract({ address: manifest.contracts.nullPool, abi: nullPoolAbi, functionName, args });
  async function verifyDeployment() {
    if (await rpc.getChainId() !== manifest.chainId) throw new RelayError('NULL_CONTEXT_MISMATCH', 503);
    if (manifest.contracts.partialWithdrawVerifier) {
      const verifier = manifest.contracts.partialWithdrawVerifier;
      const code = await rpc.getCode({ address: verifier });
      const address = await rpc.readContract({ address: manifest.contracts.nullPool, abi: partialAbi, functionName: 'partialWithdrawVerifier' });
      const hash = await rpc.readContract({ address: manifest.contracts.nullPool, abi: partialAbi, functionName: 'partialWithdrawVerifierCodeHash' });
      if (!code || keccak256(code) !== manifest.codeHashes.partialWithdrawVerifier || address.toLowerCase() !== verifier.toLowerCase() || hash !== manifest.codeHashes.partialWithdrawVerifier) throw new RelayError('NULL_VERIFIER_MISMATCH', 503);
    }
    if (manifest.contracts.withdrawVerifier) {
      const code = await rpc.getCode({address:manifest.contracts.withdrawVerifier});
      if (!code || keccak256(code) !== manifest.codeHashes.withdrawVerifier || String(await rpc.readContract({address:manifest.contracts.nullPool,abi:nullPoolAbi,functionName:'withdrawVerifier'})).toLowerCase() !== manifest.contracts.withdrawVerifier.toLowerCase() || await rpc.readContract({address:manifest.contracts.nullPool,abi:nullPoolAbi,functionName:'withdrawVerifierCodeHash'}) !== manifest.codeHashes.withdrawVerifier) throw new RelayError('NULL_VERIFIER_MISMATCH',503);
    }
    for (const name of ['nullPool', 'claimVerifier', 'createDistributionVerifier'] as const) {
      const code = await rpc.getCode({ address: manifest.contracts[name] });
      if (!code || code === '0x' || keccak256(code).toLowerCase() !== manifest.codeHashes[name].toLowerCase()) throw new RelayError('NULL_VERIFIER_MISMATCH', 503);
    }
    if (String(await read('ASSET')).toLowerCase() !== manifest.asset.address.toLowerCase()) throw new RelayError('NULL_CONTEXT_MISMATCH', 503);
    for (const name of ['claimVerifier', 'createDistributionVerifier'] as const) {
      if (String(await read(name)).toLowerCase() !== manifest.contracts[name].toLowerCase() || String(await read(`${name}CodeHash`)).toLowerCase() !== manifest.codeHashes[name].toLowerCase()) throw new RelayError('NULL_VERIFIER_MISMATCH', 503);
    }
  }
  let queue = Promise.resolve();
  let inFlight = 0;
  const pending = new Map<string, Promise<{ transactionHash: Hex; status: 'submitted' }>>();
  return {
    account: account.address,
    verifyDeployment,
    relay(value: unknown) {
      const payload = validateRelayPayload(value);
      if (payload.chainId !== manifest.chainId || payload.pool.toLowerCase() !== manifest.contracts.nullPool.toLowerCase()) throw new RelayError('NULL_CONTEXT_MISMATCH');
      if (payload.method === 'withdrawPartial' && (!manifest.contracts.partialWithdrawVerifier || !manifest.codeHashes.partialWithdrawVerifier)) throw new RelayError('NULL_METHOD_REJECTED');
      if (payload.method === 'withdraw' && (!manifest.contracts.withdrawVerifier || !manifest.codeHashes.withdrawVerifier)) throw new RelayError('NULL_METHOD_REJECTED');
      const transaction = exportSelfBroadcast(payload);
      const id = keccak256(transaction.data);
      const existing = pending.get(id);
      if (existing) return existing;
      if (inFlight >= 50) throw new RelayError('NULL_RELAY_BUSY', 503);
      inFlight++;
      const execute = async () => {
        await verifyDeployment();
        const latest = await rpc.getBlock();
        if (BigInt(payload.publicInputs.at(-1)!) <= latest.timestamp) throw new RelayError('NULL_INTENT_EXPIRED');
        const rootGetter = payload.method === 'claim' ? 'isKnownDistributionRoot' : 'isKnownNoteRoot';
        if (!await read(rootGetter, [BigInt(payload.publicInputs[3])])) throw new RelayError('NULL_ROOT_STALE', 409);
        if (payload.method === 'claim') {
          if (await read('spentClaimNullifier', [BigInt(payload.publicInputs[4])])) throw new RelayError('NULL_NULLIFIER_SPENT', 409);
        } else {
          for (const index of payload.method === 'withdraw' || payload.method === 'withdrawPartial' ? [5] : [5, 6]) if (await read('spentNoteNullifier', [BigInt(payload.publicInputs[index])])) throw new RelayError('NULL_NULLIFIER_SPENT', 409);
        }
        // eth_call executes the actual immutable pool verifier with the exact bound calldata.
        try { await rpc.call({ account: account.address, to: transaction.to, data: transaction.data }); } catch { throw new RelayError('NULL_PROOF_INVALID', 422); }
        const gas = await rpc.estimateGas({ account: account.address, to: transaction.to, data: transaction.data });
        const paddedGas = gas * 120n / 100n;
        if (paddedGas > (config.maxGas ?? 3_000_000n)) throw new RelayError('NULL_GAS_LIMIT', 422);
        const transactionHash = await wallet.sendTransaction({ chain: null, to: transaction.to, data: transaction.data, value: 0n, gas: paddedGas });
        return { transactionHash, status: 'submitted' as const };
      };
      const result = queue.then(execute);
      queue = result.then(() => undefined, () => undefined);
      pending.set(id, result);
      // Keep a small public-only idempotency cache; never retain request bodies or proofs.
      void result.then(() => { inFlight--; if (pending.size > 1_000) pending.delete(pending.keys().next().value!); }, () => { inFlight--; pending.delete(id); });
      return result;
    },
  };
}
