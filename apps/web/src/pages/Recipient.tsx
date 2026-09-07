import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Copy, Download, Inbox, KeyRound, LockKeyhole, RefreshCw, ShieldCheck } from 'lucide-react';
import { buildPrivateNote, finalizePrivateNote, type DiscoveredAllocation } from '@null-protocol/sdk';
import { createDiscoveryClient } from '@null-protocol/graph-client';
import { useStore } from '../lib/store';
import { config, protocolContext, sandboxContext } from '../lib/config';
import { date, money } from '../lib/format';
import { cryptoTask } from '../lib/worker';
import { Badge, Button, EmptyState, Modal, Notice, PageHeader, SectionTitle } from '../components/ui';
import { Recovery } from '../components/Recovery';
import { LiveOperationLoader, type LiveOperationInput } from '../components/LiveOperationLoader';

export function PrivateInbox() {
  const store = useStore();
  const [allocations, setAllocations] = useState<DiscoveredAllocation[]>([]);
  const currentAllocations = useRef<DiscoveredAllocation[]>([]);
  const [liveOperation, setLiveOperation] = useState<LiveOperationInput | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [error, setError] = useState('');
  const [forceRpc, setForceRpc] = useState(false);
  const [recovery, setRecovery] = useState<'export' | 'restore' | null>(null);
  const [selected, setSelected] = useState<DiscoveredAllocation | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [profileExpanded, setProfileExpanded] = useState(false);
  const [copyError, setCopyError] = useState('');
  useEffect(() => () => { for (const item of currentAllocations.current) item.stealthPrivateKey.fill(0); }, []);
  useEffect(() => {
    for (const item of currentAllocations.current) item.stealthPrivateKey.fill(0);
    currentAllocations.current = [];
    setAllocations([]); setScanned(false); setSelected(null); setError(''); setCopyError('');
  }, [store.mode, store.identity]);
  const consumed = new Set(store.notes.map(note => note.allocationId));
  const available = allocations.filter(item => !consumed.has(item.id));

  async function copyProfile() {
    setCopyError('');
    try {
      await navigator.clipboard.writeText(store.identity.profile.stealthMetaAddress);
      store.toast('Payment ID copied. Share it with the person paying you.');
    } catch {
      setProfileExpanded(true);
      setCopyError('Could not copy. Select your Payment ID below and copy it.');
    }
  }

  async function scan(useAnotherConnection = forceRpc) {
    setScanning(true); setError('');
    try {
      let result: DiscoveredAllocation[];
      if (store.mode === 'sandbox') {
        const published = store.distributions.filter(item => item.status === 'Published locally' && item.compiled).map(item => item.compiled!);
        result = await cryptoTask('scan', { envelopes: published.flatMap(item => item.envelopes), distributions: published.map(item => item.publicBundle), keys: store.identity.keys, context: sandboxContext, source: 'local' });
      } else {
        if (!protocolContext || !config.poolAddress) throw new Error('The test network is not ready. Open Settings to check the connection.');
        const client = createDiscoveryClient({ chainId: Number(config.chainId), pool: config.poolAddress, fromBlock: config.deploymentBlock, rpcUrls: [config.rpcUrl], graphUrl: config.graphUrl, confirmations: config.confirmations });
        const page = await client.scan({ forceRpc: useAnotherConnection });
        result = await cryptoTask('scan', { envelopes: page.envelopes, distributions: page.distributions, keys: store.identity.keys, context: protocolContext, source: 'chain' });
        const spent = new Set(page.consumptions.map(item => item.nullifier.toLowerCase()));
        result = result.filter(item => { if (spent.has(item.id.toLowerCase())) { item.stealthPrivateKey.fill(0); return false; } return true; });
      }
      for (const item of currentAllocations.current) item.stealthPrivateKey.fill(0);
      currentAllocations.current = result; setAllocations(result); setScanned(true);
    } catch (reason) {
      setError(reason instanceof Error && reason.message === 'The test network is not ready. Open Settings to check the connection.' ? reason.message : 'Could not check for payments. Try again or check the connection in Settings.');
    } finally { setScanning(false); }
  }

  function claim() {
    if (!selected || claiming || store.mode !== 'sandbox') return;
    setClaiming(true);
    try {
      if (consumed.has(selected.id)) throw new Error('This payment has already been collected.');
      const draft = buildPrivateNote(selected); const note = finalizePrivateNote(draft, store.notes.length);
      store.addNote({ id: crypto.randomUUID(), amount: note.amountAtomic, commitment: note.commitment, allocationId: selected.id, createdAt: new Date().toISOString() });
      setSelected(null); store.toast('Practice payment collected. View it in your balance.');
    } catch { setError('Could not collect this practice payment. Check your inbox again.'); }
    finally { setClaiming(false); }
  }

  return <>
    <PageHeader title="Your inbox" description="Find and collect payments sent to you." action={<Button icon={RefreshCw} busy={scanning} onClick={() => void scan()}>{scanning ? 'Checking payments…' : scanned ? 'Check again' : 'Check for payments'}</Button>} />
    <div className="inbox-profile recipient-profile">
      <span className="profile-symbol"><KeyRound size={21} strokeWidth={1.6} /></span>
      <div><strong>Your Payment ID</strong><p>Share this with the person paying you. It is different from your wallet address.</p></div>
      <Button variant="secondary" icon={Copy} onClick={() => void copyProfile()}>Copy Payment ID</Button>
    </div>
    <p className="profile-recovery-hint">Signing in alone does not restore access to your payments. <button className="text-link" onClick={() => setRecovery('export')}>Save backup</button> so you can use your Payment ID again.</p>
    <div className="inbox-toolbar"><div><h2>Payments</h2>{scanned && <Badge>{available.length} available</Badge>}</div>{store.notes.length > 0 && <button className="text-link" onClick={() => store.navigate('balance')}>View balance<ArrowRight size={14} /></button>}</div>
    {error && <div className="form-error" role="alert">{error}{store.mode === 'testnet' && <Button variant="ghost" disabled={scanning} onClick={() => { setForceRpc(true); void scan(true); }}>Try another connection</Button>}</div>}
    {scanning ? <div className="scan-loading" role="status"><span className="skeleton skeleton-title" /><span className="skeleton" /><span className="skeleton skeleton-short" /><p>Checking for payments on your device…</p></div> : available.length ? <div className="entitlement-list">{available.map((item, index) => <article className="entitlement" key={item.id}>
      <div className="entitlement-top"><span className="entitlement-symbol"><Inbox size={22} strokeWidth={1.5} /></span><Badge tone={item.source === 'local' || item.confirmed ? 'success' : 'warning'} dot>{item.source === 'local' || item.confirmed ? 'Ready to collect' : 'Waiting for confirmation'}</Badge></div>
      <h3>{store.distributions.find(distribution => distribution.compiled?.commitment === item.distributionCommitment)?.name || `Payment ${index + 1}`}</h3>
      <div className="entitlement-amount">{store.hideBalances ? '••••••' : money(item.amountAtomic, true)}<span>USDC</span></div>
      <p className="entitlement-privacy">{item.source === 'local' ? 'Practice payment. No real money is transferred.' : item.confirmed ? 'Collect this test payment to add it to your balance.' : 'The test network is still confirming this payment.'}</p>
      <Button disabled={item.source === 'chain' && !item.confirmed} onClick={() => setSelected(item)}>Collect payment<ArrowRight size={15} /></Button>
    </article>)}</div> : <div className="inbox-empty"><EmptyState icon={Inbox} title={scanned ? allocations.length ? 'All payments collected' : 'No new payments' : 'Ready to receive'} description={scanned ? allocations.length ? 'Your collected payments are in your balance. Check again when someone sends you another payment.' : 'No payments are waiting for this Payment ID. If you used another device, restore your backup first.' : 'Share your Payment ID with the person paying you, then check for payments here.'} action={scanned && !allocations.length ? <Button variant="secondary" icon={KeyRound} onClick={() => setRecovery('restore')}>Restore backup</Button> : undefined} /></div>}
    <div className="inbox-footnote"><ShieldCheck size={15} /><span>{store.mode === 'sandbox' ? 'Practice payments reset when you reload this page.' : 'These payments use test money.'}</span></div>
    <details className="progressive-details" open={profileExpanded} onToggle={event => setProfileExpanded(event.currentTarget.open)}>
      <summary>Payment ID and backup</summary>
      <p>Restore your backup to use the same Payment ID on another device. You can share this ID, but keep your backup and password private.</p>
      <label className="field">Payment ID<textarea className="mono-input" readOnly rows={3} value={store.identity.profile.stealthMetaAddress} onFocus={event => event.currentTarget.select()} /></label>
      {copyError && <p className="form-error" role="alert">{copyError}</p>}
      <div className="button-row"><Button variant="secondary" icon={Download} onClick={() => setRecovery('export')}>Save backup</Button><Button variant="ghost" onClick={() => setRecovery('restore')}>Restore backup</Button></div>
    </details>
    <Modal title="Collect payment" description="Add this payment to your balance." open={!!selected} onClose={() => { if (!claiming) setSelected(null); }}>
      {selected && <>
        <div className="claim-amount">{store.hideBalances ? '••••••' : money(selected.amountAtomic, true)}<span>USDC</span></div>
        {selected.source === 'local' ? <Notice>This adds sample money to your practice balance. No real money is transferred, and it resets when you reload this page.</Notice> : <Notice tone="warning">This is test money. Next, save a backup and choose how to confirm the payment. It appears in your balance after the test network confirms it. Withdrawals aren’t available yet.</Notice>}
        <div className="modal-actions"><Button variant="secondary" onClick={() => setSelected(null)}>Keep in inbox</Button><Button busy={claiming} icon={LockKeyhole} onClick={() => { if (selected.source === 'local') claim(); else { setLiveOperation({ kind: 'claim', allocation: selected }); setSelected(null); } }}>{selected.source === 'local' ? 'Collect payment' : 'Continue'}</Button></div>
      </>}
    </Modal>
    <LiveOperationLoader operation={liveOperation} onClose={() => setLiveOperation(null)} onConfirmed={result => { if ('claimNullifier' in result.note) store.addNote({ id: crypto.randomUUID(), amount: result.note.amountAtomic, commitment: result.note.commitment, allocationId: result.note.claimNullifier, createdAt: new Date().toISOString() }); store.toast('Payment collected. Confirmed by the test network.'); }} />
    <Recovery key={recovery || 'closed'} open={recovery !== null} initialMode={recovery || 'export'} onClose={() => setRecovery(null)} />
  </>;
}

export function PrivateBalance() {
  const store = useStore();
  const [recovery, setRecovery] = useState(false);
  const [withdraw, setWithdraw] = useState(false);
  const total = store.notes.reduce((sum, note) => sum + note.amount, 0n);

  return <>
    <PageHeader title="Your balance" description="Payments you have collected." action={store.mode === 'testnet' ? <Button variant="secondary" icon={RefreshCw} onClick={store.recoverLiveBalances}>Restore balance</Button> : undefined} />
    <div className="private-balance-panel">
      <div className="balance-label"><span><LockKeyhole size={18} />Balance</span><Badge tone="purple">{store.mode === 'sandbox' ? 'Practice mode' : 'Test money'}</Badge></div>
      <div className="balance-value">{store.hideBalances ? '••••••' : money(total)}<span>USDC</span></div>
      <p>{store.notes.length} collected payment{store.notes.length !== 1 ? 's' : ''} loaded on this page</p>
      <p>Withdrawals aren’t available yet.</p>
      <Button onClick={() => store.navigate('inbox')}>Open inbox<ArrowRight size={15} /></Button>
      <div className="balance-bottom-note"><ShieldCheck size={16} />{store.mode === 'sandbox' ? 'Sample money only. No real money is transferred.' : 'Missing payments? Restore your balance to check your saved payments.'}</div>
    </div>
    <section className="section-block">
      <SectionTitle title="Collected payments" caption={store.mode === 'sandbox' ? 'Practice payments reset when you reload this page.' : 'Confirmed test payments loaded on this page.'} />
      <div className="table-panel">{store.notes.length ? <div className="table-scroll"><table>
        <thead><tr><th>Payment</th><th>Amount</th><th>Collected</th></tr></thead>
        <tbody>{store.notes.map((note, index) => <tr key={note.id}>
          <td><strong>Payment {index + 1}</strong></td>
          <td className="numeric">{store.hideBalances ? '••••••' : money(note.amount, true)} <span className="currency">USDC</span></td>
          <td>{date(note.createdAt)}</td>
        </tr>)}</tbody>
      </table></div> : <EmptyState icon={LockKeyhole} title="No collected payments yet" description="Open your inbox to find and collect payments. They will appear here." />}</div>
    </section>
    <details className="progressive-details">
      <summary>Backup and withdrawals</summary>
      <p>Save a backup to keep access to your Payment ID. It does not save practice payments or drafts.</p>
      <div className="button-row"><Button variant="secondary" icon={Download} onClick={() => setRecovery(true)}>Save backup</Button><Button variant="ghost" onClick={() => setWithdraw(true)}>About withdrawals<ArrowUpRight size={14} /></Button></div>
    </details>
    <Recovery key={recovery ? 'open' : 'closed'} open={recovery} onClose={() => setRecovery(false)} />
    <Modal title="About withdrawals" description="You cannot withdraw money in this version." open={withdraw} onClose={() => setWithdraw(false)}>
      <Notice tone="warning" icon={ArrowUpRight}>You can collect payments and view your balance here. Sending that balance to a wallet is not available yet.</Notice>
      <p className="modal-copy">Practice balances are sample money and cannot be cashed out.</p>
      <div className="modal-actions"><Button onClick={() => setWithdraw(false)}>Done</Button></div>
    </Modal>
  </>;
}
