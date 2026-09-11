import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { preparePayout, resolvePayoutRecipients } from '@null-protocol/payouts';
import manifest from '../../web/public/deployment.json' with { type: 'json' };

// Read-only example. No wallet, API secret, account, funding, or broadcast is used.
const [name = 'receive.nullpay2026.eth', amount = '0.01'] = process.argv.slice(2);
const ens = createPublicClient({ chain: sepolia, transport: http('https://ethereum-sepolia-rpc.publicnode.com') });
const recipients = await resolvePayoutRecipients(ens, [{ reference: 'example-recipient', name, amount }]);
// In your app, show this resolution for the payer's explicit confirmation first.
// This example only compiles and discards a draft; it cannot approve a payment.
const draft = await preparePayout({ ens, context: { chainId: BigInt(manifest.chainId), poolAddress: manifest.contracts.nullPool as `0x${string}` }, recipients });
console.log(JSON.stringify({
  status: 'prepared-only', network: 'Ethereum Sepolia', transactionSent: false,
  recipientCount: draft.summary.recipientCount,
  encryptedSlots: draft.publicBundle.envelopes.length,
  commitment: draft.publicBundle.commitment,
  note: 'Real ENS reads and local encryption. No CRE execution, proof, approval, or payment. Default name is a verification fixture; do not fund it.',
}, null, 2));
// Do not log draft.compiled, draft.creInput, recipient references or recovery keys.
