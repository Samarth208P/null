import type { Address } from 'viem';

export type NameWallet = { address: Address; label: string };

/** Prefer the name owner, but verify resolver permission for every candidate. */
export async function findNameWallet(wallets: readonly NameWallet[], owner: Address, canUpdate: (address: Address) => Promise<boolean>): Promise<NameWallet | undefined> {
  const unique = [...new Map(wallets.map(wallet => [wallet.address.toLowerCase(), wallet])).values()];
  const ordered = [...unique.filter(wallet => wallet.address.toLowerCase() === owner.toLowerCase()),
    ...unique.filter(wallet => wallet.address.toLowerCase() !== owner.toLowerCase())];
  let failed = false;
  for (const wallet of ordered) {
    try { if (await canUpdate(wallet.address)) return wallet; }
    catch { failed = true; }
  }
  if (failed) throw new Error('Wallet permissions could not be checked. Try again.');
  return undefined;
}
