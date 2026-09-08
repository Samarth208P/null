import { useState, type ReactNode } from 'react';
import { PrivyProvider, usePrivy, useLogin } from '@privy-io/react-auth';
import { sepolia } from 'viem/chains';
import { config } from '../lib/config';
import { short } from '../lib/format';
import { SessionContext } from '../lib/session';

export function PrivyRuntime({ children }: { children: ReactNode }) {
  return <PrivyProvider appId={config.privyAppId!} config={{ loginMethods: ['email', 'wallet'], defaultChain: sepolia, supportedChains: [sepolia], embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } }, appearance: { theme: 'light', accentColor: '#20252b', logo: '/logo.svg' } }}><SessionBridge>{children}</SessionBridge></PrivyProvider>;
}
function SessionBridge({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, logout } = usePrivy();
  const [error, setError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const { login } = useLogin({ onComplete: () => setError(''), onError: code => setError(code === 'exited_auth_flow' ? '' : 'Sign-in was not completed. Please try again.') });
  async function signOut() {
    setSigningOut(true); setError('');
    try { await logout(); window.location.hash = ''; }
    catch { setError('We could not sign you out. Please try again.'); }
    finally { setSigningOut(false); }
  }
  return <SessionContext.Provider value={{ configured: true, ready, authenticated, userId: user?.id || null, label: user?.email?.address || (user?.wallet?.address ? short(user.wallet.address, 5) : 'Your account'), error, signingOut, signIn: () => { setError(''); login(); }, signOut }}>{children}</SessionContext.Provider>;
}
