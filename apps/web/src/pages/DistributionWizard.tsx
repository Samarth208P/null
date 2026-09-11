import { useRef, useState, type SetStateAction } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCheck, Download, FileUp, LockKeyhole, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { parsePrivacyProfile, parseAmount, randomBytes, serializeEnvelope, toHex, type CompiledDistribution } from '@null-protocol/sdk';
import { useStore, type Distribution, type RecipientRow } from '../lib/store';
import { amount, download, money, parseCsv, stringify } from '../lib/format';
import { protocolContext, sandboxContext } from '../lib/config';
import { cryptoTask } from '../lib/worker';
import { Badge, Button, KeyValue, Notice, PageHeader } from '../components/ui';

import { LiveOperationLoader, type LiveOperationInput } from '../components/LiveOperationLoader';
import { CreVerification } from '../components/CreVerification';
import type { CrePayrollExport } from '../lib/cre';
import { PaymentDestination } from '../components/PaymentDestination';
import { PaymentNameError, paymentDestination, recheckPaymentNames, requiredPaymentNames, recheckRequiredPaymentNames } from '@null-protocol/ens';
import { ensClient } from '../lib/ens';

const steps = ['Details', 'People', 'Check', 'Review'];
const preparationCheckError = 'The payment did not pass its safety check. Nothing was sent. Prepare it again to continue.';
export function DistributionWizard() {
  const store = useStore(); const existing = store.distributions.find(item => item.id === store.editingId);
  const [id] = useState(existing?.id || crypto.randomUUID());
  const [step, setStep] = useState(0); const [name, setName] = useState(existing?.name || ''); const [category, setCategory] = useState(existing?.category || 'Payroll');
  const [rows, setRowsState] = useState<RecipientRow[]>(existing?.recipients || []);
  const rowVersion = useRef(0), preparing = useRef(false);
  const setRows = (next: SetStateAction<RecipientRow[]>) => { setError(''); rowVersion.current++; setRowsState(next); setCompiled(undefined); setCreVerified(false); };
  const [compiled, setCompiled] = useState<CompiledDistribution | undefined>(undefined);
  const [creRequired, setCreRequired] = useState(store.mode === 'testnet');
  const [crePayroll, setCrePayroll] = useState<CrePayrollExport>();
  const [creVerified, setCreVerified] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [acknowledged, setAcknowledged] = useState(false); const [done, setDone] = useState(false);
  const [liveOperation, setLiveOperation] = useState<LiveOperationInput | null>(null);
  const [phase, setPhase] = useState(''); const upload = useRef<HTMLInputElement>(null);
  const total = rows.reduce((sum, row) => sum + amount(row.amount), 0n);
  const draft = (status: Distribution['status'] = 'Draft'): Distribution => ({ id, name: name.trim(), category, createdAt: existing?.createdAt || new Date().toISOString(), status, recipients: rows, ...(compiled ? { compiled } : {}) });
  const validate = () => {
    if (!name.trim()) return 'Give this payment a name.';
    if (!rows.length || rows.length > 8) return 'Add between one and eight recipients.';
    if (store.mode === 'testnet') {
      try { requiredPaymentNames(rows); } catch (reason) { return reason instanceof PaymentNameError ? reason.message : 'Check every recipient’s ENS payment name.'; }
    }
    const names = new Set<string>();
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index]; const ref = row.name.trim().normalize('NFKC').toLowerCase();
      if (!ref) return `Add a name for recipient ${index + 1}.`;
      if (names.has(ref)) return `Use a different name or label for recipient ${index + 1}.`;
      names.add(ref);
      try { parseAmount(row.amount); } catch { return `Recipient ${index + 1} needs a positive amount with at most six decimal places.`; }
      try {
        const destination = paymentDestination(row.destination ?? row.profile);
        if (destination.kind === 'name' && (!row.paymentName || row.paymentName.name !== destination.name || row.paymentName.profile !== row.profile)) return `Check and confirm the ENS name for recipient ${index + 1}.`;
        parsePrivacyProfile(row.profile);
      } catch { return `Check the ENS name or Payment ID for recipient ${index + 1}. Ask them to share it from NULL; a wallet address will not work.`; }
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
      if (!headers || headers[0] !== 'name' || headers[1] !== 'amount' || !['privacyprofile', 'paymentdestination'].includes(headers[2]) || headers.length !== 3) throw new Error('Use the CSV template. Put each person’s ENS payment name in the paymentDestination column.');
      if (parsed.length < 1 || parsed.length > 8 || parsed.some(row => row.length !== 3)) throw new Error('Include one to eight recipients, with exactly three fields per row.');
      if (store.mode === 'testnet' && parsed.some(row => paymentDestination(row[2]).kind !== 'name')) throw new Error('Every CSV recipient needs an ENS payment name. Ask recipients to link their Payment IDs in their NULL inboxes first.');
      setRows(parsed.map(row => ({ id: crypto.randomUUID(), name: row[0], amount: row[1], destination: row[2].trim(), profile: row[2].trim().startsWith('st:eth:') ? row[2].trim() : '' }))); setError(''); setCompiled(undefined);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not read that CSV.'); }
    if (upload.current) upload.current.value = '';
  }
  async function prepare() {
    if (preparing.current) return;
    const invalid = validate(); if (invalid) { setError(invalid); return; }
    const context = store.mode === 'sandbox' ? sandboxContext : protocolContext;
    if (!context) { setError('Test network setup is incomplete. Open Advanced settings in Settings before continuing.'); return; }
    preparing.current = true; const version = rowVersion.current;
    setBusy(true); setError(''); setPhase('Preparing payment…'); setCreVerified(false); setCrePayroll(undefined);
    const entropy = randomBytes(32);
    try {
      setPhase('Checking recipient names on Sepolia…');
      if (store.mode === 'testnet') await recheckRequiredPaymentNames(ensClient, requiredPaymentNames(rows), rows.length);
      else await recheckPaymentNames(ensClient, rows.flatMap(row => row.paymentName ? [row.paymentName] : []));
      setPhase('Preparing payment…');
      const options = { recipients: rows.map(row => ({ employeeRef: row.name, amountAtomic: parseAmount(row.amount), stealthMetaAddress: row.profile })), context, batchEntropy: entropy };
      const first = await cryptoTask('compile', options);
      setPhase('Checking payment details…');
      const second = await cryptoTask('compile', options);
      if (stringify(first.publicBundle) !== stringify(second.publicBundle) || first.allocationRoot !== second.allocationRoot || first.envelopes.length !== 8 || new Set(first.envelopes.map(envelope => serializeEnvelope(envelope).length)).size !== 1) throw new Error(preparationCheckError);
      if (version !== rowVersion.current) throw new PaymentNameError('changed', 'The recipients changed during preparation. Check this payment again. Nothing was sent.');
      setCompiled(first);
      if (creRequired) setCrePayroll({ batchId: crypto.randomUUID(), batchEntropyHex: toHex(entropy), recipients: options.recipients.map(recipient => ({ ...recipient, amountAtomic: recipient.amountAtomic.toString() })) });
      setStep(2);
    } catch (reason) { setCompiled(undefined); setError(reason instanceof PaymentNameError ? reason.message : reason instanceof Error && reason.message === preparationCheckError ? preparationCheckError : 'Could not prepare this payment. Nothing has been sent. Try again.'); }
    finally { entropy.fill(0); preparing.current = false; setBusy(false); setPhase(''); }
  }
  async function publish() {
    if (!acknowledged || !compiled || busy || creRequired && !creVerified) return;
    setBusy(true); setError('');
    try { store.publish(draft('Prepared')); setDone(true); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not finish this practice payment. Try again.'); } finally { setBusy(false); }
  }
  if (done) return <><PageHeader title="Practice payment sent" description="This payment is available for this browser session." /><div className="completion"><span className="completion-icon"><CheckCheck size={30} strokeWidth={1.5} /></span><Badge tone="success">Sent in practice</Badge><h2>{name}</h2><p>Recipients can now collect their practice payments in this browser session.</p><div className="completion-details"><KeyValue label="Total">{money(total, true)} USDC</KeyValue><KeyValue label="Recipients">{rows.length}</KeyValue></div><Notice>No real money moved. Practice mode does not request organization approval.</Notice><div className="button-row"><Button onClick={() => store.navigate('distributions')}>View payments<ArrowRight size={16} /></Button></div><p className="field-hint">If you used sample recipients, switch to Individual in Settings to try collecting.</p></div></>;
  return <>
    <PageHeader title={existing ? 'Prepare payment' : 'New payment'} action={<div className="button-row">{existing && <Button variant="ghost" icon={Trash2} onClick={() => { store.removeDraft(id); store.toast('Draft discarded.'); store.navigate('distributions'); }}>Discard draft</Button>}<Button variant="secondary" disabled={busy} onClick={() => { if (!name.trim()) { setError('Give your draft a name before saving.'); return; } store.saveDistribution(draft(compiled ? 'Prepared' : 'Draft')); store.toast('Draft saved for this session.'); store.navigate('distributions'); }}>Save draft</Button></div>} />
    <div className="wizard-layout"><div className="wizard-main"><ol className="stepper">{steps.map((label, index) => <li key={label} className={step === index ? 'current' : step > index ? 'complete' : ''} aria-current={step === index ? 'step' : undefined}><span>{step > index ? <Check size={13} /> : index + 1}</span><strong>{label}</strong></li>)}</ol>
      <fieldset className="wizard-surface" disabled={busy}>
      {step === 0 && <><div className="form-section-heading"><h2>Payment details</h2></div><label className="field">Payment name<input maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. September payroll" autoFocus /></label><label className="field">Payment type<select value={category} onChange={event => setCategory(event.target.value)}>{['Payroll', 'Contractors', 'Grants', 'Contributors', 'Other payouts'].map(value => <option key={value}>{value}</option>)}</select></label><Notice>{store.mode === 'sandbox' ? 'Practice mode uses sample USDC. No real money moves.' : 'Test USDC only. Withdrawals reveal the destination and amount.'}</Notice></>}
      {step === 1 && <><div className="form-section-heading"><h2>Who are you paying?</h2><p>Up to 8 recipients. Every testnet recipient needs a linked ENS payment name.</p></div><div className="import-strip"><FileUp size={22} strokeWidth={1.5} /><div><strong>Import CSV</strong></div><Button variant="secondary" onClick={() => upload.current?.click()}>Choose file</Button><input ref={upload} type="file" accept=".csv,text/csv" hidden onChange={event => void importCsv(event.target.files?.[0])} /></div><div className="import-options"><button className="text-link" onClick={() => download('null-payroll-template.csv', 'name,amount,paymentDestination\n' + (store.mode === 'sandbox' ? store.recipients.map(row => `"${row.name.replaceAll('"', '""')}",${row.amount},${row.profile}`).join('\n') : ''), 'text/csv')}>Download CSV template<Download size={13} /></button>{store.mode === 'sandbox' && <button className="text-link" onClick={() => { setRows(store.recipients.map(row => ({ ...row, id: crypto.randomUUID() }))); setCompiled(undefined); }}>Use sample recipients</button>}</div>
      <fieldset className="recipient-editor" disabled={busy}>{rows.map((row, index) => <div className="recipient-edit-row" key={row.id}><div className="recipient-row-heading"><span className="person-avatar">{row.name.trim().slice(0, 1).toUpperCase() || index + 1}</span><strong>Recipient {index + 1}</strong><button className="icon-button" aria-label={`Remove recipient ${index + 1}`} onClick={() => { setRows(items => items.filter(item => item.id !== row.id)); setCompiled(undefined); }}><Trash2 size={15} /></button></div><div className="form-two"><label className="field">Name or label<input value={row.name} maxLength={100} onChange={event => updateRow(index, 'name', event.target.value)} placeholder="Alice Chen" /></label><label className="field">Amount in USDC<input value={row.amount} inputMode="decimal" onChange={event => updateRow(index, 'amount', event.target.value)} placeholder="0.00" /></label></div><PaymentDestination row={row} onChange={(destination, profile, paymentName) => { setRows(items => items.map(item => item.id === row.id ? { ...item, destination, profile, paymentName } : item)); setCompiled(undefined); setCreVerified(false); setAcknowledged(false); }} /></div>)}</fieldset>{rows.length < 8 && <Button variant="secondary" icon={Plus} className="add-recipient" onClick={() => setRows(items => [...items, { id: crypto.randomUUID(), name: '', amount: '', profile: '' }])}>Add recipient</Button>}<p className="field-hint"><LockKeyhole size={13} />Drafts and CSV data last for this session.</p></>}
      {step === 1 && store.mode === 'testnet' && <label className="checkbox-field"><input type="checkbox" checked={creRequired} onChange={event => { setCreRequired(event.target.checked); setCreVerified(false); setCrePayroll(undefined); setCompiled(undefined); }} /><span>Verify with Chainlink CRE (local simulation)</span></label>}
      {step === 2 && compiled && <><div className="form-section-heading"><h2>{creRequired && !creVerified ? "Complete the CRE check" : "Ready to review"}</h2><p>Nothing sent yet.</p></div><div className="preflight-summary"><KeyValue label="Recipients">{compiled.realCount}</KeyValue><KeyValue label="Total">{money(total, true)} USDC</KeyValue></div><Notice>{store.mode === 'sandbox' ? 'Next, review and complete your practice payment. It will be available for this browser session only.' : 'Organization approval is required before sending.'}</Notice></>}
      {step === 2 && compiled && creRequired && crePayroll && <CreVerification payroll={crePayroll} expected={compiled.publicBundle} onVerified={bundle => { setCompiled(current => current ? { ...current, publicBundle: bundle, envelopes: bundle.envelopes } : current); setCreVerified(true); setCrePayroll(undefined); }} />}
      {step === 2 && compiled && creRequired && creVerified && <Notice>CRE result matches. Local simulation only; no remote enclave attestation.</Notice>}
      {step === 3 && compiled && <><div className="form-section-heading"><h2>Review your payment</h2><p>{store.mode === 'sandbox' ? 'Check the amount before completing this practice payment.' : 'Check recipients and amounts.'}</p></div><div className="review-amount"><span>{name}</span><strong>{money(total, true)}<small>USDC</small></strong></div><div className="review-recipients">{rows.map(row => <div key={row.id}><strong>{row.name}</strong><span>{money(parseAmount(row.amount), true)} USDC</span><small>{row.paymentName ? row.paymentName.name : 'Payment ID'} · {row.paymentName ? 'Checked on Sepolia' : 'Provided directly'}</small></div>)}</div><div className="detail-list"><KeyValue label="Payment type">{category}</KeyValue><KeyValue label="Pay from">{store.mode === 'sandbox' ? 'Practice funds' : 'Test network funds'}</KeyValue></div>{store.mode === 'sandbox' ? <label className="checkbox-field"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} /><span>This is a practice payment for this browser session. No real money moves and no organization approval is requested.</span></label> : <Notice tone="warning">Next: unlock funds and approve. Test USDC only.</Notice>}</>}
      {error && <div className="form-error" role="alert">{error}</div>}{busy && <p className="processing-status" role="status">{phase}</p>}
      <div className="wizard-actions"><Button variant="ghost" icon={ArrowLeft} disabled={busy} onClick={() => { setError(''); step === 0 ? store.navigate('distributions') : setStep(step - 1); }}>{step === 0 ? 'Cancel' : 'Back'}</Button>{step === 0 ? <Button onClick={() => { if (!name.trim()) { setError('Give this payment a name.'); return; } setError(''); setStep(1); }}>Add recipients<ArrowRight size={15} /></Button> : step === 1 ? <Button busy={busy} icon={ShieldCheck} onClick={() => void prepare()}>Check payment</Button> : step === 2 ? <Button disabled={creRequired && !creVerified} onClick={() => setStep(3)}>Review payment<ArrowRight size={15} /></Button> : store.mode === 'sandbox' ? <Button busy={busy} disabled={!acknowledged || total > store.treasury || creRequired && !creVerified} onClick={() => void publish()}>Complete practice payment<ArrowRight size={15} /></Button> : <Button disabled={creRequired && !creVerified} icon={ShieldCheck} onClick={() => { if (compiled && (!creRequired || creVerified)) setLiveOperation({ kind: 'create_distribution', compiled, paymentNames: requiredPaymentNames(rows) }); }}>Continue to approval</Button>}</div></fieldset></div>
      <aside className="wizard-aside"><div className="summary-heading"><LockKeyhole size={17} /><h3>Payment summary</h3></div><KeyValue label="Recipients">{rows.length}</KeyValue><div className="summary-total"><span>Total payment</span><strong>{money(total)}<small>USDC</small></strong></div>{total > store.treasury && store.mode === 'sandbox' && <Notice tone="warning">You need more practice funds for this payment. Open Funds to add them.</Notice>}</aside>
    </div>
    <LiveOperationLoader operation={liveOperation} onClose={() => setLiveOperation(null)} onConfirmed={result => { store.saveDistribution({ ...draft('Confirmed'), transactionHash: result.transactionHash }); store.toast('Payment confirmed on the test network.'); }} />
  </>;
}
