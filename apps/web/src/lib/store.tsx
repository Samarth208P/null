import { createContext, useContext, useState, type ReactNode } from 'react';
import { createPrivacyProfile, parseAmount, type CompiledDistribution } from '@null-protocol/sdk';
import { LiveBalanceRecoveryLoader } from '../components/LiveBalanceRecoveryLoader';

export type Route = 'overview' | 'distributions' | 'new' | 'treasury' | 'inbox' | 'balance' | 'inspector' | 'protocol' | 'settings' | 'about';
export type RecipientRow = { id: string; name: string; amount: string; profile: string };
export type Distribution = { id: string; name: string; category: string; createdAt: string; status: 'Draft' | 'Prepared' | 'Published locally' | 'Confirmed'; recipients: RecipientRow[]; compiled?: CompiledDistribution; transactionHash?: string };
export type Activity = { id: string; title: string; detail: string; createdAt: string; type: 'shield' | 'distribution' | 'claim' | 'workspace' };
export type PrivateNote = { id: string; amount: bigint; commitment: string; createdAt: string; allocationId: string };
export type Identity = ReturnType<typeof createPrivacyProfile>;

function newWorkspace() {
  const identity = createPrivacyProfile();
  const otherProfiles = Array.from({ length: 3 }, () => createPrivacyProfile().profile.stealthMetaAddress);
  const recipients: RecipientRow[] = ['Alice Chen', 'Bob Williams', 'Carol Park', 'Dave Miller'].map((name, index) => ({
    id: crypto.randomUUID(), name, amount: ['4201.123456', '7503.654321', '3107.777777', '9211.222222'][index], profile: index === 0 ? identity.profile.stealthMetaAddress : otherProfiles[index - 1],
  }));
  const now = new Date();
  const drafts: Distribution[] = [
    { id: crypto.randomUUID(), name: 'September payroll', category: 'Payroll', createdAt: now.toISOString(), status: 'Draft', recipients },
    { id: crypto.randomUUID(), name: 'Design partners', category: 'Contractors', createdAt: new Date(now.getTime() - 86400000).toISOString(), status: 'Draft', recipients: recipients.slice(0, 2).map((row, i) => ({ ...row, id: crypto.randomUUID(), amount: ['3250.00', '3590.00'][i] })) },
    { id: crypto.randomUUID(), name: 'Contributor grants', category: 'Grants', createdAt: new Date(now.getTime() - 2 * 86400000).toISOString(), status: 'Draft', recipients: recipients.slice(0, 3).map((row, i) => ({ ...row, id: crypto.randomUUID(), amount: ['5000.00', '4500.00', '3000.00'][i] })) },
  ];
  return { identity, recipients, drafts };
}

type Store = {
  mode: 'sandbox' | 'testnet'; setMode: (mode: 'sandbox' | 'testnet') => void;
  organization: string; setOrganization: (name: string) => void;
  identity: Identity; setIdentity: (identity: Identity) => void;
  recipients: RecipientRow[]; setRecipients: (rows: RecipientRow[]) => void;
  distributions: Distribution[]; saveDistribution: (distribution: Distribution) => void; removeDraft: (id: string) => void;
  treasury: bigint; shield: (amount: bigint) => void; publish: (distribution: Distribution) => void;
  treasuryReady: boolean; recoverLiveBalances: () => void;
  notes: PrivateNote[]; addNote: (note: PrivateNote) => void;
  activities: Activity[]; addActivity: (title: string, detail: string, type: Activity['type']) => void;
  hideBalances: boolean; setHideBalances: (hidden: boolean) => void;
  toast: (message: string) => void; toastMessage: string;
  navigate: (route: Route) => void; editingId: string | null; editDistribution: (id: string | null) => void;
};
const StoreContext = createContext<Store | null>(null);
export function StoreProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(newWorkspace);
  const [mode, updateMode] = useState<'sandbox' | 'testnet'>('sandbox');
  const [organization, setOrganization] = useState('Acme Studio');
  const [identity, setIdentity] = useState(initial.identity);
  const [recipients, setRecipients] = useState(initial.recipients);
  const [allDistributions, setDistributions] = useState(initial.drafts);
  const [testnetDistributions, setTestnetDistributions] = useState<Distribution[]>([]);
  const [treasury, setTreasury] = useState(100_000_000000n);
  const [liveTreasury, setLiveTreasury] = useState<bigint | null>(null);
  const [liveRecoveryOpen, setLiveRecoveryOpen] = useState(false);
  const [allNotes, setNotes] = useState<PrivateNote[]>([]);
  const [liveNotes, setLiveNotes] = useState<PrivateNote[]>([]);
  const [activities, setActivities] = useState<Activity[]>([{ id: crypto.randomUUID(), title: 'Your private workspace is ready', detail: 'Sample drafts and 100,000 sandbox USDC are available.', createdAt: new Date().toISOString(), type: 'workspace' }]);
  const [hideBalances, setHideBalances] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const navigate = (route: Route) => { window.location.hash = `/${route}`; };
  const toast = (message: string) => { setToastMessage(message); };
  const addActivity = (title: string, detail: string, type: Activity['type']) => setActivities(items => [{ id: crypto.randomUUID(), title, detail, type, createdAt: new Date().toISOString() }, ...items]);
  const saveDistribution = (distribution: Distribution) => (mode === 'sandbox' ? setDistributions : setTestnetDistributions)(items => items.some(item => item.id === distribution.id) ? items.map(item => item.id === distribution.id ? distribution : item) : [distribution, ...items]);
  const value: Store = {
    mode, setMode: next => { updateMode(next); setEditingId(null); navigate('overview'); }, organization, setOrganization, identity, setIdentity: next => { setIdentity(next); setNotes([]); setLiveNotes([]); }, recipients, setRecipients,
    distributions: mode === 'sandbox' ? allDistributions : testnetDistributions, saveDistribution, removeDraft: id => (mode === 'sandbox' ? setDistributions : setTestnetDistributions)(items => items.filter(item => item.id !== id || item.status === 'Published locally')),
    treasury: mode === 'sandbox' ? treasury : liveTreasury ?? 0n,
    treasuryReady: mode === 'sandbox' || liveTreasury !== null,
    recoverLiveBalances: () => setLiveRecoveryOpen(true),
    shield: value => { if (mode !== 'sandbox') throw new Error('Live shielding requires a verified deployment and a locally generated shield proof.'); setTreasury(balance => balance + value); addActivity('Treasury topped up', 'Sandbox funds were added to your local treasury.', 'shield'); },
    publish: distribution => {
      if (mode !== 'sandbox') throw new Error('Live publication requires a verified deployment, authorization, and a locally generated proof.');
      if (!distribution.compiled) throw new Error('Prepare this distribution first.');
      if (allDistributions.some(item => item.id === distribution.id && item.status === 'Published locally')) throw new Error('This distribution is already published locally.');
      const total = distribution.recipients.reduce((sum, row) => sum + parseAmount(row.amount), 0n);
      if (total > treasury) throw new Error('Add enough sandbox funds before publishing.');
      setTreasury(balance => balance - total); saveDistribution({ ...distribution, status: 'Published locally' });
      addActivity('Distribution published locally', 'Eight encrypted envelopes are ready for local discovery.', 'distribution');
    },
    notes: mode === 'sandbox' ? allNotes : liveNotes, addNote: note => { (mode === 'sandbox' ? setNotes : setLiveNotes)(items => items.some(item => item.allocationId === note.allocationId) ? items : [...items, note]); if (mode === 'sandbox') addActivity('Private note created locally', 'The sandbox entitlement was converted to a local note.', 'claim'); },
    activities: mode === 'sandbox' ? activities : [], addActivity, hideBalances, setHideBalances, toast, toastMessage, navigate, editingId,
    editDistribution: id => { setEditingId(id); navigate('new'); },
  };
  return <StoreContext.Provider value={value}>{children}<Toast message={toastMessage} onDismiss={() => setToastMessage('')} /><LiveBalanceRecoveryLoader open={liveRecoveryOpen} onClose={() => setLiveRecoveryOpen(false)} identityKeys={identity.keys} onRecovered={recovered => { if (recovered.treasuryBalance !== null) setLiveTreasury(recovered.treasuryBalance); setLiveNotes(recovered.notes); toast('Balances recovered from verified chain history.'); }} /></StoreContext.Provider>;
}

import { useEffect } from 'react';
function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => { if (!message) return; const timer = setTimeout(onDismiss, 4500); return () => clearTimeout(timer); }, [message, onDismiss]);
  return message ? <div className="toast" role="status"><span>{message}</span><button onClick={onDismiss} aria-label="Dismiss notification">×</button></div> : null;
}
export function useStore(): Store { const context = useContext(StoreContext); if (!context) throw new Error('Workspace is not available.'); return context; }
