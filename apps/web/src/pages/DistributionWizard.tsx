import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCheck, Download, FileUp, LockKeyhole, Plus, ShieldCheck, Trash2, Users, X } from 'lucide-react';
import { parsePrivacyProfile, parseAmount, randomBytes, serializeEnvelope, type CompiledDistribution } from '@null-protocol/sdk';
import { useStore, type Distribution, type RecipientRow } from '../lib/store';
import { amount, download, money, parseCsv, short, stringify } from '../lib/format';
import { protocolContext, sandboxContext } from '../lib/config';
import { cryptoTask } from '../lib/worker';
import { Badge, Button, CheckItem, KeyValue, Notice, PageHeader } from '../components/ui';

import { LiveOperationLoader, type LiveOperationInput } from '../components/LiveOperationLoader';

const steps = ['Distribution details', 'Recipients', 'Privacy preflight', 'Review & publish'];
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
    if (!name.trim()) return 'Give this distribution a name.';
    if (!rows.length || rows.length > 8) return 'Add between one and eight recipients.';
    const names = new Set<string>();
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index]; const ref = row.name.trim().normalize('NFKC').toLowerCase();
      if (!ref) return `Add a name for recipient ${index + 1}.`;
      if (names.has(ref)) return `Use a unique reference for recipient ${index + 1}.`;
      names.add(ref);
      try { parseAmount(row.amount); } catch { return `Recipient ${index + 1} needs a positive amount with at most six decimal places.`; }
      try { parsePrivacyProfile(row.profile); } catch { return `Recipient ${index + 1} needs a valid privacy profile. Use their st:eth: profile, not a wallet address.`; }
    }
    return '';
  };
  const updateRow = (index: number, key: keyof RecipientRow, value: string) => { setRows(items => items.map((row, i) => index === i ? { ...row, [key]: value } : row)); setCompiled(undefined); };
  async function importCsv(file?: File) {
    if (!file) return;
    try {
      if (file.size > 128000) throw new Error('Keep CSV files under 128 KB. A distribution supports up to eight recipients.');
      const parsed = parseCsv(await file.text());
      const headers = parsed.shift()?.map(value => value.toLowerCase().replace(/[ _-]/g, ''));
      if (!headers || headers[0] !== 'name' || headers[1] !== 'amount' || headers[2] !== 'privacyprofile' || headers.length !== 3) throw new Error('Use the CSV headers: name,amount,privacyProfile. Download the template below.');
      if (parsed.length < 1 || parsed.length > 8 || parsed.some(row => row.length !== 3)) throw new Error('Include one to eight recipients, with exactly three fields per row.');
      setRows(parsed.map(row => ({ id: crypto.randomUUID(), name: row[0], amount: row[1], profile: row[2] }))); setError(''); setCompiled(undefined);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not read that CSV.'); }
    if (upload.current) upload.current.value = '';
  }
  async function prepare() {
    const invalid = validate(); if (invalid) { setError(invalid); return; }
    const context = store.mode === 'sandbox' ? sandboxContext : protocolContext;
    if (!context) { setError('Configure the Sepolia pool address in settings before preparing chain-bound artifacts.'); return; }
    setBusy(true); setError(''); setPhase('Preparing eight encrypted slots…');
    const entropy = randomBytes(32);
    try {
      const options = { recipients: rows.map(row => ({ employeeRef: row.name, amountAtomic: parseAmount(row.amount), stealthMetaAddress: row.profile })), context, batchEntropy: entropy };
      const first = await cryptoTask('compile', options);
      setPhase('Comparing deterministic artifacts…');
      const second = await cryptoTask('compile', options);
      if (stringify(first.publicBundle) !== stringify(second.publicBundle) || first.allocationRoot !== second.allocationRoot || first.envelopes.length !== 8 || new Set(first.envelopes.map(envelope => serializeEnvelope(envelope).length)).size !== 1) throw new Error('The compiled artifacts did not match. Publication is blocked.');
      setCompiled(first); setStep(2);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not prepare this distribution.'); }
    finally { entropy.fill(0); setBusy(false); setPhase(''); }
  }
  async function publish() {
    if (!acknowledged || !compiled || busy) return;
    setBusy(true); setError('');
    try { store.publish(draft('Prepared')); setDone(true); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Publication could not complete.'); } finally { setBusy(false); }
  }
  if (done) return <><PageHeader title="The details stay yours." description="Your distribution is available in this local sandbox." /><div className="completion"><span className="completion-icon"><CheckCheck size={30} strokeWidth={1.5} /></span><Badge tone="success">Published locally</Badge><h2>{name}</h2><p>Eight encrypted envelopes are ready. Recipients can discover their allocation with the keys on their own device.</p><div className="completion-details"><KeyValue label="Private amount">{money(total, true)} USDC</KeyValue><KeyValue label="Recipient slots">{rows.length} real · {8 - rows.length} padded</KeyValue><KeyValue label="Commitment"><code>{short(compiled!.commitment, 12)}</code></KeyValue></div><Notice>This was a local publication. No funds moved onchain, no ZK proof was generated, and no sponsor authorization was performed.</Notice><div className="button-row"><Button onClick={() => store.navigate('inbox')}>Open private inbox<ArrowRight size={16} /></Button><Button variant="secondary" icon={Download} onClick={() => download('null-public-distribution.json', stringify(compiled!.publicBundle))}>Public bundle</Button></div><button className="text-link" onClick={() => store.navigate('distributions')}>Back to distributions</button></div></>;
  return <>
    <PageHeader title={existing ? 'Prepare distribution' : 'New distribution'} breadcrumb="Distributions" description="A few details for you. Eight encrypted slots for everyone else." action={<div className="button-row">{existing && <Button variant="ghost" icon={Trash2} onClick={() => { store.removeDraft(id); store.toast('Draft discarded.'); store.navigate('distributions'); }}>Discard</Button>}<Button variant="secondary" onClick={() => { if (!name.trim()) { setError('Give your draft a name before saving.'); return; } store.saveDistribution(draft(compiled ? 'Prepared' : 'Draft')); store.toast('Draft saved for this session.'); store.navigate('distributions'); }}>Save draft</Button></div>} />
    <div className="wizard-layout"><div className="wizard-main"><ol className="stepper">{steps.map((label, index) => <li key={label} className={step === index ? 'current' : step > index ? 'complete' : ''} aria-current={step === index ? 'step' : undefined}><span>{step > index ? <Check size={13} /> : index + 1}</span><strong>{label}</strong></li>)}</ol>
      <div className="wizard-surface">
      {step === 0 && <><div className="form-section-heading"><h2>Make it yours.</h2><p>Name this distribution and choose what it’s for. These details stay in your workspace.</p></div><label className="field">Distribution name<input maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. September payroll" autoFocus /><small>Only visible to you. Never included in public events.</small></label><label className="field">Distribution type<select value={category} onChange={event => setCategory(event.target.value)}>{['Payroll', 'Contractors', 'Grants', 'Contributors', 'Other payouts'].map(value => <option key={value}>{value}</option>)}</select></label><div className="form-two"><label className="field">Network<input readOnly value={store.mode === 'sandbox' ? 'Sepolia · local sandbox' : 'Ethereum Sepolia'} /></label><label className="field">Asset<input readOnly value="USDC · 6 decimals" /></label></div><Notice><strong>A fixed-size distribution.</strong><p>Every distribution has eight slots. Unused slots are padded, so the public payload does not reveal your recipient count.</p></Notice></>}
      {step === 1 && <><div className="form-section-heading"><h2>Who’s receiving?</h2><p>Add privacy profiles and exact amounts. Recipient wallet addresses are not used.</p></div><div className="import-strip"><FileUp size={22} strokeWidth={1.5} /><div><strong>Import a payroll CSV</strong><p>name, amount, privacyProfile · up to 8 recipients</p></div><Button variant="secondary" onClick={() => upload.current?.click()}>Choose file</Button><input ref={upload} type="file" accept=".csv,text/csv" hidden onChange={event => void importCsv(event.target.files?.[0])} /></div><div className="import-options"><button className="text-link" onClick={() => download('null-payroll-template.csv', 'name,amount,privacyProfile\n' + store.recipients.map(row => `"${row.name.replaceAll('"', '""')}",${row.amount},${row.profile}`).join('\n'), 'text/csv')}>Download sample CSV<Download size={13} /></button>{store.mode === 'sandbox' && <button className="text-link" onClick={() => { setRows(store.recipients.map(row => ({ ...row, id: crypto.randomUUID() }))); setCompiled(undefined); }}>Use sample recipients</button>}</div>
      <div className="recipient-editor">{rows.map((row, index) => <div className="recipient-edit-row" key={row.id}><div className="recipient-row-heading"><span className="person-avatar">{row.name.trim().slice(0, 1).toUpperCase() || index + 1}</span><strong>Recipient {index + 1}</strong><button className="icon-button" aria-label={`Remove recipient ${index + 1}`} onClick={() => { setRows(items => items.filter(item => item.id !== row.id)); setCompiled(undefined); }}><Trash2 size={15} /></button></div><div className="form-two"><label className="field">Name or private reference<input value={row.name} maxLength={100} onChange={event => updateRow(index, 'name', event.target.value)} placeholder="Alice Chen" /></label><label className="field">Amount in USDC<input value={row.amount} inputMode="decimal" onChange={event => updateRow(index, 'amount', event.target.value)} placeholder="0.000000" /></label></div><label className="field">Privacy profile<input className="mono-input" value={row.profile} onChange={event => updateRow(index, 'profile', event.target.value.trim())} placeholder="st:eth:0x…" spellCheck={false} autoComplete="off" /></label></div>)}</div>{rows.length < 8 && <Button variant="secondary" icon={Plus} className="add-recipient" onClick={() => setRows(items => [...items, { id: crypto.randomUUID(), name: '', amount: '', profile: '' }])}>Add recipient</Button>}<p className="field-hint"><LockKeyhole size={13} />CSV contents are processed locally and kept in memory.</p></>}
      {step === 2 && compiled && <><div className="form-section-heading"><span className="inline-success"><ShieldCheck size={20} />Local preparation complete</span><h2>Designed to reveal less.</h2><p>Your fixed-size encrypted bundle passed a deterministic local comparison.</p></div><div className="preflight-summary"><KeyValue label="Real recipients">{compiled.realCount}</KeyValue><KeyValue label="Total published slots">8</KeyValue><KeyValue label="Envelope size">{serializeEnvelope(compiled.envelopes[0]).length} bytes each</KeyValue><KeyValue label="Names in public bundle"><Badge tone="success">Excluded by format</Badge></KeyValue><KeyValue label="Individual amounts"><Badge tone="success">Encrypted</Badge></KeyValue><KeyValue label="Deterministic comparison"><Badge tone="success">Matched</Badge></KeyValue><KeyValue label="Claim membership">Global distribution accumulator</KeyValue></div><Notice><strong>Preparation is complete; a proof is a separate step.</strong><p>{store.mode === 'sandbox' ? 'The next step publishes to this browser session. Live ZK verification and organization approval are not simulated.' : 'Connect the organization authorization flow and generated proof artifacts before broadcasting on Sepolia.'}</p></Notice></>}
      {step === 3 && compiled && <><div className="form-section-heading"><h2>One final look.</h2><p>Review the exact distribution before publishing it to this session.</p></div><div className="review-amount"><span>{name}</span><strong>{money(total, true)}<small>USDC</small></strong></div><div className="detail-list"><KeyValue label="Distribution type">{category}</KeyValue><KeyValue label="Recipients">{rows.length} of 8 slots</KeyValue><KeyValue label="Source">{store.mode === 'sandbox' ? 'Local sandbox treasury' : 'Sepolia shielded treasury'}</KeyValue><KeyValue label="After distribution">{store.mode === 'sandbox' ? `${money(store.treasury - total)} USDC` : 'Requires treasury recovery'}</KeyValue><KeyValue label="Commitment"><code>{short(compiled.commitment, 10)}</code></KeyValue></div>{store.mode === 'sandbox' ? <label className="checkbox-field"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} /><span>I understand this uses sandbox funds and publishes only to this browser session. No onchain transaction or organization approval occurs.</span></label> : <Notice tone="warning">The next step verifies your deployment, recovers the treasury, requests exact organization authorization, and generates a distribution proof on your device. You review the public transaction before broadcasting.</Notice>}</>}
      {error && <div className="form-error" role="alert">{error}</div>}{busy && <p className="processing-status" role="status">{phase}</p>}
      <div className="wizard-actions"><Button variant="ghost" icon={ArrowLeft} disabled={busy} onClick={() => { setError(''); step === 0 ? store.navigate('distributions') : setStep(step - 1); }}>{step === 0 ? 'Cancel' : 'Back'}</Button>{step === 0 ? <Button onClick={() => { if (!name.trim()) { setError('Give this distribution a name.'); return; } setError(''); setStep(1); }}>Add recipients<ArrowRight size={15} /></Button> : step === 1 ? <Button busy={busy} icon={ShieldCheck} onClick={() => void prepare()}>Prepare privately</Button> : step === 2 ? <Button onClick={() => setStep(3)}>Review distribution<ArrowRight size={15} /></Button> : store.mode === 'sandbox' ? <Button busy={busy} disabled={!acknowledged || total > store.treasury} onClick={() => void publish()}>Publish locally<ArrowRight size={15} /></Button> : <Button icon={ShieldCheck} onClick={() => { if (compiled) setLiveOperation({ kind: 'create_distribution', compiled }); }}>Prepare live proof</Button>}</div></div></div>
      <aside className="wizard-aside"><div className="summary-heading"><LockKeyhole size={17} /><h3>Distribution summary</h3></div><KeyValue label="Recipients">{rows.length} / 8</KeyValue><KeyValue label="Padded slots">{8 - rows.length}</KeyValue><KeyValue label="Asset">USDC</KeyValue><div className="summary-total"><span>Total distribution</span><strong>{money(total)}<small>USDC</small></strong></div><p>Only you can see these details.</p><div className="aside-rule" /><CheckItem description="Profiles are one-time key derivation inputs.">No receiving addresses</CheckItem><CheckItem description="Encryption and preparation run on this device.">Local processing</CheckItem><CheckItem description="Every distribution publishes eight envelopes.">Constant-size delivery</CheckItem>{total > store.treasury && store.mode === 'sandbox' && <Notice tone="warning">This distribution exceeds the sandbox treasury. Add funds from Treasury before publishing.</Notice>}</aside>
    </div>
    <LiveOperationLoader operation={liveOperation} onClose={() => setLiveOperation(null)} onConfirmed={result => { store.saveDistribution({ ...draft('Confirmed'), transactionHash: result.transactionHash }); store.toast('Distribution confirmed on Sepolia.'); }} />
  </>;
}
