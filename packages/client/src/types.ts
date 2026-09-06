import type { Address, Hex, TransactionReceipt, WalletClient } from 'viem';
import type { ArtifactReference, CircuitKind, ProofStage } from '@null-protocol/prover';
import type { AuthPolicyOpening, ChainContext, CompiledDistribution, DiscoveredAllocation, EnvelopeV1, ProfileKeys } from '@null-protocol/sdk';

export const CONTRACT_NAMES = ['nullPool', 'nullAuthRegistry', 'poseidon3', 'shieldVerifier', 'createDistributionVerifier', 'claimVerifier'] as const;
export type ContractName = typeof CONTRACT_NAMES[number];
export interface DeploymentManifest {
  status: 'deployed'; protocolVersion: '0.1.0'; chainId: 11155111 | 31337; deploymentBlock: number;
  asset: { symbol: string; decimals: 6; address: Address };
  contracts: Record<ContractName, Address>;
  codeHashes: Record<ContractName | 'asset', Hex>;
  build: { noir: '1.0.0-beta.22'; barretenberg: '5.0.0-nightly.20260522'; circuitArtifacts: Record<CircuitKind, ArtifactReference & { verifierSourceSha256: Hex }> };
  security: { networkScope: 'testnet-only'; withdrawalsImplemented: false; audited: false };
}
export type OperationStage = 'deployment' | 'history' | 'authorization' | 'saving-recovery' | ProofStage | 'approval' | 'simulating' | 'submitting' | 'confirming' | 'confirmed';
export interface OperationOptions {
  signal?: AbortSignal;
  onProgress?: (stage: OperationStage) => void;
  onTransactionSubmitted?: (transaction: { hash: Hex; purpose: 'approval' | 'register-policy' | 'shield' | 'claim' | 'createDistribution' }) => void;
}
export interface OwnedTreasuryNote {
  ownerNullifierKey: bigint; noteSecret: bigint; amountAtomic: bigint; policyCommitment: Hex;
  bodyCommitment: Hex; commitment: Hex; leafIndex: number; transactionHash: Hex;
}
export interface OwnedPrivateNote {
  ownerNullifierKey: bigint; noteSecret: bigint; amountAtomic: bigint; claimNullifier: Hex;
  bodyCommitment: Hex; commitment: Hex; leafIndex: number; transactionHash: Hex;
}
/** Private: implement this callback with encrypted local storage. Never upload it. */
export interface SecretCheckpoint {
  kind: 'treasury' | 'private-note'; phase: 'prepared' | 'confirmed'; context: ChainContext;
  bodyCommitment: Hex; ownerNullifierKey: bigint; noteSecret: bigint; amountAtomic: bigint;
  policyCommitment?: Hex; claimNullifier?: Hex; commitment?: Hex; leafIndex?: number; transactionHash?: Hex;
}
export interface LiveClientOptions {
  manifest: DeploymentManifest;
  rpcUrls: readonly string[];
  graphUrl?: string;
  artifactBaseUrl: string;
  confirmations?: number;
  receiptTimeoutMs?: number;
  maxGas?: bigint;
  persistLocalSecret: (checkpoint: SecretCheckpoint) => Promise<void>;
}
export type BroadcastTransport = { mode: 'wallet'; wallet: WalletClient } | { mode: 'relay'; url: string };
export interface PublicOperation {
  chainId: number; pool: Address; method: 'shield' | 'claim' | 'createDistribution'; proof: Hex; publicInputs: Hex[];
  envelopes?: { ephemeralPubKey: Hex; viewTag: Hex; ciphertext: Hex }[];
}
export interface PreparedOperation {
  readonly publicOperation: PublicOperation;
  readonly transaction: { chainId: number; to: Address; data: Hex; value: '0x0' };
  readonly recovery: SecretCheckpoint;
  readonly createdAt: number;
}
export interface ConfirmedOperation {
  transactionHash: Hex; receipt: TransactionReceipt; note: OwnedTreasuryNote | OwnedPrivateNote;
  localRecoverySaved: boolean; distributionCommitment?: Hex;
}
export type ReconciliationResult =
  | { status: 'confirmed'; result: ConfirmedOperation }
  | { status: 'pending'; transactionHash: Hex }
  | { status: 'reverted'; transactionHash: Hex; receipt: TransactionReceipt }
  | { status: 'not-observed'; explanation: string };
export interface ShieldOptions extends OperationOptions {
  amountAtomic: bigint; policyCommitment: Hex;
  /** Caller must disclose that sender and amount are public and v1 has no withdrawal path. */
  acknowledgePublicDepositAndNoWithdrawal: true;
}
export interface DistributionOptions extends OperationOptions {
  compiled: CompiledDistribution; treasuryNotes: readonly OwnedTreasuryNote[]; authPolicy: AuthPolicyOpening;
  validForSeconds?: number;
  authorize: (intent: { digest: Hex; publicInputs: readonly Hex[]; context: ChainContext; commitment: Hex; envelopeRoot: Hex }) => Promise<Hex>;
}
export interface ClaimOptions extends OperationOptions { allocation: DiscoveredAllocation; validForSeconds?: number }
export interface DiscoveryOptions extends OperationOptions { keys: ProfileKeys; forceRpc?: boolean }
export interface PublicHistory {
  blockNumber: bigint; blockHash: Hex; source: 'graph' | 'rpc';
  noteLeaves: Hex[]; distributionLeaves: Hex[]; policyLeaves: Hex[];
  envelopes: EnvelopeV1[];
  distributions: { commitment: Hex; envelopeRoot: Hex; transportTag: Hex; leafIndex: number; confirmed: boolean; expiry: '0' }[];
}
