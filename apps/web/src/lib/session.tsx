import { createContext, useContext } from 'react';

export type Session = {
  configured: boolean;
  ready: boolean;
  authenticated: boolean;
  userId: string | null;
  label: string;
  walletAddresses?: string[];
  privyWalletAddresses?: string[];
  walletsReady?: boolean;
  error: string;
  signingOut: boolean;
  walletModalOpen?: boolean;
  signIn: () => void;
  signOut: () => Promise<void>;
};

export const SessionContext = createContext<Session>({ configured: false, ready: true, authenticated: false, userId: null, label: '', error: '', signingOut: false, signIn: () => {}, signOut: async () => {} });
export function useSession() { return useContext(SessionContext); }
