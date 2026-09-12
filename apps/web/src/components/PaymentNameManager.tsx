import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useWallets } from '@privy-io/react-auth';
import { createWalletClient, custom, encodeFunctionData, getAddress, type Address, type EIP1193Provider, type Hex, type WalletClient } from 'viem';
import { sepolia } from 'viem/chains';
import { Check, Copy, Download, ExternalLink, Globe2 } from 'lucide-react';
import { ENS_CHAIN_ID, PaymentNameError, inspectPaymentEditorScope, inspectPaymentName, paymentEditorAccess, preparePaymentDelegate, prepareProfileWrite, profileFingerprint, resolvePaymentName, type PaymentNameSnapshot } from '@null-protocol/ens';
import { config } from '../lib/config';
import { ensClient } from '../lib/ens';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { useAccount } from '../lib/account';
import { clearPendingNameUpdate, readPendingNameUpdate, savePendingNameUpdate, type PendingNameUpdate } from '../lib/ens-pending';
import { Button, KeyValue, Notice } from './ui';
import { download } from '../lib/format';

type Connection = () => Promise<WalletClient>;
function PrivyNames() {
  const { wallets } = useWallets();
  const [selectedAddress, setSelectedAddress] = useState('');
  const selected = wallets.find(item => item.address === selectedAddress) ?? wallets.find(item => item.walletClientType === 'privy') ?? wallets[0];
  return <NameManager walletControl={wallets.length > 1 ? <label className="field">Wallet for name updates<select value={selected?.address ?? ''} onChange={event => setSelectedAddress(event.target.value)}>{wallets.map(wallet => <option key={wallet.address} value={wallet.address}>{wallet.walletClientType === 'privy' ? 'Privy' : 'Connected'} · {wallet.address.slice(0, 8)}…{wallet.address.slice(-6)}</option>)}</select><small>Use the name’s owner or an authorized wallet.</small></label> : undefined} connect={async () => {
    const wallet = selected;
    if (!wallet) throw new PaymentNameError('permission', 'Your wallet is still opening. Try again when sign-in has finished.');
    await wallet.switchChain(ENS_CHAIN_ID);
    return createWalletClient({ account: wallet.address as Address, chain: sepolia, transport: custom(await wallet.getEthereumProvider()) });
  }} />;
}
async function connectInjected(): Promise<WalletClient> {
  const provider = (window as unknown as { ethereum?: EIP1193Provider }).ethereum;
  if (!provider) throw new PaymentNameError('permission', 'Connect a Sepolia wallet to manage your name.');
  const accounts = await provider.request({ method: 'eth_requestAccounts' });
  if (!accounts[0]) throw new PaymentNameError('permission', 'Choose an account in your wallet.');
  await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0xaa36a7' }] });
  return createWalletClient({ account: accounts[0], chain: sepolia, transport: custom(provider) });
}
export function PaymentNameManager() { return config.privyAppId ? <PrivyNames /> : <NameManager connect={connectInjected} />; }

function NameManager({ connect, walletControl }: { connect: Connection; walletControl?: ReactNode }) {
  const store = useStore();
  const account = useAccount();
  const { userId } = useSession();
  const userKey = userId ?? 'connected-wallet';
  const [savedUpdate] = useState(() => readPendingNameUpdate(userKey));
  const updateRef = useRef<PendingNameUpdate | undefined>(savedUpdate);
  const [name, setName] = useState(savedUpdate?.name ?? store.receivingName?.name ?? account.profile?.ensName ?? '');
  const [checked, setChecked] = useState<Awaited<ReturnType<typeof inspectPaymentName>>>();
  const [linked, setLinked] = useState<PaymentNameSnapshot | undefined>(store.receivingName);
  const [consent, setConsent] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [status, setStatus] = useState('');
  const [editor, setEditor] = useState(savedUpdate?.editor ?? '');
  const [hash, setHash] = useState<Hex | undefined>(savedUpdate?.hash);
  const [pending, setPending] = useState(!!savedUpdate);
  const [walletAddress, setWalletAddress] = useState<Address>();
  const [scope, setScope] = useState<Awaited<ReturnType<typeof inspectPaymentEditorScope>>>();
  const revision = useRef(0), inFlight = useRef(false);
  useEffect(() => () => { revision.current++; }, []);
  async function run(work: (version: number) => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true; const version = revision.current; setBusy(true); setError(''); setStatus(''); setScope(undefined);
    try { await work(version); }
    catch (reason) { if (version === revision.current) setError(reason instanceof PaymentNameError ? reason.message : 'This step was not confirmed. Check your wallet and connection, then try again.'); }
    finally { inFlight.current = false; if (version === revision.current) setBusy(false); }
  }
  async function lookup(version: number) {
    const result = await inspectPaymentName(ensClient, name);
    if (version !== revision.current) return;
    setChecked(result); setLinked(undefined);
    if (result.value === store.identity.profile.stealthMetaAddress) {
      const snapshot = await resolvePaymentName(ensClient, result.name);
      if (version === revision.current) { setLinked(snapshot); store.setReceivingName(snapshot); }
    }
  }
  async function confirmed(transaction: Hex, version: number) {
    const update = updateRef.current;
    if (!update || transaction !== update.hash) throw new PaymentNameError('changed', 'The saved name update could not be verified. Check this transaction in your wallet.');
    const receipt = await ensClient.waitForTransactionReceipt({ hash: transaction, confirmations: 2, timeout: 90_000 });
    if (version !== revision.current) return;
    // A wallet may replace a pending transaction. Verify the transaction that was
    // actually mined, so a cancellation cannot be mistaken for the intended write.
    const actual = await ensClient.getTransaction({ hash: receipt.transactionHash });
    if (version !== revision.current) return;
    setPending(false);
    setHash(receipt.transactionHash);
    try { clearPendingNameUpdate(userKey); } catch { /* The receipt still settles this component's pending action. */ }
    if (actual.to?.toLowerCase() !== update.resolver.toLowerCase() || actual.from.toLowerCase() !== update.account.toLowerCase() || actual.input.toLowerCase() !== update.data.toLowerCase()) throw new PaymentNameError('changed', 'Your wallet replaced or cancelled this update. Check the name again before trying to publish.');
    if (receipt.status !== 'success') throw new PaymentNameError('permission', 'The transaction failed on Sepolia. Nothing was updated. Check this name’s permissions before trying again.');
    if (update.kind === 'profile') {
      const snapshot = await resolvePaymentName(ensClient, update.name);
      if (snapshot.profile !== store.identity.profile.stealthMetaAddress || snapshot.fingerprint !== update.fingerprint) throw new PaymentNameError('changed', 'The transaction was confirmed, but this device has a different Payment ID. Restore your backup before sharing this name.');
      if (version !== revision.current) return;
      setLinked(snapshot); store.setReceivingName(snapshot); setStatus('Your payment name is live on Sepolia.');
    } else {
      const access = await paymentEditorAccess(ensClient, update.name, update.editor!);
      if (version !== revision.current) return;
      if (update.kind === 'grant' && !access.recordAccess) throw new PaymentNameError('permission', 'The transaction was confirmed, but the record permission could not be verified. Check access again.');
      setStatus(access.broaderAccess ? 'This wallet has broader permissions on the resolver. Removing this record permission alone does not remove its other access.' : access.allowed ? 'This wallet can update only this name’s NULL payment record through this permission.' : 'This wallet can no longer update the NULL payment record.');
    }
  }
  async function write(kind: 'profile' | 'grant' | 'revoke', version: number) {
    if (!checked || pending || (kind === 'profile' && !consent)) return;
    if (kind === 'profile' && !store.identityBackedUp) throw new PaymentNameError('permission', 'Save your Payment ID backup from the inbox before linking this name.');
    const wallet = await connect();
    if (version !== revision.current) return;
    const account = wallet.account?.address;
    if (!account || await wallet.getChainId() !== ENS_CHAIN_ID) throw new PaymentNameError('network', 'Connect the name’s wallet on Sepolia.');
    setWalletAddress(account);
    const simulation = kind === 'profile'
      ? await prepareProfileWrite(ensClient, checked.name, store.identity.profile.stealthMetaAddress, account, checked.resolver)
      : await preparePaymentDelegate(ensClient, checked.name, getAddress(editor.trim()), kind === 'grant', account, checked.resolver);
    if (version !== revision.current) return;
    // Recheck the selected account after wallet dialogs and asynchronous preflight.
    if (!(await wallet.getAddresses()).some(value => value.toLowerCase() === account.toLowerCase()) || await wallet.getChainId() !== ENS_CHAIN_ID) throw new PaymentNameError('changed', 'The connected wallet changed. Check the name again.');
    setStatus('Confirm the record update in your wallet…');
    const request = simulation.request;
    // Narrow the request union so viem preserves each function's ABI/argument types.
    const data = request.functionName === 'setText' ? encodeFunctionData(request) : encodeFunctionData(request);
    const transaction = await wallet.sendTransaction({ to: request.address, data, account, chain: sepolia });
    const update: PendingNameUpdate = { version: 1, hash: transaction, data, name: checked.name, resolver: checked.resolver, account, kind, ...(kind === 'profile' ? {} : {editor: getAddress(editor.trim())}), fingerprint: profileFingerprint(store.identity.profile.stealthMetaAddress) };
    updateRef.current = update;
    // Receipt data is public. Keep it through reloads; never automatically re-send an uncertain update.
    try { savePendingNameUpdate(userKey, update); } catch { setError('This browser could not save the pending transaction. Keep its link until confirmation.'); }
    setHash(transaction); setPending(true); setStatus('Waiting for Sepolia confirmation…');
    await confirmed(transaction, version);
  }
  return <div className="payment-name-manager">
    <label className="field" htmlFor="receiving-ens-name">Your ENS name on Sepolia</label>
    <div className="name-input-row"><input id="receiving-ens-name" value={name} disabled={busy || pending} maxLength={512} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="your-name.eth" onChange={event => { revision.current++; setName(event.target.value); setChecked(undefined); setLinked(undefined); setConsent(false); setStatus(''); setError(''); setHash(undefined); }} /><Button variant="secondary" disabled={!name.trim() || pending} busy={busy} onClick={() => void run(lookup)}>Check name</Button></div>
    <p className="field-hint">Use a name you own. <a href="https://app.ens.dev" target="_blank" rel="noopener noreferrer">Get a name in ENS <ExternalLink size={12} /></a></p>
    {checked && <div className="name-setup-result">
      <p className="name-checked"><Globe2 size={15} /><bdi>{checked.name}</bdi><span>Sepolia</span></p>
      {walletControl && <fieldset className="name-wallet-picker" disabled={busy || pending}>{walletControl}</fieldset>}
      {linked ? <><p><Check size={14} /> Linked to your Payment ID.</p><Button variant="secondary" icon={Copy} onClick={() => void run(async version => {
        const fresh = await resolvePaymentName(ensClient, linked.name);
        if (version !== revision.current) return;
        if (fresh.profile !== store.identity.profile.stealthMetaAddress) { setLinked(undefined); store.setReceivingName(undefined); throw new PaymentNameError('changed', 'This name’s Payment ID changed. Link it again before sharing.'); }
        await navigator.clipboard.writeText(fresh.name); setStatus('Payment name copied.');
      })}>Copy payment name</Button></> : <>
        <Notice tone="warning">Your name and Payment ID become public. Use a pseudonym for privacy. Amounts and recovery keys stay private.</Notice>
        {checked.value && <p className="field-hint">This replaces the name’s current Payment ID.</p>}
        <label className="checkbox-field"><input type="checkbox" checked={consent} disabled={busy || pending} onChange={event => setConsent(event.target.checked)} /><span>I saved my backup and agree to publish my Payment ID.</span></label>
        <Button disabled={!consent || pending} busy={busy} onClick={() => void run(version => write('profile', version))}>Link my Payment ID</Button>
      </>}
      <details className="name-permissions"><summary>Payment record access</summary><p>Allow another wallet to update only this name’s Payment ID.</p><p className="field-hint">Only trust an editor who may redirect future payments. Name ownership and other records are unchanged.</p>
        <label className="field">Editor wallet address<input value={editor} maxLength={42} disabled={busy || pending} onChange={event => { setEditor(event.target.value); setScope(undefined); setStatus(''); setError(''); }} placeholder="0x…" spellCheck={false} autoComplete="off" /></label>
        <div className="button-row"><Button variant="secondary" disabled={pending || !/^0x[\da-fA-F]{40}$/.test(editor.trim())} busy={busy} onClick={() => void run(version => write('grant', version))}>Grant record access</Button><Button variant="ghost" disabled={pending || !/^0x[\da-fA-F]{40}$/.test(editor.trim()) || busy} onClick={() => void run(version => write('revoke', version))}>Remove record access</Button><Button variant="ghost" disabled={!/^0x[\da-fA-F]{40}$/.test(editor.trim()) || busy} onClick={() => void run(async version => { const result = await inspectPaymentEditorScope(ensClient, checked.name, getAddress(editor.trim())); if (version === revision.current) setScope(result); })}>Check access</Button></div>
        {scope && scope.name === checked.name && scope.editor.toLowerCase() === editor.trim().toLowerCase() && <div className="section-block" role="status">
          <h3>Current editor permissions</h3>
          <KeyValue label="NULL payment record">{scope.paymentRecord ? 'Can update' : 'Cannot update'}</KeyValue>
          <KeyValue label="Website record (url)">{scope.websiteRecord ? 'Can update' : 'Cannot update'}</KeyValue>
          <p className="field-hint">Read from Sepolia at block {scope.blockNumber}. These checks cover the two named text records. No transaction was sent; existing payments are unchanged.</p>
          {scope.broaderPaymentAccess && <Notice tone="warning">This wallet has broader payment-record permissions. Removing one grant may leave other access in place.</Notice>}
          <Button variant="ghost" icon={Download} onClick={() => download('null-ens-permissions.json', JSON.stringify({ schema: 'null.ens-permissions.v1', chainId: ENS_CHAIN_ID, ...scope, transactionsSent: 0 }, null, 2))}>Download permission check</Button>
        </div>}
      </details>
    </div>}
    {walletAddress && <p className="field-hint">Signing wallet: <code>{walletAddress}</code></p>}
    {hash && <p className="field-hint"><a href={`https://sepolia.etherscan.io/tx/${hash}`} target="_blank" rel="noopener noreferrer">View transaction on Sepolia <ExternalLink size={12} /></a></p>}
    {pending && !busy && <><Notice>Confirmation is still pending. Check this transaction before sending another update.</Notice><Button variant="secondary" onClick={() => void run(version => confirmed(hash!, version))}>Check confirmation</Button></>}
    {status && <p className="name-status" role="status">{status}</p>}{error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
