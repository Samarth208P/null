import { createContext, useContext } from 'react';

export type Session = {
  configured: boolean;
  ready: boolean;
  authenticated: boolean;
  userId: string | null;
  label: string;
  error: string;
  signingOut: boolean;
  signIn: () => void;
  signOut: () => Promise<void>;
};

export const SessionContext = createContext<Session>({ configured: false, ready: true, authenticated: false, userId: null, label: '', error: '', signingOut: false, signIn: () => {}, signOut: async () => {} });
export function useSession() { return useContext(SessionContext); }
