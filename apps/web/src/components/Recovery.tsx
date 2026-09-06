import { useRef, useState } from 'react';
import { Download, FileUp, KeyRound } from 'lucide-react';
import { profileFromKeys } from '@null-protocol/sdk';
import { decryptRecovery, encryptRecovery, loadVault, saveVault } from '@null-protocol/wallet';
import { useStore } from '../lib/store';
import { download } from '../lib/format';
import { Button, Modal, Notice } from './ui';

export function Recovery({ open, onClose, initialMode = 'export' }: { open: boolean; onClose: () => void; initialMode?: 'export' | 'restore' }) {
  const store = useStore(); const [mode, setMode] = useState(initialMode); const [password, setPassword] = useState(''); const [repeat, setRepeat] = useState(''); const [file, setFile] = useState<File>(); const [persist, setPersist] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const fileInput = useRef<HTMLInputElement>(null);
  const close = () => { setPassword(''); setRepeat(''); setFile(undefined); setError(''); onClose(); };
  async function submit() {
    setError(''); setBusy(true);
    try {
      if (mode === 'export') {
        if (password !== repeat) throw new Error('The passwords do not match.');
        if (password.length < 12) throw new Error('Choose a password with at least 12 characters.');
        const encrypted = await encryptRecovery(store.identity.keys, password);
        download('null-encrypted-recovery.json', encrypted);
        if (persist) { try { await saveVault(encrypted); } catch { store.toast('Recovery downloaded. Browser storage was unavailable.'); close(); return; } }
        store.toast('Encrypted recovery downloaded. Keep the password separately.');
      } else {
        if (file && file.size > 16384) throw new Error('Choose a NULL recovery file under 16 KB.');
        const encrypted = file ? await file.text() : await loadVault();
        if (!encrypted) throw new Error('Choose a recovery file, or save an encrypted vault on this device first.');
        const keys = await decryptRecovery(encrypted, password);
        store.setIdentity({ keys, profile: profileFromKeys(keys) });
        store.toast('Privacy profile restored. Scan your inbox to recover published entitlements.');
      }
      close();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not complete recovery.'); }
    finally { setBusy(false); }
  }
  return <Modal title="Your keys. Your recovery." description="Encrypted on your device with a password only you know." open={open} onClose={() => { if (!busy) close(); }}><div className="tabs recovery-tabs"><button className={mode === 'export' ? 'selected' : ''} onClick={() => { setMode('export'); setError(''); }}>Export recovery</button><button className={mode === 'restore' ? 'selected' : ''} onClick={() => { setMode('restore'); setError(''); }}>Restore profile</button></div><Notice icon={KeyRound}>This file contains encrypted spending and viewing keys. Anyone with the file and password can access the profile. Store them separately.</Notice>{mode === 'restore' && <><button className="file-restore" onClick={() => fileInput.current?.click()}><FileUp size={20} /><span>{file?.name || 'Choose an encrypted recovery file'}</span></button><input type="file" accept=".json,application/json" ref={fileInput} hidden onChange={event => setFile(event.target.files?.[0])} /><p className="field-hint">Without a file, restore the encrypted vault saved in this browser.</p></>}<label className="field">{mode === 'export' ? 'Recovery password' : 'Unlock password'}<input type="password" autoComplete={mode === 'export' ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 12 characters" /></label>{mode === 'export' && <><label className="field">Repeat password<input type="password" autoComplete="new-password" value={repeat} onChange={event => setRepeat(event.target.value)} /></label><label className="checkbox-field"><input type="checkbox" checked={persist} onChange={event => setPersist(event.target.checked)} /><span>Also save this encrypted vault in my browser.</span></label></>}<p className="field-hint">Recovery preserves your profile keys. Sandbox drafts and sample balances reset when the page reloads; chain history is required to recover real notes.</p>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><Button variant="secondary" disabled={busy} onClick={close}>Cancel</Button><Button busy={busy} icon={mode === 'export' ? Download : KeyRound} onClick={() => void submit()}>{mode === 'export' ? 'Download encrypted recovery' : 'Restore profile'}</Button></div></Modal>;
}
