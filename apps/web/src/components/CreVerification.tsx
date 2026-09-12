import { useEffect, useRef, useState } from 'react';
import { Download, FileUp } from 'lucide-react';
import type { PublicDistributionBundle } from '@null-protocol/sdk';
import { download } from '../lib/format';
import { verifyCreResult, type CrePayrollExport } from '../lib/cre';
import { Button, Notice } from './ui';

export function CreVerification({ payroll, expected, onVerified }: { payroll: CrePayrollExport; expected: PublicDistributionBundle; onVerified: (bundle: PublicDistributionBundle, result: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const active = useRef(true), inFlight = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  async function importResult(file?: File) {
    if (!file || inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setError('');
    try {
      if (file.size > 100_000) throw new Error('The CRE result file is too large.');
      const result = await file.text();
      if (!active.current) return;
      onVerified(verifyCreResult(result, payroll.batchId, expected), result);
    } catch (reason) { if (active.current) setError(reason instanceof Error ? reason.message : 'Could not check the CRE result.'); }
    finally { inFlight.current = false; if (active.current) setBusy(false); if (input.current) input.current.value = ''; }
  }
  return <section aria-label="Chainlink CRE verification" className="section-block">

    <p className="field-hint">Export, run the local simulator, then import the matching result.</p>
    <Notice tone="warning">Keep the input file private: it contains recipients, amounts and secret randomness. Local simulation has no remote enclave protection.</Notice>
    <div className="button-row"><Button variant="secondary" icon={Download} onClick={() => download(`null-cre-${payroll.batchId}.json`, JSON.stringify(payroll, null, 2))}>Export private input</Button><Button variant="secondary" icon={FileUp} busy={busy} onClick={() => input.current?.click()}>Import CRE result</Button></div>
    <input ref={input} type="file" accept=".json,application/json" hidden onChange={event => void importResult(event.target.files?.[0])} />
    <details className="progressive-details"><summary>Run the simulation locally</summary><p className="field-hint">In the project folder, run the command below with the input file’s path. Import the resulting payment-result.json file from the output directory printed by the command.</p><pre className="code-block">pnpm cre:simulate --input "PATH_TO_PRIVATE_INPUT.json"</pre></details>
    {error && <div className="form-error" role="alert"><p>{error}</p><p>Review stays locked. Import the result for this exact draft. Nothing has been sent.</p></div>}
  </section>;
}
