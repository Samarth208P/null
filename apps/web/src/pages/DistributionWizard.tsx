import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCheck, Download, FileUp, LockKeyhole, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { parsePrivacyProfile, parseAmount, randomBytes, serializeEnvelope, type CompiledDistribution } from '@null-protocol/sdk';
import { useStore, type Distribution, type RecipientRow } from '../lib/store';
import { amount, download, money, parseCsv, stringify } from '../lib/format';
import { protocolContext, sandboxContext } from '../lib/config';
import { cryptoTask } from '../lib/worker';
import { Badge, Button, CheckItem, KeyValue, Notice, PageHeader } from '../components/ui';

import { LiveOperationLoader, type LiveOperationInput } from '../components/LiveOperationLoader';

const steps = ['Details', 'People', 'Check', 'Review'];
const preparationCheckError = 'The payment did not pass its safety check. Nothing was sent. Prepare it again to continue.';
export function DistributionWizard() {
  const store = useStore(); const existing = store.distributions.find(item => item.id === store.editingId);
  const [id] = useState(existing?.id || crypto.randomUUID());
  const [step, setStep] = useState(0); const [name, setName] = useState(existing?.name || ''); const [category, setCategory] = useState(existing?.category || 'Payroll');
  const [rows, setRows] = useState<RecipientRow[]>(existing?.recipients || []);
  const [compiled, setCompiled] = useState<CompiledDistribution | undefined>(undefined);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [acknowledged, setAcknowledged] = useState(false); const [done, setDone] = useState(false);
  const [liveOperation, setLiveOperation] = useState<LiveOperationInput | null>(null);
  const [phase, setPhase] = useState(''); const upload = useRef<HTMLInputElement>(null);
  const total = rows.reduce((sum, row) => sum + amount(row.amount), 0n);
  const draft = (status: Distribution['status'] = 'Draft'): Distribution => ({ id, name: name.trim(), category, createdAt: existing?.createdAt || new Date().toISOString(), status, recipients: rows, ...(compiled ? { compiled } : {}) });
  const validate = () => {
    if (!name.trim()) return 'Give this payment a name.';
    if (!rows.length || rows.length > 8) return 'Add between one and eight recipients.';
    const names = new Set<string>();
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index]; const ref = row.name.trim().normalize('NFKC').toLowerCase();
      if (!ref) return `Add a name for recipient ${index + 1}.`;
      if (names.has(ref)) return `Use a different name or label for recipient ${index + 1}.`;
      names.add(ref);
      try { parseAmount(row.amount); } catch { return `Recipient ${index + 1} needs a positive amount with at most six decimal places.`; }
      try { parsePrivacyProfile(row.profile); } catch { return `Check the Payment ID for recipient ${index + 1}. Ask them to copy it from NULL; it starts with st:eth:. A wallet address will not work.`; }
    }
    return '';
  };
  const updateRow = (index: number, key: keyof RecipientRow, value: string) => { setRows(items => items.map((row, i) => index === i ? { ...row, [key]: value } : row)); setCompiled(undefined); };
  async function importCsv(file?: File) {
    if (!file) return;
    try {
      if (file.size > 128000) throw new Error('Keep CSV files under 128 KB, with up to eight recipients.');
      const parsed = parseCsv(await file.text());
      const headers = parsed.shift()?.map(value => value.toLowerCase().replace(/[ _-]/g, ''));
      if (!headers || headers[0] !== 'name' || headers[1] !== 'amount' || headers[2] !== 'privacyprofile' || headers.length !== 3) throw new Error('Use the sample CSV and keep its column headings. Put each person’s Payment ID in the privacyProfile column.');
      if (parsed.length < 1 || parsed.length > 8 || parsed.some(row => row.length !== 3)) throw new Error('Include one to eight recipients, with exactly three fields per row.');
      setRows(parsed.map(row => ({ id: crypto.randomUUID(), name: row[0], amount: row[1], profile: row[2] }))); setError(''); setCompiled(undefined);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not read that CSV.'); }
    if (upload.current) upload.current.value = '';
  }
  async function prepare() {
    const invalid = validate(); if (invalid) { setError(invalid); return; }
    const context = store.mode === 'sandbox' ? sandboxContext : protocolContext;
    if (!context) { setError('Test network setup is incomplete. Open Advanced settings in Settings before continuing.'); return; }
    setBusy(true); setError(''); setPhase('Preparing payment…');
    const entropy = randomBytes(32);
    try {
      const options = { recipients: rows.map(row => ({ employeeRef: row.name, amountAtomic: parseAmount(row.amount), stealthMetaAddress: row.profile })), context, batchEntropy: entropy };
      const first = await cryptoTask('compile', options);
      setPhase('Checking payment details…');
      const second = await cryptoTask('compile', options);
      if (stringify(first.publicBundle) !== stringify(second.publicBundle) || first.allocationRoot !== second.allocationRoot || first.envelopes.length !== 8 || new Set(first.envelopes.map(envelope => serializeEnvelope(envelope).length)).size !== 1) throw new Error(preparationCheckError);
      setCompiled(first); setStep(2);
    } catch (reason) { setError(reason instanceof Error && reason.message === preparationCheckError ? preparationCheckError : 'Could not prepare this payment. Nothing has been sent. Try again.'); }
    finally { entropy.fill(0); setBusy(false); setPhase(''); }
  }
  async function publish() {
    if (!acknowledged || !compiled || busy) return;
    setBusy(true); setError('');
    try { store.publish(draft('Prepared')); setDone(true); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not finish this practice payment. Try again.'); } finally { setBusy(false); }
  }
  if (done) return <><PageHeader title="Practice payment sent" description="This payment is available for this browser session." /><div className="completion"><span className="completion-icon"><CheckCheck size={30} strokeWidth={1.5} /></span><Badge tone="success">Sent in practice</Badge><h2>{name}</h2><p>Recipients can now collect their practice payments in this browser session.</p><div className="completion-details"><KeyValue label="Total">{money(total, true)} USDC</KeyValue><KeyValue label="Recipients">{rows.length}</KeyValue></div><Notice>No real money moved. Practice mode does not request organization approval.</Notice><div className="button-row"><Button onClick={() => store.navigate('distributions')}>View payments<ArrowRight size={16} /></Button></div><p className="field-hint">If you used sample recipients, switch to Individual in Settings to try collecting.</p></div></>;
  return <>
    <PageHeader title={existing ? 'Prepare payment' : 'New payment'} breadcrumb="Payments" description="Choose who to pay and how much to send." action={<div className="button-row">{existing && <Button variant="ghost" icon={Trash2} onClick={() => { store.removeDraft(id); store.toast('Draft discarded.'); store.navigate('distributions'); }}>Discard draft</Button>}<Button variant="secondary" onClick={() => { if (!name.trim()) { setError('Give your draft a name before saving.'); return; } store.saveDistribution(draft(compiled ? 'Prepared' : 'Draft')); store.toast('Draft saved for this session.'); store.navigate('distributions'); }}>Save draft</Button></div>} />
    <div className="wizard-layout"><div className="wizard-main"><ol className="stepper">{steps.map((label, index) => <li key={label} className={step === index ? 'current' : step > index ? 'complete' : ''} aria-current={step === index ? 'step' : undefined}><span>{step > index ? <Check size={13} /> : index + 1}</span><strong>{label}</strong></li>)}</ol>
      <div className="wizard-surface">
      {step === 0 && <><div className="form-section-heading"><h2>What’s this payment for?</h2><p>Choose a name that helps you find it later.</p></div><label className="field">Payment name<input maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. September payroll" autoFocus /><small>This name stays in your workspace.</small></label><label className="field">Payment type<select value={category} onChange={event => setCategory(event.target.value)}>{['Payroll', 'Contractors', 'Grants', 'Contributors', 'Other payouts'].map(value => <option key={value}>{value}</option>)}</select></label><Notice>{store.mode === 'sandbox' ? 'Practice mode uses sample USDC. No real money moves.' : 'This payment uses test USDC. Withdrawals are not available.'}</Notice></>}
      {step === 1 && <><div className="form-section-heading"><h2>Who are you paying?</h2><p>Add up to eight people. Ask each person for their Payment ID from NULL; a wallet address will not work.</p></div><div className="import-strip"><FileUp size={22} strokeWidth={1.5} /><div><strong>Import recipients from CSV</strong><p>Use the sample file for names, amounts and Payment IDs.</p></div><Button variant="secondary" onClick={() => upload.current?.click()}>Choose file</Button><input ref={upload} type="file" accept=".csv,text/csv" hidden onChange={event => void importCsv(event.target.files?.[0])} /></div><div className="import-options"><button className="text-link" onClick={() => download('null-payroll-template.csv', 'name,amount,privacyProfile\n' + store.recipients.map(row => `"${row.name.replaceAll('"', '""')}",${row.amount},${row.profile}`).join('\n'), 'text/csv')}>Download sample CSV<Download size={13} /></button>{store.mode === 'sandbox' && <button className="text-link" onClick={() => { setRows(store.recipients.map(row => ({ ...row, id: crypto.randomUUID() }))); setCompiled(undefined); }}>Use sample recipients</button>}</div>
      <div className="recipient-editor">{rows.map((row, index) => <div className="recipient-edit-row" key={row.id}><div className="recipient-row-heading"><span className="person-avatar">{row.name.trim().slice(0, 1).toUpperCase() || index + 1}</span><strong>Recipient {index + 1}</strong><button className="icon-button" aria-label={`Remove recipient ${index + 1}`} onClick={() => { setRows(items => items.filter(item => item.id !== row.id)); setCompiled(undefined); }}><Trash2 size={15} /></button></div><div className="form-two"><label className="field">Name or label<input value={row.name} maxLength={100} onChange={event => updateRow(index, 'name', event.target.value)} placeholder="Alice Chen" /></label><label className="field">Amount in USDC<input value={row.amount} inputMode="decimal" onChange={event => updateRow(index, 'amount', event.target.value)} placeholder="0.00" /><small>Use a positive amount with up to six decimal places.</small></label></div><label className="field">Payment ID<input className="mono-input" value={row.profile} onChange={event => updateRow(index, 'profile', event.target.value.trim())} placeholder="st:eth:0x…" spellCheck={false} autoComplete="off" /></label></div>)}</div>{rows.length < 8 && <Button variant="secondary" icon={Plus} className="add-recipient" onClick={() => setRows(items => [...items, { id: crypto.randomUUID(), name: '', amount: '', profile: '' }])}>Add recipient</Button>}<p className="field-hint"><LockKeyhole size={13} />Your CSV is read on this device and kept only for this session.</p></>}
      {step === 2 && compiled && <><div className="form-section-heading"><span className="inline-success"><ShieldCheck size={20} />Payment details checked</span><h2>Ready to review</h2><p>Your recipient details and amounts are ready. Nothing has been sent.</p></div><div className="preflight-summary"><KeyValue label="Recipients">{compiled.realCount}</KeyValue><KeyValue label="Total">{money(total, true)} USDC</KeyValue></div><Notice>{store.mode === 'sandbox' ? 'Next, review and complete your practice payment. It will be available for this browser session only.' : 'Next, review your payment. Your organization must approve it before you can send it on the test network.'}</Notice></>}
      {step === 3 && compiled && <><div className="form-section-heading"><h2>Review your payment</h2><p>{store.mode === 'sandbox' ? 'Check the amount before completing this practice payment.' : 'Check the amount before continuing to organization approval.'}</p></div><div className="review-amount"><span>{name}</span><strong>{money(total, true)}<small>USDC</small></strong></div><div className="detail-list"><KeyValue label="Payment type">{category}</KeyValue><KeyValue label="Recipients">{rows.length}</KeyValue><KeyValue label="Pay from">{store.mode === 'sandbox' ? 'Practice funds' : 'Test network funds'}</KeyValue><KeyValue label="Remaining balance">{store.mode === 'sandbox' ? `${money(store.treasury - total)} USDC` : 'Checked in the next step'}</KeyValue></div>{store.mode === 'sandbox' ? <label className="checkbox-field"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} /><span>This is a practice payment for this browser session. No real money moves and no organization approval is requested.</span></label> : <Notice tone="warning">Next, unlock your funds and get your organization’s approval. You will review the payment again before sending it.</Notice>}</>}
      {error && <div className="form-error" role="alert">{error}</div>}{busy && <p className="processing-status" role="status">{phase}</p>}
      <div className="wizard-actions"><Button variant="ghost" icon={ArrowLeft} disabled={busy} onClick={() => { setError(''); step === 0 ? store.navigate('distributions') : setStep(step - 1); }}>{step === 0 ? 'Cancel' : 'Back'}</Button>{step === 0 ? <Button onClick={() => { if (!name.trim()) { setError('Give this payment a name.'); return; } setError(''); setStep(1); }}>Add recipients<ArrowRight size={15} /></Button> : step === 1 ? <Button busy={busy} icon={ShieldCheck} onClick={() => void prepare()}>Check payment</Button> : step === 2 ? <Button onClick={() => setStep(3)}>Review payment<ArrowRight size={15} /></Button> : store.mode === 'sandbox' ? <Button busy={busy} disabled={!acknowledged || total > store.treasury} onClick={() => void publish()}>Complete practice payment<ArrowRight size={15} /></Button> : <Button icon={ShieldCheck} onClick={() => { if (compiled) setLiveOperation({ kind: 'create_distribution', compiled }); }}>Continue to approval</Button>}</div></div></div>
      <aside className="wizard-aside"><div className="summary-heading"><LockKeyhole size={17} /><h3>Payment summary</h3></div><KeyValue label="Recipients">{rows.length}</KeyValue><div className="summary-total"><span>Total payment</span><strong>{money(total)}<small>USDC</small></strong></div><div className="aside-rule" /><CheckItem description="Your payment name stays in this workspace.">Private details</CheckItem><CheckItem description="You review the payment before sending.">You’re in control</CheckItem>{total > store.treasury && store.mode === 'sandbox' && <Notice tone="warning">You need more practice funds for this payment. Open Funds to add them.</Notice>}</aside>
    </div>
    <LiveOperationLoader operation={liveOperation} onClose={() => setLiveOperation(null)} onConfirmed={result => { store.saveDistribution({ ...draft('Confirmed'), transactionHash: result.transactionHash }); store.toast('Payment confirmed on the test network.'); }} />
  </>;
}
