import type { ReactNode } from 'react';
import { PrivyProvider, usePrivy, useWallets } from '@privy-io/react-auth';
import { sepolia } from 'viem/chains';
import { Wallet } from 'lucide-react';
import { config } from '../lib/config';
import { short } from '../lib/format';
import { Button } from './ui';

export function PrivyRuntime({ children }: { children: ReactNode }) {
  return <PrivyProvider appId={config.privyAppId!} config={{ loginMethods: ['email', 'wallet'], defaultChain: sepolia, supportedChains: [sepolia], embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } }, appearance: { theme: 'light' } }}>{children}</PrivyProvider>;
}
export function ConfiguredWallet() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();
  return <Button variant="secondary" icon={Wallet} disabled={!ready} onClick={() => authenticated ? void logout() : login()}>{authenticated ? short(wallets[0]?.address || 'Connected', 5) : 'Connect wallet'}</Button>;
}
