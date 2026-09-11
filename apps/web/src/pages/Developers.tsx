import { useEffect, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, Check, Code2, Copy } from 'lucide-react';
import { Logo } from '../components/Logo';
import integrationGuideUrl from '../../../../docs/SDK_INTEGRATION.md?url';
import './developers.css';

const repository = 'https://github.com/Samarth208P/null';
const quickstart = `git clone https://github.com/Samarth208P/null.git
cd null
corepack enable
pnpm install --frozen-lockfile
pnpm example:payouts`;
const snippet = `import {
  resolvePayoutRecipients, preparePayout,
} from '@null-protocol/payouts';

// Illustrative name, invoice and amount; use your own recipients.
const recipients = await resolvePayoutRecipients(ens, [
  { reference: 'invoice-42', name: 'alice.eth', amount: '25' },
]);

// Show the resolved name and keys. Ask the payer to confirm.
const draft = await preparePayout({ ens, context, recipients });

// Prepared, not paid. Approval and submission are separate.
const encrypted = draft.publicBundle;`;
function jump(id: string) {
  const element = document.getElementById(id);
  element?.scrollIntoView({ block: 'start' });
  element?.focus({ preventScroll: true });
}
function CodeBlock({ title, value }: { title: string; value: string }) {
  const [copied, setCopied] = useState(false); const [error, setError] = useState('');
  useEffect(() => { if (!copied) return; const timer = setTimeout(() => setCopied(false), 2000); return () => clearTimeout(timer); }, [copied]);
  async function copy() {
    try { await navigator.clipboard.writeText(value); setCopied(true); setError(''); }
    catch { setError('Clipboard unavailable. Select and copy the code below.'); }
  }
  return <div className="developer-code"><div className="developer-code-heading"><span>{title}</span><button type="button" onClick={() => void copy()} aria-label={`Copy ${title}`}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? 'Copied' : 'Copy'}</button></div><pre tabIndex={0} aria-label={title}><code>{value}</code></pre><span className={error ? 'developer-copy-error' : 'sr-only'} role="status">{error || (copied ? 'Copied to clipboard.' : '')}</span></div>;
}

function PreparationExample() {
  const [name, setName] = useState('receive.nullpay2026.eth'); const [amount, setAmount] = useState('0.01');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [result, setResult] = useState<{ commitment: string; envelopes: number; fingerprint: string }>();
  async function prepare(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(''); setResult(undefined);
    try {
      const [{ preparePayout, resolvePayoutRecipients }, { ensClient }, { cryptoTask }] = await Promise.all([
        import('@null-protocol/payouts'), import('../lib/ens'), import('../lib/worker'),
      ]);
      const response = await fetch('/deployment.json');
      if (!response.ok) throw new Error('Deployment information is unavailable. Try again later.');
      const manifest = await response.json();
      if (manifest.chainId !== 11155111 || !/^0x[0-9a-fA-F]{40}$/.test(manifest.contracts?.nullPool)) throw new Error('The Sepolia deployment could not be read.');
      const recipients = await resolvePayoutRecipients(ensClient, [{ reference: 'read-only-example', name, amount }]);
      const draft = await preparePayout({ ens: ensClient, context: { chainId: 11155111n, poolAddress: manifest.contracts.nullPool }, recipients, compiler: input => cryptoTask('compile', input) });
      setResult({ commitment: draft.summary.commitment, envelopes: draft.publicBundle.envelopes.length, fingerprint: draft.paymentNames[0]!.fingerprint });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Preparation failed. Check the name and connection, then retry.'); }
    finally { setBusy(false); }
  }
  return <section className="developer-example" id="try-sdk" tabIndex={-1} aria-labelledby="example-heading">
    <div><h2 id="example-heading">Run the preparation step.</h2><p>This page uses the SDK directly. Resolve a live ENSv2 name and compile eight encrypted delivery slots in your browser.</p><p>No sign-in, wallet, proof, or transaction. The default name is a verification fixture; do not send funds to it.</p></div>
    <form onSubmit={event => void prepare(event)}><fieldset disabled={busy}><legend className="sr-only">Read-only payout preparation</legend><label className="field">Sepolia ENS payment name<input value={name} required onChange={event => { setName(event.target.value); setResult(undefined); setError(''); }} autoComplete="off" spellCheck={false} /></label><label className="field">Amount in test USDC<input value={amount} required inputMode="decimal" onChange={event => { setAmount(event.target.value); setResult(undefined); setError(''); }} /></label><button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Resolving and encrypting…' : 'Prepare example'}<ArrowRight size={16} /></button></fieldset><p className="field-hint">Your RPC provider can observe the ENS lookup. Amounts are compiled locally.</p>
      {busy && <p role="status">Checking ENS and compiling locally. Nothing will be sent.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {result && <div className="developer-result" role="status"><strong><Check size={16} />Prepared locally · {result.envelopes} encrypted slots</strong><span>Transaction sent: no</span><span>Distribution commitment</span><code>{result.commitment}</code><span>Resolved profile fingerprint</span><code>{result.fingerprint}</code></div>}
    </form>
  </section>;
}

export function Developers() {
  useEffect(() => { document.title = 'NULL — Private payouts for your app'; }, []);
  return <div className="developer-page">
    <a className="skip-link" href="#developer-content" onClick={event => { event.preventDefault(); jump('developer-content'); }}>Skip to content</a>
    <header className="developer-header"><a className="brand" href="#/developers" aria-label="NULL developer home"><Logo size={30} /><span>NULL</span></a><nav aria-label="Developer navigation"><button onClick={() => jump('start-building')}>Quickstart</button><a href={integrationGuideUrl} download="NULL-integration-guide.md">Integration guide<ArrowDown size={14} /></a><a href="#/demo">Reference app<ArrowRight size={14} /></a></nav></header>
    <main id="developer-content" tabIndex={-1}>
      <section className="developer-intro"><div><h1>Private payouts.<br />Inside your app.</h1><p>Give your users a way to send and receive private entitlements. Bring your interface and wallet connection. NULL handles ENS destinations, encrypted batches, and the path to a provable claim.</p><div className="button-row"><button className="button button-primary" onClick={() => jump('start-building')}>Start building<ArrowDown size={16} /></button><button className="button button-secondary" onClick={() => jump('try-sdk')}>Try preparation<Code2 size={16} /></button></div><p className="developer-availability">TypeScript source SDK · Ethereum Sepolia · Unaudited</p></div><CodeBlock title="Prepare a payout · TypeScript" value={snippet} /></section>
      <section className="developer-contract" aria-label="Integration responsibilities"><div><h2>Your application owns</h2><p>The interface, payer confirmation, wallet authorization, and encrypted local recovery. Sponsor transaction gas through your backend or let organizations pay with their wallets.</p></div><div><h2>NULL provides</h2><p>Required ENSv2 destinations, encrypted batches for larger payout lists, proof orchestration, recipient discovery, and transaction reconciliation. Your users stay in your product.</p></div></section>
      <section className="developer-start" id="start-building" tabIndex={-1}><div><h2>A working source integration.</h2><p>Clone the workspace and run a read-only preparation against a live ENS name. Then use the typed integration example to connect your own screens.</p><p>Requires Node.js 22.16+ and pnpm 11.9.0. Packages are workspace source packages; this SDK is not published to npm.</p><a className="developer-doc-link" href={`${repository}/tree/main/apps/payout-example`}>Open the integration example<ArrowUpRight size={15} /></a></div><CodeBlock title="Run from a fresh checkout" value={quickstart} /></section>
      <PreparationExample />
      <section className="developer-lifecycle" aria-labelledby="lifecycle-heading"><h2 id="lifecycle-heading">Keep every step explicit.</h2><ol>{[
        ['Resolve & confirm', 'ENS names resolve to public payment keys. Show the destination to the payer before preparation.'],
        ['Prepare', 'Compile a private draft. Optionally verify its exact CRE simulation result. No funds move.'],
        ['Approve & prove', 'Your organization authorizer approves the bound intent. Save encrypted recovery before broadcasting.'],
        ['Submit & reconcile', 'Track a confirmed receipt. An unknown result stays unknown until chain evidence resolves it.'],
        ['Discover & claim', 'Recipients scan with local keys, claim entitlements, and choose a separate public withdrawal.'],
      ].map(([title, description]) => <li key={title}><h3>{title}</h3><p>{description}</p></li>)}</ol></section>
      <section className="developer-boundaries"><h2>Know the boundaries before integrating.</h2><div><p>Unaudited and testnet-only. Larger lists use consecutive batches of up to eight recipients; they can partially complete. New chosen-amount withdrawals with private change passed a local real-proof test. They require the v0.3 pool, which is not yet deployed publicly.</p><p>ENS profiles, deposits and withdrawals are public. Wallets, exit amounts, timing and network metadata can reveal relationships. CRE evidence is local simulation without remote attestation. A Privy owner-approved financial payment remains an outstanding demonstration.</p></div><div className="button-row"><a className="developer-doc-link" href={`${repository}/blob/main/docs/PRIVACY_GUARANTEES.md`}>Privacy boundaries<ArrowUpRight size={15} /></a><a className="developer-doc-link" href={`${repository}/blob/main/docs/SUBMISSION_READINESS.md`}>Implementation evidence<ArrowUpRight size={15} /></a></div></section>
    </main><footer className="developer-footer"><span>NULL · Private payout infrastructure</span><a href={repository}>Source on GitHub<ArrowUpRight size={14} /></a><a href="#/demo">Open reference app<ArrowRight size={14} /></a></footer>
  </div>;
}
