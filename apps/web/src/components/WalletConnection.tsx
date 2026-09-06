import { lazy, Suspense } from 'react';
import { Wallet } from 'lucide-react';
import { config } from '../lib/config';
import { Button } from './ui';
import type { ReactNode } from 'react';

const PrivyRuntime = lazy(() => import('./PrivyRuntime').then(module => ({ default: module.PrivyRuntime })));
const ConfiguredWallet = lazy(() => import('./PrivyRuntime').then(module => ({ default: module.ConfiguredWallet })));

export function WalletProvider({ children }: { children: ReactNode }) {
  if (!config.privyAppId) return children;
  return <Suspense fallback={<div className="fatal-error"><span className="wordmark">NULL</span><p role="status">Opening your secure workspace…</p></div>}><PrivyRuntime>{children}</PrivyRuntime></Suspense>;
}
export function WalletConnection() {
  if (!config.privyAppId) return <Button variant="secondary" icon={Wallet} onClick={() => { window.location.hash = '/settings'; }}>Connect wallet</Button>;
  return <Suspense fallback={<Button variant="secondary" disabled>Connecting…</Button>}><ConfiguredWallet /></Suspense>;
}
