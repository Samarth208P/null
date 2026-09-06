import { Buffer } from 'node:buffer';
import type { Address, Hex } from 'viem';
import { createPrivyAuthorizationRequest, verifyPrivyIntentSignature, type AuthorizationRequest, type CompiledIntentContext } from './index.js';

export interface PrivyOrganizationConfig {
  appId: string;
  appSecret: string;
  walletId: string;
  walletAddress: Address;
  ownerQuorumId: string;
  requiredPolicyIds: readonly string[];
  /** The organization entity assigned to this business treasury wallet. */
  organizationEntityId: string;
  minimumApprovals: number;
  chainId: bigint;
  poolAddress: Address;
}
/** Server-only adapter. Hosts must authenticate organization membership before invoking it. */
export function createPrivyOrganizationAuthorizer(config: PrivyOrganizationConfig) {
  if (!config.appSecret || !config.appId || !config.ownerQuorumId || !config.organizationEntityId || !config.requiredPolicyIds.length || !Number.isSafeInteger(config.minimumApprovals) || config.minimumApprovals < 1) throw new Error('NULL_PRIVY_CONFIG_REQUIRED');
  const headers = { 'privy-app-id': config.appId, Authorization: `Basic ${Buffer.from(`${config.appId}:${config.appSecret}`).toString('base64')}` };
  async function request(path: string, init: RequestInit = {}) {
    const response = await fetch(`https://api.privy.io/v1/${path}`, { ...init, headers: { ...headers, ...init.headers }, redirect: 'error', signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error('NULL_PRIVY_AUTH_FAILED');
    return response.json();
  }
  async function verifyWalletControl() {
    const wallet = await request(`wallets/${encodeURIComponent(config.walletId)}`) as { id: string; address: string; chain_type: string; owner_id: string; policy_ids: string[]; entity?: { id: string }; archived_at?: number | null; additional_signers?: unknown[]; authorization_threshold?: number; public_key?: string };
    if (wallet.chain_type !== 'ethereum' || wallet.address.toLowerCase() !== config.walletAddress.toLowerCase() || wallet.owner_id !== config.ownerQuorumId || wallet.entity?.id !== config.organizationEntityId || wallet.archived_at || !config.requiredPolicyIds.every(policy => wallet.policy_ids.includes(policy))) throw new Error('NULL_PRIVY_CONTROL_MISMATCH');
    // A bypass signer can defeat the declared quorum; require an owner-only treasury.
    if (wallet.additional_signers?.length) throw new Error('NULL_PRIVY_CONTROL_MISMATCH');
    const quorum = await request(`key_quorums/${encodeURIComponent(config.ownerQuorumId)}`) as { id: string; authorization_threshold: number | null };
    if (quorum.id !== config.ownerQuorumId || !Number.isSafeInteger(quorum.authorization_threshold) || Number(quorum.authorization_threshold) !== config.minimumApprovals) throw new Error('NULL_PRIVY_CONTROL_MISMATCH');
    return wallet;
  }
  return {
    verifyWalletControl,
    async prepare(publicInputs: readonly Hex[], expected: CompiledIntentContext): Promise<AuthorizationRequest> {
      if (expected.chainId !== config.chainId || expected.poolAddress.toLowerCase() !== config.poolAddress.toLowerCase()) throw new Error('NULL_CONTEXT_MISMATCH');
      await verifyWalletControl();
      return createPrivyAuthorizationRequest({ appId: config.appId, walletId: config.walletId, publicInputs, expected });
    },
    async authorize(options: { publicInputs: readonly Hex[]; expected: CompiledIntentContext; requestExpiryMs: number; signatures: readonly string[] }) {
      if (options.expected.chainId !== config.chainId || options.expected.poolAddress.toLowerCase() !== config.poolAddress.toLowerCase()) throw new Error('NULL_CONTEXT_MISMATCH');
      if (options.signatures.length < config.minimumApprovals || options.signatures.length > 20 || new Set(options.signatures).size !== options.signatures.length || options.signatures.some(signature => signature.length > 8_192 || !/^[A-Za-z0-9+/_=:-]+$/.test(signature))) throw new Error('NULL_PRIVY_APPROVALS_REQUIRED');
      await verifyWalletControl();
      // Rebuild the exact request. The host cannot supply another URL, wallet, method or digest.
      const canonical = await createPrivyAuthorizationRequest({ appId: config.appId, walletId: config.walletId, publicInputs: options.publicInputs, expected: options.expected, requestExpiryMs: options.requestExpiryMs });
      const result = await request(`wallets/${encodeURIComponent(config.walletId)}/rpc`, { method: 'POST', headers: { 'content-type': 'application/json', ...canonical.headers, 'privy-authorization-signature': options.signatures.join(',') }, body: JSON.stringify(canonical.body) }) as { method: string; data?: { encoding: string; signature: Hex } };
      if (result.method !== 'secp256k1_sign' || result.data?.encoding !== 'hex') throw new Error('NULL_PRIVY_AUTH_FAILED');
      return verifyPrivyIntentSignature(canonical.body.params.hash, result.data.signature, config.walletAddress);
    },
  };
}
