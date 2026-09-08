import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Building2, Check, LockKeyhole, LogOut, UserRound } from 'lucide-react';
import { useSession } from '../lib/session';
import { useAccount, type AccountType } from '../lib/account';
import { useStore } from '../lib/store';
import { Button } from './ui';
import { EntryLayout } from './EntryLayout';

export function SignIn() {
  const session = useSession();
  const loading = !session.ready || session.authenticated && !session.userId;
  useEffect(() => { document.title = 'Sign in · NULL'; }, []);
  return <EntryLayout>
    <h1>Private payments.</h1>
    <p className="entry-description">Receive payments. Pay your team.</p>
    {loading ? <div className="entry-loading" role="status"><span className="skeleton" /><p>Checking your session…</p></div> : session.configured ? <>
      <Button className="entry-continue" onClick={session.signIn}><span>Continue with email or wallet</span><ArrowRight size={17} /></Button>

    </> : <div className="entry-unavailable" role="status"><strong>Sign-in is not available yet.</strong><p>Contact the person who set up NULL, then try again when sign-in is ready.</p><Button variant="secondary" onClick={() => window.location.reload()}>Try again</Button></div>}
    {session.error && <p className="form-error" role="alert">{session.error}</p>}
    <div className="entry-security"><LockKeyhole size={18} strokeWidth={1.5} /><div><strong>Keep a backup.</strong><p>Returning? Restore your backup after signing in. Sign-in alone won’t restore payments.</p></div></div>
  </EntryLayout>;
}

export function ChooseAccount() {
  const session = useSession(); const account = useAccount(); const store = useStore();
  const [type, setType] = useState<AccountType | null>(account.profile?.type || null);
  const [organizationName, setOrganizationName] = useState(account.profile?.organizationName || '');
  const [error, setError] = useState(''); const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { document.title = 'Choose your account type · NULL'; heading.current?.focus(); }, []);
  function complete(event: FormEvent) {
    event.preventDefault();
    if (!type) { setError('Choose how you will use NULL.'); return; }
    if (type === 'organization' && !organizationName.trim()) { setError('Enter an organization name.'); return; }
    account.updateProfile(type === 'organization' ? { type, organizationName: organizationName.trim() } : { type });
    if (type === 'organization') store.setOrganization(organizationName.trim());
    store.navigate(type === 'organization' ? 'overview' : 'inbox');
  }
  return <EntryLayout className="account-setup" action={!account.profile && <Button variant="ghost" icon={LogOut} busy={session.signingOut} onClick={() => void session.signOut()}>Sign out</Button>} footer={<>Signed in as <span>{session.label}</span></>}>
      <ol className="setup-progress" aria-label="Account setup"><li className="complete"><Check size={14} />Signed in</li><li aria-current="step"><span>2</span>Choose account type</li></ol>
      <h1 ref={heading} tabIndex={-1}>How will you use NULL?</h1>

      <form onSubmit={complete}>
        <fieldset className="account-options"><legend className="sr-only">Account type</legend>
          <label className={`account-option ${type === 'individual' ? 'is-selected' : ''}`}><input type="radio" name="accountType" value="individual" checked={type === 'individual'} onChange={() => { setType('individual'); setError(''); }} /><UserRound size={22} strokeWidth={1.6} /><span><strong>Individual</strong><small>Receive payments</small></span></label>
          <label className={`account-option ${type === 'organization' ? 'is-selected' : ''}`}><input type="radio" name="accountType" value="organization" checked={type === 'organization'} onChange={() => { setType('organization'); setError(''); }} /><Building2 size={22} strokeWidth={1.6} /><span><strong>Organization</strong><small>Pay people and manage funds</small></span></label>
        </fieldset>
        <div className={`organization-reveal ${type === 'organization' ? 'is-open' : ''}`} inert={type !== 'organization' || undefined} aria-hidden={type !== 'organization'}><div><div className="organization-setup-fields"><label className="field" htmlFor="onboarding-organization">Organization name<input id="onboarding-organization" name="organization" autoComplete="organization" value={organizationName} maxLength={50} required={type === 'organization'} disabled={type !== 'organization'} onChange={event => { setOrganizationName(event.target.value); setError(''); }} placeholder="e.g. Acme Studio" aria-describedby="organization-hint" /></label><p id="organization-hint" className="field-hint">Display name only. Sending requires organization approval.</p></div></div></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button className="entry-continue" type="submit" disabled={!type}><span>Continue</span><ArrowRight size={17} /></Button>
      </form>
      <p className="entry-hint">You can change your account type in Settings.</p>
      {account.profile && <Button variant="ghost" icon={ArrowLeft} onClick={account.cancelChange}>Back to account</Button>}
      {session.error && <p className="form-error" role="alert">{session.error}</p>}
    </EntryLayout>;
}
