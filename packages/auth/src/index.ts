import { recoverAddress, recoverPublicKey, toHex, type Address, type Hex } from 'viem';
import { publicKeyToAddress } from 'viem/accounts';
import { distributionIntentDigest, secp256k1, fromHex } from '@null-protocol/sdk';

export interface CompiledIntentContext {
  chainId: bigint;
  poolAddress: Address;
  commitment: Hex;
  envelopeRoot: Hex;
}
export interface AuthorizationRequest {
  version: 1;
  method: 'POST';
  url: string;
  headers: { 'privy-app-id': string; 'privy-request-expiry': string };
  body: { method: 'secp256k1_sign'; params: { hash: Hex } };
}
const FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const ORDER = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
export function validateDistributionIntent(publicInputs: readonly Hex[], expected: CompiledIntentContext, nowSeconds = BigInt(Math.floor(Date.now() / 1000))) {
  if (publicInputs.length !== 15 || publicInputs.some(input => !/^0x[0-9a-fA-F]{64}$/.test(input) || BigInt(input) >= FIELD)) throw new Error('NULL_CONTEXT_MISMATCH');
  if (BigInt(publicInputs[0]) !== 1n || BigInt(publicInputs[1]) !== expected.chainId || BigInt(publicInputs[2]) !== BigInt(expected.poolAddress) || BigInt(publicInputs[7]) !== BigInt(expected.commitment)) throw new Error('NULL_CONTEXT_MISMATCH');
  const envelope = (BigInt(publicInputs[8]) << 128n) | BigInt(publicInputs[9]);
  if (BigInt(publicInputs[8]) >= 1n << 128n || BigInt(publicInputs[9]) >= 1n << 128n || envelope !== BigInt(expected.envelopeRoot)) throw new Error('NULL_CRE_COMPILE_MISMATCH');
  if (BigInt(publicInputs[14]) <= nowSeconds || BigInt(publicInputs[14]) > nowSeconds + 86_400n) throw new Error('NULL_INTENT_EXPIRED');
}
export async function createPrivyAuthorizationRequest(options: {
  appId: string; walletId: string; publicInputs: readonly Hex[]; expected: CompiledIntentContext; requestExpiryMs?: number;
}): Promise<AuthorizationRequest> {
  validateDistributionIntent(options.publicInputs, options.expected);
  if (!/^[a-zA-Z0-9_-]+$/.test(options.walletId) || !options.appId) throw new Error('NULL_PRIVY_AUTH_FAILED');
  const now = Date.now();
  const expiry = options.requestExpiryMs ?? now + 120_000;
  if (!Number.isSafeInteger(expiry) || expiry <= now || expiry > now + 300_000 || BigInt(expiry) > BigInt(options.publicInputs[14]) * 1000n) throw new Error('NULL_INTENT_EXPIRED');
  return {
    version: 1, method: 'POST', url: `https://api.privy.io/v1/wallets/${options.walletId}/rpc`,
    headers: { 'privy-app-id': options.appId, 'privy-request-expiry': String(expiry) },
    body: { method: 'secp256k1_sign', params: { hash: await distributionIntentDigest(options.publicInputs) } },
  };
}
/** This result is a private circuit witness. Never attach it to relay payloads or logs. */
export async function verifyPrivyIntentSignature(digest: Hex, signature: Hex, expectedSigner: Address) {
  if (!/^0x[0-9a-fA-F]{130}$/.test(signature)) throw new Error('NULL_PRIVY_AUTH_FAILED');
  const signer = await recoverAddress({ hash: digest, signature });
  if (signer.toLowerCase() !== expectedSigner.toLowerCase()) throw new Error('NULL_PRIVY_AUTH_FAILED');
  const publicKey = await recoverPublicKey({ hash: digest, signature });
  const r = signature.slice(2, 66); const s = BigInt(`0x${signature.slice(66, 130)}`);
  if (s === 0n || s >= ORDER) throw new Error('NULL_PRIVY_AUTH_FAILED');
  const compactSignature = `0x${r}${toHex(s > ORDER / 2n ? ORDER - s : s, { size: 32 }).slice(2)}` as Hex;
  return { digest, signer, publicKey, compactSignature };
}

export interface OrganizationAuthorizationResult { digest: Hex; signer: Address; publicKey: Hex; compactSignature: Hex }
/** Browser adapter: no rows, employee references, keys or private witness fields are accepted. */
export async function authorizeOrganizationDistribution(options: {
  endpoint: string;
  appId: string;
  expectedSigner: Address;
  publicInputs: readonly Hex[];
  expected: CompiledIntentContext;
  getAccessToken: () => Promise<string | null>;
  generateAuthorizationSignature: (request: AuthorizationRequest) => Promise<string | { signature: string }>;
  /** Obtain other approvers' signatures over the identical prepared request when quorum > 1. */
  collectAdditionalSignatures?: (request: AuthorizationRequest, approvalsStillNeeded: number) => Promise<readonly string[]>;
}): Promise<OrganizationAuthorizationResult> {
  validateDistributionIntent(options.publicInputs, options.expected);
  const endpoint = new URL(options.endpoint);
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash || (endpoint.protocol !== 'https:' && !(['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname) && endpoint.protocol === 'http:'))) throw new Error('NULL_ORGANIZATION_CONFIG_REQUIRED');
  const base = endpoint.href.replace(/\/$/, '');
  const post = async (path: string, body: unknown) => {
    const token = await options.getAccessToken();
    if (!token) throw new Error('NULL_SESSION_REQUIRED');
    const response = await fetch(`${base}${path}`, { method: 'POST', credentials: 'omit', redirect: 'error', headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
    const data = await response.json() as Record<string, unknown>;
    if (!response.ok) throw new Error(typeof data.code === 'string' && /^NULL_[A-Z_]+$/.test(data.code) ? data.code : 'NULL_ORGANIZATION_UNAVAILABLE');
    return data;
  };
  const prepared = await post('/api/organization/prepare', { publicInputs: options.publicInputs, expected: { chainId: options.expected.chainId.toString(), poolAddress: options.expected.poolAddress, commitment: options.expected.commitment, envelopeRoot: options.expected.envelopeRoot } });
  const request = prepared.authorizationRequest as AuthorizationRequest;
  const digest = await distributionIntentDigest(options.publicInputs);
  const expiry = Number(request?.headers?.['privy-request-expiry']);
  if (typeof prepared.ticket !== 'string' || typeof prepared.walletAddress !== 'string' || prepared.walletAddress.toLowerCase() !== options.expectedSigner.toLowerCase() || !Number.isSafeInteger(prepared.minimumApprovals) || Number(prepared.minimumApprovals) < 1 || Number(prepared.minimumApprovals) > 20 || request?.version !== 1 || request?.method !== 'POST' || !/^https:\/\/api\.privy\.io\/v1\/wallets\/[a-zA-Z0-9_-]+\/rpc$/.test(request.url) || request.headers?.['privy-app-id'] !== options.appId || request.body?.method !== 'secp256k1_sign' || request.body.params?.hash !== digest || !Number.isSafeInteger(expiry) || expiry <= Date.now() || expiry > Date.now() + 300_000 || BigInt(expiry) > BigInt(options.publicInputs[14]) * 1000n) throw new Error('NULL_CONTEXT_MISMATCH');
  // Prevent injected fields from obtaining approval for a broader/different Privy operation.
  if (Object.keys(request).some(key => !['version', 'method', 'url', 'headers', 'body'].includes(key)) || Object.keys(request.headers).some(key => !['privy-app-id', 'privy-request-expiry'].includes(key)) || Object.keys(request.body).some(key => !['method', 'params'].includes(key)) || Object.keys(request.body.params).some(key => key !== 'hash')) throw new Error('NULL_CONTEXT_MISMATCH');
  if (Number(prepared.minimumApprovals) > 1 && !options.collectAdditionalSignatures) throw new Error('NULL_PRIVY_APPROVALS_REQUIRED');
  const generated = await options.generateAuthorizationSignature(request);
  const signature = typeof generated === 'string' ? generated : generated.signature;
  const additional = options.collectAdditionalSignatures ? await options.collectAdditionalSignatures(request, Number(prepared.minimumApprovals) - 1) : [];
  const result = await post('/api/organization/authorize', { ticket: prepared.ticket, signatures: [signature, ...additional] }) as unknown as OrganizationAuthorizationResult;
  if (result.digest !== digest || typeof result.signer !== 'string' || result.signer.toLowerCase() !== options.expectedSigner.toLowerCase() || !/^0x04[0-9a-fA-F]{128}$/.test(result.publicKey) || publicKeyToAddress(result.publicKey).toLowerCase() !== options.expectedSigner.toLowerCase() || !/^0x[0-9a-fA-F]{128}$/.test(result.compactSignature) || !secp256k1.verify(fromHex(result.compactSignature), fromHex(digest), fromHex(result.publicKey), { prehash: false, lowS: true })) throw new Error('NULL_PRIVY_AUTH_FAILED');
  return result;
}
