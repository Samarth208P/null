import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthorizationSignature, usePrivy, useWallets } from '@privy-io/react-auth';
import { createWalletClient, custom, getAddress, type EIP1193Provider, type Hex, type WalletClient } from 'viem';
import { publicKeyToAddress } from 'viem/accounts';
import { Check, Download, FileUp, KeyRound, ShieldCheck, Wallet } from 'lucide-react';
import {
  NullLiveClient, SubmissionUncertainError, createEncryptedCheckpointStore,
  validateDeploymentManifest, type ConfirmedOperation, type DeploymentManifest, type DistributionOptions,
  type WithdrawalOptions, type OwnedPrivateNote, type OperationStage, type OwnedTreasuryNote, type PreparedOperation,
} from '@null-protocol/client';
import { authorizeOrganizationDistribution, identifyOrganizationSigner, type AuthorizationRequest } from '@null-protocol/auth';
import {
  NullError, authPolicyCommitment, fromHex, secp256k1, toHex, deriveField, randomBytes, utf8,
  type AuthPolicyOpening, type CompiledDistribution, type DiscoveredAllocation,
} from '@null-protocol/sdk';
import { config } from '../lib/config';
import { useStore } from '../lib/store';
import { PaymentNameError, recheckPaymentNames, type PaymentNameSnapshot } from '@null-protocol/ens';
import { ensClient } from '../lib/ens';
import { download, money, short } from '../lib/format';
import { Badge, Button, CopyButton, ExternalLink, KeyValue, Modal, Notice } from './ui';

export type LiveOperationRequest = { kind: 'withdraw'; treasury: boolean } | { kind: 'shield'; amountAtomic: bigint } |
  { kind: 'claim'; allocation: DiscoveredAllocation } |
  { kind: 'create_distribution'; compiled: CompiledDistribution; paymentNames?: PaymentNameSnapshot[] };
export interface LiveOperationProps {
  open: boolean;
  onClose: () => void;
  operation: LiveOperationRequest;
  onConfirmed?: (result: ConfirmedOperation) => void;
}
type Intent = Parameters<DistributionOptions['authorize']>[0] | Parameters<NonNullable<WithdrawalOptions['authorize']>>[0];
type SecretStore = ReturnType<typeof createEncryptedCheckpointStore>;
type WalletBridge = {
  connect: (chainId: number) => Promise<WalletClient>;
  authorize?: (intent: Intent, policy: AuthPolicyOpening) => Promise<Hex>;
  organizationKey?: () => Promise<Hex>;
};
const stageCopy: Record<OperationStage, string> = {
  deployment: 'Checking the connection…', history: 'Checking your balance and payment history…',
  authorization: 'Waiting for organization approval…', 'saving-recovery': 'Saving your encrypted funds backup…',
  loading: 'Getting ready…', witness: 'Preparing payment details…',
  proving: 'Preparing your payment securely…', complete: 'Ready for your review. Nothing has been sent.',
  approval: 'Approve access to this amount in your wallet…', simulating: 'Checking that this payment can go through…',
  submitting: 'Sending your request…', confirming: 'Waiting for confirmation…',
  confirmed: 'Confirmed on the test network.',
};
const configuredOrganizationUrl = import.meta.env.VITE_ORGANIZATION_URL as string | undefined;
// Production uses the colocated Netlify API when a local development URL is saved.
const organizationUrl = import.meta.env.PROD && (!configuredOrganizationUrl || /^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(configuredOrganizationUrl)) ? window.location.origin : configuredOrganizationUrl;

function chainDefinition(id: number) {
  return { id, name: id === 11155111 ? 'Sepolia' : 'Local development', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [config.rpcUrl] } } };
}
async function injectedWallet(chainId: number): Promise<WalletClient> {
  const provider = (window as unknown as { ethereum?: EIP1193Provider }).ethereum;
  if (!provider) throw new NullError('NULL_WALLET_UNAVAILABLE', 'Open NULL in a browser with a wallet installed to continue.');
  const accounts = await provider.request({ method: 'eth_requestAccounts' });
  if (!accounts[0]) throw new NullError('NULL_WALLET_UNAVAILABLE', 'Connect an account in your wallet.');
  await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: `0x${chainId.toString(16)}` }] });
  return createWalletClient({ account: accounts[0], chain: chainDefinition(chainId), transport: custom(provider) });
}

/** Privy hooks only mount beneath the configured PrivyProvider. */
function PrivyOperation(props: LiveOperationProps) {
  const { ready, authenticated, login, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const { generateAuthorizationSignature } = useAuthorizationSignature();
  const connect = useCallback(async (chainId: number): Promise<WalletClient> => {
    if (!ready) throw new NullError('NULL_WALLET_UNAVAILABLE', 'Your secure wallet is still opening.');
    if (!authenticated) { login(); throw new NullError('NULL_SESSION_REQUIRED', 'Finish signing in, then select Connect wallet again.'); }
    const wallet = wallets[0];
    if (!wallet) throw new NullError('NULL_WALLET_UNAVAILABLE', 'Finish setting up your account’s wallet to continue.');
    await wallet.switchChain(chainId);
    const provider = await wallet.getEthereumProvider();
    return createWalletClient({ account: wallet.address as Hex, chain: chainDefinition(chainId), transport: custom(provider) });
  }, [ready, authenticated, login, wallets]);
  const authorize = useCallback(async (intent: Intent, policy: AuthPolicyOpening) => {
    if (!organizationUrl || !config.privyAppId) throw new NullError('NULL_ORGANIZATION_CONFIG_REQUIRED', 'Ask your administrator to finish setting up organization approval.');
    if (!ready) throw new NullError('NULL_WALLET_UNAVAILABLE', 'Your secure wallet is still opening.');
    if (!authenticated) { login(); throw new NullError('NULL_SESSION_REQUIRED', 'Finish signing in, then select Approve with organization again.'); }
    const key = toHex(secp256k1.ProjectivePoint.fromHex(fromHex(policy.signerPublicKey)).toRawBytes(false));
    const result = await authorizeOrganizationDistribution({ endpoint: organizationUrl, appId: config.privyAppId,
      expectedSigner: publicKeyToAddress(key), publicInputs: intent.publicInputs,
      expected: 'recipient' in intent ? { ...intent.context, kind: 'withdrawal', recipient:intent.recipient, amountAtomic:intent.amountAtomic } : { ...intent.context, commitment: intent.commitment, envelopeRoot: intent.envelopeRoot },
      getAccessToken, generateAuthorizationSignature: (request: AuthorizationRequest) => generateAuthorizationSignature(request),
    });
    return result.compactSignature;
  }, [ready, authenticated, login, getAccessToken, generateAuthorizationSignature]);
  const organizationKey = useCallback(async (): Promise<Hex> => {
    if (!organizationUrl || !authenticated) throw new NullError('NULL_SESSION_REQUIRED', 'Sign in as your organization’s approver to continue.');
    const token = await getAccessToken();
    if (!token) throw new NullError('NULL_SESSION_REQUIRED', 'Sign in again to continue.');
    const response = await fetch(`${organizationUrl.replace(/\/$/, '')}/api/organization/config`, { headers: { Authorization: `Bearer ${token}` }, credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new NullError('NULL_ORGANIZATION_UNAVAILABLE', 'Your organization setup could not be loaded. Check your membership and try again.');
    const data = await response.json();
    if (data.chainId !== config.chainId.toString() || data.poolAddress?.toLowerCase() !== config.poolAddress?.toLowerCase() || !/^0x[0-9a-fA-F]{40}$/.test(data.walletAddress)) throw new NullError('NULL_CONTEXT_MISMATCH', 'The organization setup does not match this network.');
    const publicKey = typeof data.signerPublicKey === 'string' ? data.signerPublicKey : await identifyOrganizationSigner({ endpoint: organizationUrl, appId: config.privyAppId!, chainId: config.chainId, poolAddress: config.poolAddress!, walletAddress: data.walletAddress, getAccessToken, generateAuthorizationSignature: request => generateAuthorizationSignature(request) });
    const point = secp256k1.ProjectivePoint.fromHex(fromHex(publicKey));
    if (publicKeyToAddress(toHex(point.toRawBytes(false))).toLowerCase() !== data.walletAddress?.toLowerCase()) throw new NullError('NULL_CONTEXT_MISMATCH', 'The organization signer could not be verified.');
    return toHex(point.toRawBytes(true));
  }, [authenticated, getAccessToken, generateAuthorizationSignature]);
  return <LiveOperationBody {...props} bridge={{ connect, ...(organizationUrl ? { authorize, organizationKey } : {}) }} />;
}

export function LiveOperation(props: LiveOperationProps) {
  if (!props.open) return null;
  return config.privyAppId ? <PrivyOperation {...props} /> : <LiveOperationBody {...props} bridge={{ connect: injectedWallet }} />;
}

function errorCopy(reason: unknown): string {
  if (reason instanceof PaymentNameError) return reason.message;
  const codes: Record<string, string> = {
    NULL_PRIVY_APPROVALS_REQUIRED: 'More people in your organization need to approve this payment. Complete approval with your organization, then import it using Advanced approval.',
    NULL_SESSION_REQUIRED: 'Sign in to your organization account before requesting approval.',
    NULL_PRIVY_AUTH_FAILED: 'The organization’s approval does not match this payment. Request approval again.',
    NULL_CONTEXT_MISMATCH: 'The payment or wallet network does not match your current setup. Check the selected network and payment before continuing.',
    NULL_ORGANIZATION_UNAVAILABLE: 'Organization approval is unavailable right now. Try again later, or import this payment’s approval using Advanced approval.',
    NULL_ARTIFACT_MISMATCH: 'Payment setup failed a safety check. Ask your administrator to repair the test network setup.',
    NULL_ARTIFACT_UNAVAILABLE: 'Payment setup is incomplete. Ask your administrator to finish the test network setup.',
    NULL_PROOF_FAILED: 'The payment could not be prepared. Your encrypted funds backup is still on this device. Try again.',
    NULL_SUBMISSION_UNCERTAIN: 'We could not confirm the result. Keep your funds backup and check the transaction status before trying again.',
    NULL_DEPLOYMENT_UNAVAILABLE: 'The test network is not set up yet. Ask your administrator to finish setup.',
    NULL_BALANCE_INSUFFICIENT: 'Your wallet does not have enough test USDC for this amount.',
    NULL_NULLIFIER_SPENT: 'This payment has already been collected, or the selected funds have already been used. Refresh your balance before continuing.',
    NULL_ROOT_STALE: 'Your balance or payment history has changed. Refresh it and prepare the payment again.',
    NULL_INTENT_EXPIRED: 'This payment’s approval period has ended. Prepare it again to continue.',
    NULL_DISTRIBUTION_UNCONFIRMED: 'This payment is not confirmed yet. Wait for confirmation, then check again.',
    NULL_TRANSACTION_REVERTED: 'The transaction failed on the network. No payment was completed.',
    NULL_TRANSACTION_MISMATCH: 'The transaction does not match the payment you reviewed. Check its status before trying again.',
    NULL_RPC_UNAVAILABLE: 'The network could not be reached. Try checking the status again later.',
    NULL_WALLET_REJECTED: 'The wallet request was declined. Approve it in your wallet if you want to continue.',
    NULL_APPROVAL_FAILED: 'Your wallet’s permission to use this amount was not confirmed. Check your wallet before trying again.',
    NULL_RELAY_REJECTED: 'The sending service did not accept this payment. You can choose My connected wallet to send it yourself.',
    NULL_STORAGE_UNAVAILABLE: 'Your encrypted funds backup could not be opened or saved. Check that this browser allows local storage before continuing.',
    NULL_RECOVERY_UNLOCK_FAILED: 'The funds backup could not be unlocked. Check your password and try again.',
    NULL_RECOVERY_INVALID: 'This funds backup could not be read. Use the encrypted funds backup for this account and test network, under 2 MB.',
    NULL_ENDPOINT_INVALID: 'The network connection is not set up correctly. Ask your administrator to check Advanced setup.',
  };
  if (reason instanceof NullError) return codes[reason.code] ?? reason.message;
  return reason instanceof Error && codes[reason.message] ? codes[reason.message]! : 'This step could not be completed. Check your connection and try again.';
}

function LiveOperationBody({ open, onClose, operation, onConfirmed, bridge }: LiveOperationProps & { bridge: WalletBridge }) {
  const workspaceStore = useStore();
  const [privateNotes, setPrivateNotes] = useState<OwnedPrivateNote[]>([]);
  const [withdrawalNoteId, setWithdrawalNoteId] = useState('');
  const [recipient, setRecipient] = useState('');
  const [manifest, setManifest] = useState<DeploymentManifest>();
  const [manifestError, setManifestError] = useState('');
  const [password, setPassword] = useState('');
  const passwordRef = useRef('');
  const [vault, setVault] = useState<SecretStore>();
  const [client, setClient] = useState<NullLiveClient>();
  const [policies, setPolicies] = useState<AuthPolicyOpening[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState('');
  const [notes, setNotes] = useState<OwnedTreasuryNote[]>([]);
  const [selectedNotes, setSelectedNotes] = useState<string[]>([]);
  const [wallet, setWallet] = useState<WalletClient>();
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<OperationStage>();
  const [error, setError] = useState('');
  const [prepared, setPrepared] = useState<PreparedOperation>();
  const [confirmed, setConfirmed] = useState<ConfirmedOperation>();
  const [backupSaved, setBackupSaved] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [reconciliation, setReconciliation] = useState('');
  const [transactionHash, setTransactionHash] = useState<Hex>();
  const [transport, setTransport] = useState<'relay' | 'wallet'>(config.relayerUrl && operation.kind !== 'shield' ? 'relay' : 'wallet');
  const [manualIntent, setManualIntent] = useState<Intent>();
  const [approvalBusy, setApprovalBusy] = useState(false);
  const [signature, setSignature] = useState('');
  const pendingApproval = useRef<{ resolve: (signature: Hex) => void; reject: (error: Error) => void } | undefined>(undefined);
  const controller = useRef<AbortController | undefined>(undefined);
  const policyFile = useRef<HTMLInputElement>(null);
  const recoveryFile = useRef<HTMLInputElement>(null);
  const policy = policies.find(item => authPolicyCommitment(item) === selectedPolicy);
  const treasuryOperation = operation.kind === 'shield' || operation.kind === 'create_distribution' || operation.kind === 'withdraw' && operation.treasury;
  const withdrawalNotes = treasuryOperation ? notes : privateNotes;
  const withdrawalNote = withdrawalNotes.find(note => note.commitment === withdrawalNoteId);
  const amountAtomic = operation.kind === 'shield' ? operation.amountAtomic : operation.kind === 'claim'
    ? operation.allocation.amountAtomic : operation.kind === 'withdraw' ? withdrawalNote?.amountAtomic ?? 0n : operation.compiled.allocations.reduce((total, allocation) => total + allocation.amountAtomic, 0n);
  const proofOptions = () => ({ signal: controller.current?.signal, onProgress: setStage,
    onTransactionSubmitted: ({ hash, purpose }: { hash: Hex; purpose: string }) => {
      const method = operation.kind === 'create_distribution' ? 'createDistribution' : operation.kind;
      if (purpose === method) setTransactionHash(hash);
    } });

  useEffect(() => {
    if (!open) return;
    const abort = new AbortController();
    setManifestError('');
    let url: URL;
    try { url = new URL(import.meta.env.VITE_DEPLOYMENT_MANIFEST_URL || '/deployment.json', window.location.origin); }
    catch { setManifestError('The test network setup is incomplete. Ask your administrator to check it.'); return () => abort.abort(); }
    void fetch(url, { signal: abort.signal, credentials: 'omit', redirect: 'error' }).then(async response => {
      if (!response.ok) throw new Error('manifest');
      const value = await response.json() as DeploymentManifest;
      validateDeploymentManifest(value);
      if (value.chainId !== Number(config.chainId) || value.contracts.nullPool.toLowerCase() !== config.poolAddress?.toLowerCase()) throw new Error('context');
      if ((operation.kind === 'shield' || operation.kind === 'withdraw') && !value.security.withdrawalsImplemented) { setManifestError('This pool has no withdrawals. New deposits are disabled until the withdrawal-capable deployment is ready.'); return; }
      setManifest(value);
    }).catch(() => { if (!abort.signal.aborted) setManifestError('The test network is not ready. Ask your administrator to finish setup before using this action.'); });
    return () => abort.abort();
  }, [open, operation.kind]);
  useEffect(() => () => { controller.current?.abort(); pendingApproval.current?.reject(new DOMException('Cancelled', 'AbortError')); passwordRef.current = ''; }, []);

  function close() {
    controller.current?.abort();
    pendingApproval.current?.reject(new DOMException('Cancelled', 'AbortError'));
    pendingApproval.current = undefined;
    setManualIntent(undefined); setPassword(''); passwordRef.current = '';
    onClose();
  }
  async function work(action: () => Promise<void>) {
    setError(''); setBusy(true); controller.current = new AbortController();
    try { await action(); }
    catch (reason) { if (!(reason instanceof DOMException && reason.name === 'AbortError')) setError(errorCopy(reason)); }
    finally { setBusy(false); }
  }
  async function refreshRecovery(store: SecretStore, live: NullLiveClient) {
    const saved = await store.load(); setPolicies(saved.policies);
    if (saved.policies[0]) setSelectedPolicy(authPolicyCommitment(saved.policies[0]));
    if (operation.kind === 'withdraw' && !operation.treasury) setPrivateNotes(await live.recoverPrivateNotes({keys:workspaceStore.identity.keys,checkpoints:saved.checkpoints,...proofOptions()}));
    if (treasuryOperation) {
      const recovered = await live.recoverTreasuryNotes(saved.checkpoints, proofOptions());
      setNotes(recovered.filter(item => !item.spent && item.note.amountAtomic > 0n).map(item => item.note));
    }
  }
  async function unlock() {
    if (!manifest) return;
    if (password.length < 12) throw new NullError('NULL_PASSWORD_INVALID', 'Use a funds backup password with at least 12 characters.');
    passwordRef.current = password;
    const store = createEncryptedCheckpointStore({ namespace: `null-${manifest.chainId}-${manifest.contracts.nullPool.slice(2).toLowerCase()}`, getPassword: async () => passwordRef.current });
    const live = new NullLiveClient({ manifest, rpcUrls: [config.rpcUrl], graphUrl: config.graphUrl,
      artifactBaseUrl: (import.meta.env.VITE_ARTIFACT_BASE_URL || window.location.origin) as string,
      confirmations: config.confirmations, persistLocalSecret: store.persistLocalSecret });
    await live.verifyDeployment(proofOptions());
    await refreshRecovery(store, live);
    setVault(store); setClient(live); setStage(undefined);
  }
  async function connect() {
    if (!manifest) return;
    const value = await bridge.connect(manifest.chainId); setWallet(value);
  }
  async function importPolicy(file?: File) {
    if (!file || !vault) return;
    if (file.size > 16_384) throw new NullError('NULL_POLICY_INVALID', 'Choose an organization setup file under 16 KB.');
    let opening: AuthPolicyOpening;
    try {
      const json = JSON.parse(await file.text()) as Record<string, unknown>;
      if (typeof json.signerPublicKey !== 'string' || typeof json.policyMetadata !== 'string' || typeof json.registrationBlinder !== 'string') throw new Error('shape');
      opening = { signerPublicKey: json.signerPublicKey as Hex, policyMetadata: BigInt(json.policyMetadata), registrationBlinder: BigInt(json.registrationBlinder) };
      authPolicyCommitment(opening);
    } catch { throw new NullError('NULL_POLICY_INVALID', 'This organization setup file could not be read. Ask your administrator for the correct file.'); }
    await vault.persistLocalPolicy(opening);
    const values = (await vault.load()).policies; setPolicies(values); setSelectedPolicy(authPolicyCommitment(opening));
  }
  async function useOrganization() {
    if (!vault || !bridge.organizationKey) return;
    const signerPublicKey = await bridge.organizationKey();
    const saved = (await vault.load()).policies.find(item => item.signerPublicKey.toLowerCase() === signerPublicKey.toLowerCase());
    const seed = randomBytes(32);
    try {
      const opening = saved ?? { signerPublicKey, policyMetadata: deriveField(seed, utf8('null.privy.policy')), registrationBlinder: deriveField(seed, utf8('null.privy.registration')) };
      await vault.persistLocalPolicy(opening);
      setPolicies((await vault.load()).policies); setSelectedPolicy(authPolicyCommitment(opening)); setSelectedNotes([]);
    } finally { seed.fill(0); }
  }
  async function importRecovery(file?: File) {
    if (!file || !vault || !client) return;
    if (file.size > 2_000_000) throw new NullError('NULL_RECOVERY_INVALID', 'Choose an encrypted funds backup file under 2 MB.');
    await vault.importEncrypted(await file.text()); await refreshRecovery(vault, client);
  }
  async function exportRecovery() {
    if (!vault) return;
    download('null-encrypted-live-recovery.json', await vault.exportEncrypted());
    if (prepared) setBackupSaved(true);
  }
  async function registerPolicy() {
    if (!client || !vault || !policy) return;
    const connected = wallet ?? await bridge.connect(manifest!.chainId); setWallet(connected);
    await client.registerPolicy({ opening: policy, wallet: connected, persistLocalPolicy: vault.persistLocalPolicy, ...proofOptions() });
  }
  async function prepare() {
    if (!client) return;
    if (operation.kind === 'create_distribution') await recheckPaymentNames(ensClient, operation.paymentNames ?? []);
    let result: PreparedOperation;
    if (operation.kind === 'shield') {
      if (!policy || !acknowledged) throw new NullError('NULL_PRIVACY_BOUNDARY', 'Choose your organization in Advanced setup and confirm that you understand the deposit notice.');
      result = await client.prepareShield({ amountAtomic: operation.amountAtomic, policyCommitment: authPolicyCommitment(policy), acknowledgePublicDeposit: true, ...proofOptions() });
    } else if (operation.kind === 'withdraw') {
      if (!withdrawalNote || !acknowledged) throw new NullError('NULL_PRIVACY_BOUNDARY', 'Select a note and acknowledge the public withdrawal.');
      result = await client.prepareWithdrawal({note:withdrawalNote,recipient:getAddress(recipient.trim()),acknowledgePublicWithdrawal:true,...proofOptions(),...(operation.treasury ? {authPolicy:policy,authorize:async (intent: Parameters<NonNullable<WithdrawalOptions['authorize']>>[0]) => {setManualIntent(intent);return new Promise<Hex>((resolve,reject)=>{pendingApproval.current={resolve,reject};});}} : {})});
    } else if (operation.kind === 'claim') {
      result = await client.prepareClaim({ allocation: operation.allocation, ...proofOptions() });
    } else {
      if (!policy) throw new NullError('NULL_POLICY_INVALID', 'Add your organization file in Advanced setup first.');
      const chosen = notes.filter(note => selectedNotes.includes(note.commitment) && note.policyCommitment === selectedPolicy);
      if (chosen.length < 1 || chosen.length > 2) throw new NullError('NULL_NOTE_INVALID', 'Choose one or two available balances in Advanced setup.');
      result = await client.prepareDistribution({ compiled: operation.compiled, treasuryNotes: chosen, authPolicy: policy, ...proofOptions(),
        authorize: async intent => {
          setManualIntent(intent);
          return new Promise<Hex>((resolve, reject) => { pendingApproval.current = { resolve, reject }; });
        },
      });
    }
    setPrepared(result); setBackupSaved(false); setStage('complete');
  }
  async function approveWithOrganization() {
    if (!manualIntent || !policy || !bridge.authorize) return;
    setError(''); setApprovalBusy(true);
    try {
      if (operation.kind === 'create_distribution') await recheckPaymentNames(ensClient, operation.paymentNames ?? []);
      const signed = await bridge.authorize(manualIntent, policy);
      pendingApproval.current?.resolve(signed); pendingApproval.current = undefined; setManualIntent(undefined);
    } catch (reason) { setError(errorCopy(reason)); }
    finally { setApprovalBusy(false); }
  }
  function importSignature() {
    if (!/^0x[0-9a-fA-F]{128}$/.test(signature.trim())) { setError('This approval code could not be read. Copy the full code from your organization’s signing tool; it starts with 0x.'); return; }
    pendingApproval.current?.resolve(signature.trim() as Hex); pendingApproval.current = undefined;
    setSignature(''); setManualIntent(undefined); setError('');
  }
  async function submit() {
    if (!prepared || !client || !backupSaved || uncertain) return;
    if (operation.kind === 'create_distribution') await recheckPaymentNames(ensClient, operation.paymentNames ?? []);
    setTransactionHash(undefined); setReconciliation('');
    try {
      const connected = transport === 'wallet' ? (wallet ?? await bridge.connect(manifest!.chainId)) : undefined;
      if (connected) setWallet(connected);
      const result = await client.submit(prepared, connected ? { mode: 'wallet', wallet: connected } : { mode: 'relay', url: config.relayerUrl! }, proofOptions());
      setConfirmed(result); setStage('confirmed');
      try { onConfirmed?.(result); } catch { /* A parent UI callback cannot change the confirmed chain result. */ }
    } catch (reason) {
      if (reason instanceof SubmissionUncertainError) { setUncertain(true); if (reason.transactionHash) setTransactionHash(reason.transactionHash); }
      throw reason;
    }
  }

  async function reconcile() {
    if (!prepared || !client) return;
    const state = await client.reconcile(prepared, transactionHash, proofOptions());
    if (state.status === 'confirmed') {
      setConfirmed(state.result); setUncertain(false); setTransactionHash(state.result.transactionHash); setStage('confirmed'); setReconciliation('');
      try { onConfirmed?.(state.result); } catch { /* Confirmed chain state remains authoritative. */ }
    } else if (state.status === 'reverted') {
      setUncertain(false); setPrepared(undefined); setBackupSaved(false); setTransactionHash(state.transactionHash); setStage(undefined);
      setReconciliation('The network confirmed that this transaction failed. No payment was completed. You can prepare it again.');
    } else {
      if (state.status === 'pending') setTransactionHash(state.transactionHash);
      setStage(undefined);
      setReconciliation(state.status === 'pending' ? 'The transaction is still waiting for confirmation. Check again before trying to send it again.' : 'The result is still unknown. Keep your funds backup and check again before trying to send it again.');
    }
  }

  const title = operation.kind === 'shield' ? 'Add funds' : operation.kind === 'claim' ? 'Collect payment' : operation.kind === 'withdraw' ? 'Withdraw funds' : 'Send payment';
  return <Modal title={title} description="Review the details before you confirm." open={open} onClose={close} wide>
    <div className="claim-amount">{money(amountAtomic, true)}<span>USDC</span></div>
    {manifestError ? <Notice tone="warning">{manifestError}<p>Nothing has been sent.</p></Notice>
      : !manifest ? <p className="processing-status" role="status">Checking the connection…</p>
      : <>
        <div className="detail-list"><KeyValue label="Mode"><Badge tone="warning">Test network</Badge></KeyValue></div>
        {operation.kind === 'shield' && <Notice tone="warning">Your wallet and the amount you add are public. Adding funds close to payment time may help others link them. Use test funds only.</Notice>}
        {operation.kind !== 'shield' && <Notice>Test USDC only. Your network provider can see when you connect.</Notice>}
        {!client ? <>
          <label className="field">Funds backup password<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" placeholder="At least 12 characters" disabled={busy} /><small>Enter your existing password, or choose one if this is your first payment. It stays on this device.</small></label>
          <Button icon={KeyRound} busy={busy} onClick={() => void work(unlock)}>Unlock funds</Button>
        </> : <>
          {!prepared && <>
            <div className="button-row"><Button variant="secondary" disabled={busy} icon={Wallet} onClick={() => void work(connect)}>{wallet?.account ? short(wallet.account.address, 5) : 'Connect wallet'}</Button><Button variant="ghost" disabled={busy} icon={FileUp} onClick={() => recoveryFile.current?.click()}>Restore funds backup</Button></div>
            <input ref={recoveryFile} hidden type="file" accept=".json,application/json" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void work(() => importRecovery(file)); }} />
            {treasuryOperation && <>
              {(!policy || operation.kind === 'create_distribution' && selectedNotes.length === 0) && <p className="field-hint">Open Advanced setup to {policy ? 'choose which available funds to use.' : 'add your organization’s setup file before continuing.'}</p>}
              <details className="section-block">
              <summary>Advanced setup</summary>
              <p className="field-hint">Use the setup file from your organization’s administrator. It controls who can approve payments and is encrypted on this device.</p>
              {policies.length > 0 && <label className="field">Organization setup<select value={selectedPolicy} disabled={busy} onChange={event => { setSelectedPolicy(event.target.value); setSelectedNotes([]); }}>{policies.map((item, index) => { const commitment = authPolicyCommitment(item); return <option key={commitment} value={commitment}>Setup {index + 1} · {short(commitment, 5)}</option>; })}</select></label>}
              {bridge.organizationKey && <p className="field-hint">Privy asks your organization owner to approve an identity-only signature. This identifies the signer and moves no funds.</p>}<div className="button-row">{bridge.organizationKey && <Button variant="secondary" disabled={busy} icon={ShieldCheck} onClick={() => void work(useOrganization)}>Use Privy organization</Button>}<Button variant="secondary" disabled={busy} icon={FileUp} onClick={() => policyFile.current?.click()}>Import setup file</Button><Button variant="ghost" disabled={busy || !policy} onClick={() => void work(registerPolicy)}>Activate organization setup</Button></div>
              <input ref={policyFile} hidden type="file" accept=".json,application/json" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void work(() => importPolicy(file)); }} />
              {operation.kind === 'create_distribution' && <>
                <p className="field-hint">Choose one or two available balances to cover this payment. Any money left over stays in your funds.</p>
                {notes.filter(note => note.policyCommitment === selectedPolicy).length === 0 && <Notice tone="warning">No available funds were found for this organization. Restore its encrypted funds backup or add test funds first.</Notice>}
                {notes.filter(note => note.policyCommitment === selectedPolicy).map(note => <label className="checkbox-field" key={note.commitment}><input type="checkbox" checked={selectedNotes.includes(note.commitment)} disabled={busy || (!selectedNotes.includes(note.commitment) && selectedNotes.length >= 2)} onChange={event => setSelectedNotes(values => event.target.checked ? [...values, note.commitment] : values.filter(value => value !== note.commitment))} /><span>{money(note.amountAtomic, true)} USDC · <code>{short(note.commitment, 5)}</code></span></label>)}
              </>}
            </details></>}
            {operation.kind === 'withdraw' && <div className="section-block">
              <label className="field">Funds to withdraw<select value={withdrawalNoteId} disabled={busy} onChange={event => {setWithdrawalNoteId(event.target.value); const chosen=withdrawalNotes.find(note=>note.commitment===event.target.value);if(chosen && 'policyCommitment' in chosen)setSelectedPolicy(chosen.policyCommitment);}}><option value="">Choose a note</option>{withdrawalNotes.map((note,index)=><option key={note.commitment} value={note.commitment}>{money(note.amountAtomic,true)} USDC · Note {index+1}</option>)}</select><small>Withdraw one full note at a time. No change is left behind.</small></label>
              {!withdrawalNotes.length && <Notice>No available notes. Restore your Payment ID or funds backup first.</Notice>}
              <label className="field">Receiving wallet address<input value={recipient} maxLength={42} disabled={busy} onChange={event=>setRecipient(event.target.value)} placeholder="0x…" autoComplete="off" spellCheck={false} /></label>
              <Notice tone="warning">The receiving address and amount become public. A known address, timing or wallet used to pay gas can link your activity. A relayer hides your gas-paying wallet, not this public exit.</Notice>
              <label className="checkbox-field"><input type="checkbox" checked={acknowledged} disabled={busy} onChange={event=>setAcknowledged(event.target.checked)} /><span>I checked this address and understand the withdrawal is public.</span></label>
            </div>}
            {operation.kind === 'shield' && <label className="checkbox-field"><input type="checkbox" checked={acknowledged} disabled={busy} onChange={event => setAcknowledged(event.target.checked)} /><span>I understand that my wallet and deposit amount will be public. These are test funds.</span></label>}
          </>}
          {manualIntent && <div className="section-block">
            <h3>Organization approval needed</h3><p className="field-hint">Your organization must approve this payment before it can be sent.</p>
            {bridge.authorize && <Button icon={ShieldCheck} busy={approvalBusy} onClick={() => void approveWithOrganization()}>Approve with organization</Button>}
            {!bridge.authorize && <p className="field-hint">Open Advanced approval to download a request for your administrator, then paste the approval they provide.</p>}
            <details><summary>Advanced approval</summary><p className="field-hint">Use an approval from your organization’s signing tool for this payment only.</p><KeyValue label="Approval reference"><span className="code-with-copy"><code>{short(manualIntent.digest)}</code><CopyButton value={manualIntent.digest} /></span></KeyValue><label className="field">Approval code<input value={signature} disabled={approvalBusy} onChange={event => setSignature(event.target.value)} spellCheck={false} autoComplete="off" placeholder="Paste the full approval code, starting with 0x" /><small>The signing tool must return a 64-byte compact signature for the raw approval digest.</small></label><div className="button-row"><Button variant="secondary" icon={Download} onClick={() => download('null-public-approval-intent.json', JSON.stringify({ digest: manualIntent.digest, publicInputs: manualIntent.publicInputs }, null, 2))}>Download approval request</Button><Button disabled={approvalBusy} onClick={importSignature}>Use this approval</Button></div></details>
          </div>}
          {prepared && !confirmed && <div className="section-block">
            <h3>Save funds backup before confirming</h3>{operation.kind === 'withdraw' && prepared && <KeyValue label="Receiving address"><code className="withdraw-address">{`0x${BigInt(prepared.publicOperation.publicInputs[6]!).toString(16).padStart(40,'0')}`}</code></KeyValue>}<div className="detail-list"><KeyValue label="Action">{title}</KeyValue><KeyValue label="Funds backup"><Badge tone="success">Encrypted on this device</Badge></KeyValue></div>
            <Button variant="secondary" icon={Download} disabled={busy} onClick={() => void work(exportRecovery)}>Download funds backup</Button><p className="field-hint">This file is encrypted. Keep it and your password in separate safe places. You need them to recover your funds on another device.</p>
            <label className="field">Send through<select value={transport} disabled={busy || uncertain} onChange={event => setTransport(event.target.value as 'relay' | 'wallet')}><option value="wallet">My connected wallet</option>{config.relayerUrl && operation.kind !== 'shield' && <option value="relay">Payment sending service</option>}</select><small>{transport === 'wallet' ? 'Your sending wallet and the time you send are public.' : 'The service can see this request and when you send it. It cannot change who receives the payment.'}</small></label>
          </div>}
          {confirmed && <Notice tone={confirmed.localRecoverySaved ? 'success' : 'warning'} icon={Check}><strong>{operation.kind === 'shield' ? 'Funds added on the test network.' : operation.kind === 'claim' ? 'Payment collected on the test network.' : operation.kind === 'withdraw' ? 'Withdrawal confirmed on the test network.' : 'Payment sent on the test network.'}</strong><p>{confirmed.withdrawal ? 'Tokens arrived at the reviewed receiving address.' : confirmed.localRecoverySaved ? 'Your encrypted funds backup has been updated with this payment.' : 'The payment succeeded, but the funds backup on this device could not be updated. Keep the file you saved before sending; it can still be used to recover your funds.'}</p><Button variant="ghost" icon={Download} onClick={() => void work(exportRecovery)}>Download funds backup</Button></Notice>}
          {uncertain && <Notice tone="warning">The result is still unknown. A slow response does not mean the payment failed. Keep your funds backup and check the status before trying again.<p><Button variant="secondary" busy={busy} onClick={() => void work(reconcile)}>Check transaction status</Button></p></Notice>}
          {reconciliation && <Notice tone="warning">{reconciliation}</Notice>}
          {busy && (stage === 'submitting' || stage === 'confirming') && <p className="field-hint">Closing this window will not cancel a request already sent. Keep your encrypted funds backup.</p>}
          {transactionHash && <p className="field-hint">{manifest.chainId === 11155111 ? <ExternalLink href={`https://sepolia.etherscan.io/tx/${transactionHash}`}>View submitted transaction</ExternalLink> : <code>{transactionHash}</code>}</p>}
        </>}
      </>}
    {stage && <p className="processing-status" role="status" aria-live="polite">{stageCopy[stage]}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="modal-actions"><Button variant="secondary" onClick={close}>{confirmed ? 'Done' : busy ? 'Close' : 'Cancel'}</Button>{client && !prepared && <Button busy={busy} disabled={treasuryOperation && !policy || operation.kind === 'shield' && !acknowledged || operation.kind === 'withdraw' && (!withdrawalNote || !acknowledged || !/^0x[0-9a-fA-F]{40}$/.test(recipient.trim()))} icon={ShieldCheck} onClick={() => void work(prepare)}>Prepare payment</Button>}{prepared && !confirmed && <Button busy={busy} disabled={!backupSaved || uncertain} icon={ShieldCheck} onClick={() => void work(submit)}>{operation.kind === 'shield' ? 'Confirm add funds' : operation.kind === 'claim' ? 'Confirm collection' : operation.kind === 'withdraw' ? 'Confirm withdrawal' : 'Confirm payment'}</Button>}</div>
  </Modal>;
}
