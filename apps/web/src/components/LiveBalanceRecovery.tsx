import { useEffect, useRef, useState } from 'react';
import { Check, Download, FileUp, RefreshCw, ShieldCheck } from 'lucide-react';
import { createPublicClient, http } from 'viem';
import {
  NullLiveClient, createEncryptedCheckpointStore, validateDeploymentManifest,
  type DeploymentManifest, type OwnedTreasuryNote, type SecretCheckpoint,
} from '@null-protocol/client';
import { NullError, type ProfileKeys } from '@null-protocol/sdk';
import { config } from '../lib/config';
import { download, money, short } from '../lib/format';
import { Badge, Button, CopyButton, ExternalLink, KeyValue, Modal, Notice } from './ui';

export interface RecoveredBalanceResult {
  treasuryBalance: bigint | null;
  notes: { id: string; amount: bigint; commitment: string; createdAt: string; allocationId: string }[];
}
export interface LiveBalanceRecoveryProps {
  open: boolean;
  onClose: () => void;
  onRecovered: (result: RecoveredBalanceResult) => void;
  identityKeys: ProfileKeys;
}
type RecoveryStore = ReturnType<typeof createEncryptedCheckpointStore>;
interface RecoverySummary {
  treasuryBalance: bigint | null;
  privateBalance: bigint;
  treasuryCount: number;
  privateCount: number;
  blockNumber: bigint;
  blockHash: string;
  source: 'graph' | 'rpc';
  checkedAt: string;
  treasuryWarning?: string;
}

function readableError(error: unknown): string {
  if (error instanceof NullError) return error.message;
  if (error instanceof Error && error.name === 'AbortError') return 'Recovery was canceled. Existing balances were left unchanged.';
  const message = error instanceof Error ? error.message : '';
  if (/NULL_CONTEXT_MISMATCH|NULL_VERIFIER_MISMATCH/.test(message)) return 'The chain, pool, or deployed contract code does not match the reviewed deployment. Check the manifest and RPC configuration.';
  if (/NULL_ROOT_STALE|NULL_HISTORY/.test(message)) return 'Confirmed history could not be verified. Try the direct RPC option or refresh after the next confirmation.';
  if (/NULL_RPC_UNAVAILABLE|NULL_GRAPH_UNAVAILABLE|fetch/i.test(message)) return 'Public chain history is unavailable. Try another RPC provider. Your balances have not been replaced with zero.';
  return 'Recovery could not be completed. Check the deployment, connection, and recovery password, then try again.';
}

export function LiveBalanceRecovery({ open, onClose, onRecovered, identityKeys }: LiveBalanceRecoveryProps) {
  const [manifest, setManifest] = useState<DeploymentManifest>();
  const [manifestError, setManifestError] = useState('');
  const [password, setPassword] = useState('');
  const [forceRpc, setForceRpc] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');
  const [archiveMessage, setArchiveMessage] = useState('');
  const [summary, setSummary] = useState<RecoverySummary>();
  const fileInput = useRef<HTMLInputElement>(null);
  const passwordRef = useRef('');
  const abortRef = useRef<AbortController | undefined>(undefined);
  const runRef = useRef(0);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setManifest(undefined); setManifestError(''); setError(''); setSummary(undefined); setArchiveMessage('');
    void (async () => {
      try {
        const url = new URL(import.meta.env.VITE_DEPLOYMENT_MANIFEST_URL || '/deployment.json', window.location.origin);
        const response = await fetch(url, { signal: controller.signal, credentials: 'omit', redirect: 'error', cache: 'no-store' });
        if (!response.ok) throw new NullError('NULL_DEPLOYMENT_UNAVAILABLE', 'The deployed testnet manifest could not be loaded. Configure the generated deployment before recovering live balances.');
        const text = await response.text();
        if (text.length > 128_000) throw new NullError('NULL_DEPLOYMENT_UNAVAILABLE', 'The deployment manifest is unexpectedly large.');
        const value = JSON.parse(text) as DeploymentManifest;
        validateDeploymentManifest(value);
        if (config.poolAddress && value.contracts.nullPool.toLowerCase() !== config.poolAddress.toLowerCase()) throw new NullError('NULL_CONTEXT_MISMATCH', 'The deployment manifest and configured pool address disagree. Use the matching deployment configuration.');
        if (!controller.signal.aborted) setManifest(value);
      } catch (reason) {
        if (!controller.signal.aborted) setManifestError(reason instanceof NullError ? reason.message : 'A valid deployed testnet manifest is not available. Provide the reviewed deployment and matching artifact checksums to enable live recovery.');
      }
    })();
    return () => controller.abort();
  }, [open]);

  useEffect(() => {
    return () => { abortRef.current?.abort(); runRef.current++; passwordRef.current = ''; };
  }, []);
  useEffect(() => {
    if (!open) {
      abortRef.current?.abort(); runRef.current++; passwordRef.current = '';
      setPassword(''); setBusy(false); setStage('');
    }
  }, [open]);
  useEffect(() => {
    abortRef.current?.abort(); runRef.current++; setBusy(false); setSummary(undefined); setStage('');
  }, [identityKeys]);

  function close() {
    abortRef.current?.abort(); runRef.current++;
    passwordRef.current = ''; setPassword(''); setBusy(false); setStage(''); setError('');
    onClose();
  }
  function makeStore(): RecoveryStore {
    if (!manifest) throw new NullError('NULL_DEPLOYMENT_UNAVAILABLE', 'Load a valid deployed environment first.');
    return createEncryptedCheckpointStore({
      namespace: `null-${manifest.chainId}-${manifest.contracts.nullPool.slice(2).toLowerCase()}`,
      getPassword: async () => passwordRef.current,
    });
  }
  function makeClient(store: RecoveryStore): NullLiveClient {
    if (!manifest) throw new NullError('NULL_DEPLOYMENT_UNAVAILABLE', 'Load a valid deployed environment first.');
    return new NullLiveClient({ manifest, rpcUrls: [config.rpcUrl], graphUrl: forceRpc ? undefined : config.graphUrl,
      artifactBaseUrl: (import.meta.env.VITE_ARTIFACT_BASE_URL || window.location.origin) as string,
      confirmations: config.confirmations, persistLocalSecret: store.persistLocalSecret,
    });
  }
  async function work(action: (signal: AbortSignal, runId: number) => Promise<void>) {
    if (busy) return;
    const runId = ++runRef.current; const controller = new AbortController(); abortRef.current = controller;
    passwordRef.current = password; setBusy(true); setError(''); setArchiveMessage('');
    try { await action(controller.signal, runId); }
    catch (reason) { if (runId === runRef.current && openRef.current) setError(readableError(reason)); }
    finally { if (runId === runRef.current) { setBusy(false); setStage(''); } }
  }
  const stillCurrent = (signal: AbortSignal, runId: number) => !signal.aborted && runId === runRef.current && openRef.current;

  async function recover(signal: AbortSignal, runId: number) {
    if (password && password.length < 12) throw new NullError('NULL_PASSWORD_INVALID', 'Enter at least 12 characters, or leave the password blank to recover only recipient notes.');
    const store = makeStore(); const client = makeClient(store);
    setStage('Verifying the deployed contracts and asset…');
    await client.verifyDeployment({ signal });
    let checkpoints: SecretCheckpoint[] = [];
    let treasuryWarning: string | undefined;
    if (password) {
      setStage('Unlocking encrypted treasury recovery on this device…');
      try { checkpoints = (await store.load()).checkpoints.filter(checkpoint => checkpoint.kind === 'treasury' && checkpoint.context.chainId === client.context.chainId && checkpoint.context.poolAddress.toLowerCase() === client.context.poolAddress.toLowerCase()); }
      catch (reason) { treasuryWarning = `${readableError(reason)} Recipient notes can still be recovered from your unlocked profile.`; }
    }
    if (!treasuryWarning && checkpoints.length === 0) treasuryWarning = password
      ? 'No treasury recovery records were found for this pool. Restore the encrypted live recovery archive to recover its funded notes.'
      : 'Treasury recovery is locked. Enter its password or restore the encrypted live archive to recover the treasury balance.';
    let treasuryBalance: bigint | null = null;
    let treasuryNotes: OwnedTreasuryNote[] = [];
    if (checkpoints.length > 0) {
      setStage('Matching treasury notes to confirmed public history…');
      try {
        const recovered = await client.recoverTreasuryNotes(checkpoints, { signal });
        treasuryNotes = recovered.filter(item => !item.spent && item.note.amountAtomic > 0n).map(item => item.note);
        treasuryBalance = treasuryNotes.reduce((total, note) => total + note.amountAtomic, 0n);
      } catch (reason) {
        signal.throwIfAborted(); treasuryWarning = `${readableError(reason)} Treasury balance remains unavailable.`;
      }
    }
    setStage('Recovering recipient notes locally from confirmed envelopes…');
    const keys = { spendPrivateKey: new Uint8Array(identityKeys.spendPrivateKey), viewPrivateKey: new Uint8Array(identityKeys.viewPrivateKey) };
    let privateNotes;
    try { privateNotes = await client.recoverPrivateNotes({ keys, forceRpc, signal }); }
    finally { keys.spendPrivateKey.fill(0); keys.viewPrivateKey.fill(0); }
    setStage('Checking the latest confirmed block and note dates…');
    const history = await client.syncHistory({ forceRpc, signal });
    const rpc = createPublicClient({ transport: http(config.rpcUrl, { timeout: 15_000, retryCount: 1 }) });
    if (await rpc.getChainId() !== manifest!.chainId) throw new NullError('NULL_CONTEXT_MISMATCH', 'The RPC changed chains during recovery. Existing balances were kept.');
    const dates = new Map<bigint, Promise<{ hash: string; date: string }>>();
    const notes: RecoveredBalanceResult['notes'] = [];
    for (const note of privateNotes) {
      signal.throwIfAborted();
      const receipt = await rpc.getTransactionReceipt({ hash: note.transactionHash });
      if (receipt.status !== 'success' || receipt.blockNumber > history.blockNumber) throw new NullError('NULL_HISTORY_UNCONFIRMED', 'A recovered note has not reached the current confirmed history window. Refresh after the next confirmation.');
      let date = dates.get(receipt.blockNumber);
      if (!date) {
        date = rpc.getBlock({ blockNumber: receipt.blockNumber }).then(block => {
          if (block.hash !== receipt.blockHash) throw new NullError('NULL_ROOT_STALE', 'A note block changed during recovery. Refresh the confirmed history.');
          return { hash: block.hash, date: new Date(Number(block.timestamp) * 1000).toISOString() };
        });
        dates.set(receipt.blockNumber, date);
      }
      const verifiedBlock = await date;
      if (verifiedBlock.hash !== receipt.blockHash) throw new NullError('NULL_ROOT_STALE', 'A recovered note changed blocks during verification. Refresh the confirmed history.');
      notes.push({ id: note.commitment, amount: note.amountAtomic, commitment: note.commitment, createdAt: verifiedBlock.date, allocationId: note.claimNullifier });
    }
    if ((await rpc.getBlock({ blockNumber: history.blockNumber })).hash !== history.blockHash) throw new NullError('NULL_ROOT_STALE', 'Confirmed history changed before recovery finished. Existing balances were left unchanged.');
    if (!stillCurrent(signal, runId)) return;
    const privateBalance = notes.reduce((total, note) => total + note.amount, 0n);
    setSummary({ treasuryBalance, privateBalance, treasuryCount: treasuryNotes.length, privateCount: notes.length,
      blockNumber: history.blockNumber, blockHash: history.blockHash, source: history.source, checkedAt: new Date().toISOString(), treasuryWarning,
    });
    try { onRecovered({ treasuryBalance, notes }); }
    catch { setError('The balances were verified, but the page could not refresh its display. Keep this recovery result and reopen the balance screen.'); }
  }

  async function importArchive(file: File | undefined, signal: AbortSignal, runId: number) {
    if (!file) return;
    if (password.length < 12) throw new NullError('NULL_PASSWORD_INVALID', 'Enter the archive password before restoring treasury recovery.');
    if (file.size > 2_000_000) throw new NullError('NULL_RECOVERY_INVALID', 'Choose an encrypted live recovery archive under 2 MB.');
    const store = makeStore(); const client = makeClient(store);
    setStage('Verifying the pool before importing recovery…'); await client.verifyDeployment({ signal });
    setStage('Authenticating and restoring the encrypted archive locally…');
    await store.importEncrypted(await file.text());
    if (stillCurrent(signal, runId)) { setSummary(undefined); setArchiveMessage('Encrypted treasury recovery restored on this device. Select Recover balances to check the confirmed notes.'); }
  }
  async function exportArchive(signal: AbortSignal, runId: number) {
    if (password.length < 12) throw new NullError('NULL_PASSWORD_INVALID', 'Enter your local recovery password before exporting the archive.');
    const store = makeStore(); setStage('Unlocking the local recovery archive…');
    const saved = await store.load();
    if (saved.checkpoints.length === 0 && saved.policies.length === 0) throw new NullError('NULL_RECOVERY_EMPTY', 'No live recovery records are stored here. Import an archive or complete a live operation first.');
    const encrypted = await store.exportEncrypted();
    if (!stillCurrent(signal, runId)) return;
    download('null-encrypted-live-recovery.json', encrypted);
    setArchiveMessage('Encrypted live recovery downloaded. Keep the file and its password separately.');
  }

  return <Modal open={open} onClose={close} title="Recover confirmed balances" description="Your local recovery and profile keys, checked against public chain history." wide>
    <Notice icon={ShieldCheck}>Recovery stays on this device. This scan reads public history and does not send a transaction.</Notice>
    {manifestError ? <Notice tone="warning">{manifestError}<p>Live balances remain unavailable until the deployment can be verified. Existing balances have not been changed.</p></Notice>
      : !manifest ? <p className="processing-status" role="status">Loading the reviewed deployment…</p>
      : <>
        <div className="detail-list">
          <KeyValue label="Network"><Badge tone="warning">{manifest.chainId === 11155111 ? 'Sepolia testnet' : 'Local test chain'}</Badge></KeyValue>
          <KeyValue label="Pool"><span className="code-with-copy"><code>{short(manifest.contracts.nullPool)}</code><CopyButton value={manifest.contracts.nullPool} /></span></KeyValue>
        </div>
        <label className="field">Treasury recovery password <span className="field-hint">(optional)</span>
          <input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} disabled={busy} placeholder="At least 12 characters" />
          <small>Leave blank to recover recipient notes with your unlocked privacy profile. Treasury records use the password chosen when shielding or publishing.</small>
        </label>
        <div className="button-row">
          <Button variant="secondary" icon={FileUp} disabled={busy || password.length < 12} onClick={() => fileInput.current?.click()}>Restore encrypted archive</Button>
          <Button variant="ghost" icon={Download} disabled={busy || password.length < 12} onClick={() => void work(exportArchive)}>Download live recovery</Button>
        </div>
        <input ref={fileInput} type="file" hidden accept=".json,application/json" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void work((signal, runId) => importArchive(file, signal, runId)); }} />
        <p className="field-hint">This archive holds encrypted treasury notes and business policies. Restore recipient profile keys through the separate profile recovery screen.</p>
        <details className="section-block">
          <summary>Discovery settings</summary>
          <label className="checkbox-field"><input type="checkbox" checked={forceRpc} onChange={event => setForceRpc(event.target.checked)} disabled={busy} /><span>Read directly from RPC, bypassing the Graph index.</span></label>
          <p className="field-hint">Both paths verify public accumulator roots. This environment requires {config.confirmations} confirmation{config.confirmations === 1 ? '' : 's'}.</p>
        </details>
        {summary && <div className="section-block">
          <h3>Confirmed recovery results</h3>
          <div className="detail-list">
            <KeyValue label="Recovered treasury">{summary.treasuryBalance === null ? 'Unavailable' : `${money(summary.treasuryBalance, true)} USDC`}</KeyValue>
            <KeyValue label="Recipient private notes">{money(summary.privateBalance, true)} USDC</KeyValue>
            <KeyValue label="Private notes found">{summary.privateCount}</KeyValue>
            <KeyValue label="Latest checked block">{manifest.chainId === 11155111 ? <ExternalLink href={`https://sepolia.etherscan.io/block/${summary.blockNumber}`}>{summary.blockNumber.toLocaleString()}</ExternalLink> : summary.blockNumber.toLocaleString()}</KeyValue>
            <KeyValue label="Latest verification source">{summary.source === 'graph' ? 'The Graph + RPC root verification' : 'Direct RPC history'}</KeyValue>
            <KeyValue label="Recovered at">{new Date(summary.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</KeyValue>
          </div>
          {summary.treasuryWarning ? <Notice tone="warning">{summary.treasuryWarning}<p>Your recipient balance was recovered independently.</p></Notice>
            : <p className="field-hint">Treasury recovery includes {summary.treasuryCount} unspent note{summary.treasuryCount === 1 ? '' : 's'} accessible from this device and its imported archive.</p>}
          {summary.privateCount === 0 && <p className="field-hint">No claimed private notes were found for the current profile in confirmed history. Unclaimed entitlements appear in the inbox.</p>}
        </div>}
      </>}
    {archiveMessage && <Notice tone="success" icon={Check}>{archiveMessage}</Notice>}
    {busy && <p className="processing-status" role="status" aria-live="polite">{stage || 'Preparing recovery…'}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="modal-actions"><Button variant="secondary" onClick={close}>{summary ? 'Done' : busy ? 'Cancel scan' : 'Cancel'}</Button><Button icon={RefreshCw} busy={busy} disabled={!manifest || Boolean(manifestError)} onClick={() => void work(recover)}>{summary ? 'Refresh balances' : 'Recover balances'}</Button></div>
  </Modal>;
}
