import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthorizationSignature, usePrivy, useWallets } from '@privy-io/react-auth';
import { createWalletClient, custom, type EIP1193Provider, type Hex, type WalletClient } from 'viem';
import { publicKeyToAddress } from 'viem/accounts';
import { Check, Download, FileUp, KeyRound, ShieldCheck, Wallet } from 'lucide-react';
import {
  NullLiveClient, SubmissionUncertainError, createEncryptedCheckpointStore, exportPublicOperation,
  validateDeploymentManifest, type ConfirmedOperation, type DeploymentManifest, type DistributionOptions,
  type OperationStage, type OwnedTreasuryNote, type PreparedOperation,
} from '@null-protocol/client';
import { authorizeOrganizationDistribution, type AuthorizationRequest } from '@null-protocol/auth';
import {
  NullError, authPolicyCommitment, fromHex, secp256k1, toHex,
  type AuthPolicyOpening, type CompiledDistribution, type DiscoveredAllocation,
} from '@null-protocol/sdk';
import { config } from '../lib/config';
import { download, money, short } from '../lib/format';
import { Badge, Button, CopyButton, ExternalLink, KeyValue, Modal, Notice } from './ui';

export type LiveOperationRequest = { kind: 'shield'; amountAtomic: bigint } |
  { kind: 'claim'; allocation: DiscoveredAllocation } |
  { kind: 'create_distribution'; compiled: CompiledDistribution };
export interface LiveOperationProps {
  open: boolean;
  onClose: () => void;
  operation: LiveOperationRequest;
  onConfirmed?: (result: ConfirmedOperation) => void;
}
type Intent = Parameters<DistributionOptions['authorize']>[0];
type SecretStore = ReturnType<typeof createEncryptedCheckpointStore>;
type WalletBridge = {
  connect: (chainId: number) => Promise<WalletClient>;
  authorize?: (intent: Intent, policy: AuthPolicyOpening) => Promise<Hex>;
};
const stageCopy: Record<OperationStage, string> = {
  deployment: 'Checking the deployed contracts and proof versions…', history: 'Reconstructing confirmed public history…',
  authorization: 'Waiting for the exact business approval…', 'saving-recovery': 'Encrypting your recovery checkpoint on this device…',
  loading: 'Loading the pinned proving artifact…', witness: 'Preparing the private witness on this device…',
  proving: 'Generating the zero-knowledge proof locally…', complete: 'Proof prepared. Review before submitting.',
  approval: 'Approve the exact token allowance in your wallet…', simulating: 'Checking this transaction against current chain state…',
  submitting: 'Submitting the reviewed transaction…', confirming: 'Waiting for the required chain confirmations…',
  confirmed: 'The expected onchain result is confirmed.',
};
const organizationUrl = import.meta.env.VITE_ORGANIZATION_URL as string | undefined;

function chainDefinition(id: number) {
  return { id, name: id === 11155111 ? 'Sepolia' : 'Local development', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [config.rpcUrl] } } };
}
async function injectedWallet(chainId: number): Promise<WalletClient> {
  const provider = (window as unknown as { ethereum?: EIP1193Provider }).ethereum;
  if (!provider) throw new NullError('NULL_WALLET_UNAVAILABLE', 'Install a browser wallet, or configure Privy to continue.');
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
    if (!wallet) throw new NullError('NULL_WALLET_UNAVAILABLE', 'Finish setting up a wallet in your Privy account.');
    await wallet.switchChain(chainId);
    const provider = await wallet.getEthereumProvider();
    return createWalletClient({ account: wallet.address as Hex, chain: chainDefinition(chainId), transport: custom(provider) });
  }, [ready, authenticated, login, wallets]);
  const authorize = useCallback(async (intent: Intent, policy: AuthPolicyOpening) => {
    if (!organizationUrl || !config.privyAppId) throw new NullError('NULL_ORGANIZATION_CONFIG_REQUIRED', 'Configure the organization approval service.');
    if (!ready) throw new NullError('NULL_WALLET_UNAVAILABLE', 'Your secure wallet is still opening.');
    if (!authenticated) { login(); throw new NullError('NULL_SESSION_REQUIRED', 'Finish signing in, then select Approve with organization again.'); }
    const key = toHex(secp256k1.ProjectivePoint.fromHex(fromHex(policy.signerPublicKey)).toRawBytes(false));
    const result = await authorizeOrganizationDistribution({ endpoint: organizationUrl, appId: config.privyAppId,
      expectedSigner: publicKeyToAddress(key), publicInputs: intent.publicInputs,
      expected: { ...intent.context, commitment: intent.commitment, envelopeRoot: intent.envelopeRoot },
      getAccessToken, generateAuthorizationSignature: (request: AuthorizationRequest) => generateAuthorizationSignature(request),
    });
    return result.compactSignature;
  }, [ready, authenticated, login, getAccessToken, generateAuthorizationSignature]);
  return <LiveOperationBody {...props} bridge={{ connect, ...(organizationUrl ? { authorize } : {}) }} />;
}

export function LiveOperation(props: LiveOperationProps) {
  if (!props.open) return null;
  return config.privyAppId ? <PrivyOperation {...props} /> : <LiveOperationBody {...props} bridge={{ connect: injectedWallet }} />;
}

function errorCopy(reason: unknown): string {
  if (reason instanceof NullError) return reason.message;
  const codes: Record<string, string> = {
    NULL_PRIVY_APPROVALS_REQUIRED: 'This business policy requires additional approvers. Complete its quorum through your organization integration, or import the resulting compact signature.',
    NULL_SESSION_REQUIRED: 'Sign in to your organization account before requesting approval.',
    NULL_PRIVY_AUTH_FAILED: 'The business signature does not authorize this exact distribution.',
    NULL_CONTEXT_MISMATCH: 'The requested action does not match the reviewed deployment or distribution.',
    NULL_ORGANIZATION_UNAVAILABLE: 'The organization approval service is unavailable. You can import approval for this exact intent.',
    NULL_ARTIFACT_MISMATCH: 'The proving artifact does not match its pinned checksum. Regenerate or restore the deployment artifacts.',
    NULL_ARTIFACT_UNAVAILABLE: 'The required proving artifact is unavailable. Configure the generated artifacts before continuing.',
    NULL_PROOF_FAILED: 'The local proof could not be generated. Your encrypted recovery remains on this device.',
  };
  return reason instanceof Error && codes[reason.message] ? codes[reason.message]! : 'This step could not be completed. Check your configuration and try again.';
}

function LiveOperationBody({ open, onClose, operation, onConfirmed, bridge }: LiveOperationProps & { bridge: WalletBridge }) {
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
  const treasuryOperation = operation.kind !== 'claim';
  const amountAtomic = operation.kind === 'shield' ? operation.amountAtomic : operation.kind === 'claim'
    ? operation.allocation.amountAtomic : operation.compiled.allocations.reduce((total, allocation) => total + allocation.amountAtomic, 0n);
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
    catch { setManifestError('The deployment manifest URL is invalid. Update the environment configuration.'); return () => abort.abort(); }
    void fetch(url, { signal: abort.signal, credentials: 'omit', redirect: 'error' }).then(async response => {
      if (!response.ok) throw new Error('manifest');
      const value = await response.json() as DeploymentManifest;
      validateDeploymentManifest(value);
      setManifest(value);
    }).catch(() => { if (!abort.signal.aborted) setManifestError('A deployed testnet environment has not been configured. Publish the generated contracts and provide the matching deployment manifest to enable this action.'); });
    return () => abort.abort();
  }, [open]);
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
    if (treasuryOperation) {
      const recovered = await live.recoverTreasuryNotes(saved.checkpoints, proofOptions());
      setNotes(recovered.filter(item => !item.spent && item.note.amountAtomic > 0n).map(item => item.note));
    }
  }
  async function unlock() {
    if (!manifest) return;
    if (password.length < 12) throw new NullError('NULL_PASSWORD_INVALID', 'Choose a local recovery password with at least 12 characters.');
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
    if (file.size > 16_384) throw new NullError('NULL_POLICY_INVALID', 'Choose an organization policy file under 16 KB.');
    let opening: AuthPolicyOpening;
    try {
      const json = JSON.parse(await file.text()) as Record<string, unknown>;
      if (typeof json.signerPublicKey !== 'string' || typeof json.policyMetadata !== 'string' || typeof json.registrationBlinder !== 'string') throw new Error('shape');
      opening = { signerPublicKey: json.signerPublicKey as Hex, policyMetadata: BigInt(json.policyMetadata), registrationBlinder: BigInt(json.registrationBlinder) };
      authPolicyCommitment(opening);
    } catch { throw new NullError('NULL_POLICY_INVALID', 'This is not a valid organization policy recovery file.'); }
    await vault.persistLocalPolicy(opening);
    const values = (await vault.load()).policies; setPolicies(values); setSelectedPolicy(authPolicyCommitment(opening));
  }
  async function importRecovery(file?: File) {
    if (!file || !vault || !client) return;
    if (file.size > 2_000_000) throw new NullError('NULL_RECOVERY_INVALID', 'Choose an encrypted recovery archive under 2 MB.');
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
    let result: PreparedOperation;
    if (operation.kind === 'shield') {
      if (!policy || !acknowledged) throw new NullError('NULL_PRIVACY_BOUNDARY', 'Select a policy and acknowledge the public deposit boundary.');
      result = await client.prepareShield({ amountAtomic: operation.amountAtomic, policyCommitment: authPolicyCommitment(policy), acknowledgePublicDepositAndNoWithdrawal: true, ...proofOptions() });
    } else if (operation.kind === 'claim') {
      result = await client.prepareClaim({ allocation: operation.allocation, ...proofOptions() });
    } else {
      if (!policy) throw new NullError('NULL_POLICY_INVALID', 'Import or unlock your business policy first.');
      const chosen = notes.filter(note => selectedNotes.includes(note.commitment) && note.policyCommitment === selectedPolicy);
      if (chosen.length < 1 || chosen.length > 2) throw new NullError('NULL_NOTE_INVALID', 'Select one or two funded treasury notes.');
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
      const signed = await bridge.authorize(manualIntent, policy);
      pendingApproval.current?.resolve(signed); pendingApproval.current = undefined; setManualIntent(undefined);
    } catch (reason) { setError(errorCopy(reason)); }
    finally { setApprovalBusy(false); }
  }
  function importSignature() {
    if (!/^0x[0-9a-fA-F]{128}$/.test(signature.trim())) { setError('Paste the 64-byte compact signature for this exact raw digest.'); return; }
    pendingApproval.current?.resolve(signature.trim() as Hex); pendingApproval.current = undefined;
    setSignature(''); setManualIntent(undefined); setError('');
  }
  async function submit() {
    if (!prepared || !client || !backupSaved || uncertain) return;
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
      setReconciliation('The submitted transaction is confirmed as reverted. No successful operation was recorded. You can prepare a fresh proof before trying again.');
    } else {
      if (state.status === 'pending') setTransactionHash(state.transactionHash);
      setStage(undefined);
      setReconciliation(state.status === 'pending' ? 'The transaction has not reached the required confirmations. Check its status again before attempting another submission.' : state.explanation);
    }
  }

  const title = operation.kind === 'shield' ? 'Shield treasury funds' : operation.kind === 'claim' ? 'Claim your private note' : 'Publish private distribution';
  return <Modal title={title} description="Prepared on your device. Submitted only after your review." open={open} onClose={close} wide>
    <div className="claim-amount">{money(amountAtomic, true)}<span>USDC</span></div>
    {manifestError ? <Notice tone="warning">{manifestError}<p>Your local preparation is still available. No transaction has been sent.</p></Notice>
      : !manifest ? <p className="processing-status" role="status">Loading the deployment configuration…</p>
      : <>
        <div className="detail-list"><KeyValue label="Network"><Badge tone="warning">{manifest.chainId === 11155111 ? 'Sepolia testnet' : 'Local test chain'}</Badge></KeyValue><KeyValue label="Pool"><span className="code-with-copy"><code>{short(manifest.contracts.nullPool)}</code><CopyButton value={manifest.contracts.nullPool} /></span></KeyValue></div>
        {operation.kind === 'shield' && <Notice tone="warning">Your funding wallet and deposit amount are public. Keep deposits separate from payroll timing. This prototype has no withdrawal path; use testnet assets only.</Notice>}
        {operation.kind !== 'shield' && <Notice>Private values stay on this device. The submitted proof carries commitments and nullifiers. Network providers can still observe your requests.</Notice>}
        {!client ? <>
          <label className="field">Local recovery password<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" placeholder="At least 12 characters" disabled={busy} /><small>Unlock existing notes, or choose a password for this device. The password is never sent to a server.</small></label>
          <Button icon={KeyRound} busy={busy} onClick={() => void work(unlock)}>Unlock local recovery</Button>
        </> : <>
          {!prepared && <>
            <div className="button-row"><Button variant="secondary" disabled={busy} icon={Wallet} onClick={() => void work(connect)}>{wallet?.account ? short(wallet.account.address, 5) : 'Connect wallet'}</Button><Button variant="ghost" disabled={busy} icon={FileUp} onClick={() => recoveryFile.current?.click()}>Restore encrypted recovery</Button></div>
            <input ref={recoveryFile} hidden type="file" accept=".json,application/json" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void work(() => importRecovery(file)); }} />
            {treasuryOperation && <details className="section-block" open={!policy}>
              <summary>Organization policy and treasury notes</summary>
              <p className="field-hint">The policy recovery file contains your signer public key and registration blinder. It is imported and encrypted locally.</p>
              {policies.length > 0 && <label className="field">Business authorization policy<select value={selectedPolicy} disabled={busy} onChange={event => { setSelectedPolicy(event.target.value); setSelectedNotes([]); }}>{policies.map(item => { const commitment = authPolicyCommitment(item); return <option key={commitment} value={commitment}>{short(commitment, 10)}</option>; })}</select></label>}
              <div className="button-row"><Button variant="secondary" disabled={busy} icon={FileUp} onClick={() => policyFile.current?.click()}>Import policy file</Button><Button variant="ghost" disabled={busy || !policy} onClick={() => void work(registerPolicy)}>Register policy onchain</Button></div>
              <input ref={policyFile} hidden type="file" accept=".json,application/json" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void work(() => importPolicy(file)); }} />
              {operation.kind === 'create_distribution' && <>
                <p className="field-hint">Choose up to two confirmed notes. Any unallocated value returns as a private change note.</p>
                {notes.filter(note => note.policyCommitment === selectedPolicy).length === 0 && <Notice tone="warning">No spendable treasury notes were recovered for this policy. Restore its encrypted recovery archive or shield testnet funds first.</Notice>}
                {notes.filter(note => note.policyCommitment === selectedPolicy).map(note => <label className="checkbox-field" key={note.commitment}><input type="checkbox" checked={selectedNotes.includes(note.commitment)} disabled={busy || (!selectedNotes.includes(note.commitment) && selectedNotes.length >= 2)} onChange={event => setSelectedNotes(values => event.target.checked ? [...values, note.commitment] : values.filter(value => value !== note.commitment))} /><span>{money(note.amountAtomic, true)} USDC · <code>{short(note.commitment, 5)}</code></span></label>)}
              </>}
            </details>}
            {operation.kind === 'shield' && <label className="checkbox-field"><input type="checkbox" checked={acknowledged} disabled={busy} onChange={event => setAcknowledged(event.target.checked)} /><span>I understand that this public deposit uses testnet assets and the prototype has no withdrawal path.</span></label>}
          </>}
          {manualIntent && <div className="section-block">
            <h3>Approve this exact distribution</h3><p className="field-hint">The approval binds this network, pool, distribution, envelopes, private change and deadline. The raw signature stays a private proof input.</p>
            <KeyValue label="Approval digest"><span className="code-with-copy"><code>{short(manualIntent.digest)}</code><CopyButton value={manualIntent.digest} /></span></KeyValue>
            {bridge.authorize && <Button icon={ShieldCheck} busy={approvalBusy} onClick={() => void approveWithOrganization()}>Approve with organization</Button>}
            <details><summary>Import an approval from your signing workflow</summary><label className="field">Compact signature<input value={signature} disabled={approvalBusy} onChange={event => setSignature(event.target.value)} spellCheck={false} autoComplete="off" placeholder="0x… (64 bytes, raw digest, low-s)" /></label><div className="button-row"><Button variant="secondary" icon={Download} onClick={() => download('null-public-approval-intent.json', JSON.stringify({ digest: manualIntent.digest, publicInputs: manualIntent.publicInputs }, null, 2))}>Export public intent</Button><Button disabled={approvalBusy} onClick={importSignature}>Use this approval</Button></div></details>
          </div>}
          {prepared && !confirmed && <div className="section-block">
            <h3>Review your transaction</h3><div className="detail-list"><KeyValue label="Action">{prepared.publicOperation.method}</KeyValue><KeyValue label="Public proof inputs">{prepared.publicOperation.publicInputs.length} fields</KeyValue><KeyValue label="Private recovery"><Badge tone="success">Encrypted on this device</Badge></KeyValue></div>
            <Button variant="secondary" icon={Download} disabled={busy} onClick={() => void work(exportRecovery)}>Download encrypted note recovery</Button><p className="field-hint">Save this file and your password separately before submitting. It includes the new note's recovery secret.</p>
            <label className="field">Broadcast through<select value={transport} disabled={busy || uncertain} onChange={event => setTransport(event.target.value as 'relay' | 'wallet')}><option value="wallet">My connected wallet</option>{config.relayerUrl && operation.kind !== 'shield' && <option value="relay">Configured relayer</option>}</select><small>{transport === 'wallet' ? 'The sending wallet and transaction timing are public.' : 'The relayer receives the proof and public inputs; it cannot redirect the output.'}</small></label>
            <Button variant="ghost" icon={Download} onClick={() => download('null-public-transaction.json', exportPublicOperation(prepared))}>Export public proof for another broadcaster</Button>
          </div>}
          {confirmed && <Notice tone={confirmed.localRecoverySaved ? 'success' : 'warning'} icon={Check}><strong>The expected note is confirmed onchain.</strong><p>{confirmed.localRecoverySaved ? 'Your encrypted recovery checkpoint now includes the confirmed note index.' : 'The transaction succeeded, but the latest local checkpoint could not be saved. Keep the prepared recovery archive; the note index can be rebuilt from chain history.'}</p><Button variant="ghost" icon={Download} onClick={() => void work(exportRecovery)}>Download updated recovery</Button></Notice>}
          {uncertain && <Notice tone="warning">Submission could not be confirmed. A timeout does not mean failure. Keep your recovery archive and check the transaction before attempting another submission.<p><Button variant="secondary" busy={busy} onClick={() => void work(reconcile)}>Check transaction status</Button></p></Notice>}
          {reconciliation && <Notice tone="warning">{reconciliation}</Notice>}
          {busy && (stage === 'submitting' || stage === 'confirming') && <p className="field-hint">Closing this window does not cancel a transaction already sent. Keep your encrypted recovery archive.</p>}
          {transactionHash && <p className="field-hint">{manifest.chainId === 11155111 ? <ExternalLink href={`https://sepolia.etherscan.io/tx/${transactionHash}`}>View submitted transaction</ExternalLink> : <code>{transactionHash}</code>}</p>}
        </>}
      </>}
    {stage && <p className="processing-status" role="status" aria-live="polite">{stageCopy[stage]}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="modal-actions"><Button variant="secondary" onClick={close}>{confirmed ? 'Done' : busy ? 'Close' : 'Cancel'}</Button>{client && !prepared && <Button busy={busy} disabled={treasuryOperation && !policy || operation.kind === 'shield' && !acknowledged} icon={ShieldCheck} onClick={() => void work(prepare)}>Prepare local proof</Button>}{prepared && !confirmed && <Button busy={busy} disabled={!backupSaved || uncertain} icon={ShieldCheck} onClick={() => void work(submit)}>Submit reviewed transaction</Button>}</div>
  </Modal>;
}
