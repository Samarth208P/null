import { useState, type ReactNode } from 'react';
import { PrivyProvider, usePrivy, useLogin, useModalStatus, useWallets } from '@privy-io/react-auth';
import { sepolia } from 'viem/chains';
import { config } from '../lib/config';
import { SessionContext } from '../lib/session';

export function PrivyRuntime({ children }: { children: ReactNode }) {
  return <PrivyProvider appId={config.privyAppId!} config={{ loginMethods: ['email', 'wallet'], defaultChain: sepolia, supportedChains: [sepolia], embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } }, appearance: { theme: 'light', accentColor: '#20252b', logo: '/logo.svg' } }}><SessionBridge>{children}</SessionBridge></PrivyProvider>;
}
function SessionBridge({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, logout } = usePrivy();
  const { wallets } = useWallets();
  const { isOpen: walletModalOpen } = useModalStatus();
  const [error, setError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const { login } = useLogin({ onComplete: () => setError(''), onError: code => setError(code === 'exited_auth_flow' ? '' : 'Sign-in was not completed. Please try again.') });
  async function signOut() {
    setSigningOut(true); setError('');
    try { await logout(); window.location.hash = ''; }
    catch { setError('We could not sign you out. Please try again.'); }
    finally { setSigningOut(false); }
  }
  return <SessionContext.Provider value={{ configured: true, ready, authenticated, walletModalOpen, userId: user?.id || null, walletAddresses: authenticated ? [...new Set([...wallets.map(wallet => wallet.address), ...(user?.wallet?.address ? [user.wallet.address] : [])])] : [], label: user?.email?.address || 'Wallet sign-in', error, signingOut, signIn: () => { setError(''); login(); }, signOut }}>{children}</SessionContext.Provider>;
}
