import { preparePayout, resolvePayoutRecipients } from '@samarth208p/null-payouts';
import { PayoutClient, type LiveClientOptions, type BroadcastTransport } from '@samarth208p/null-payouts/client';
import { PayoutJob } from '@samarth208p/null-payouts/jobs';
import { WithdrawalJob } from '@samarth208p/null-payouts/withdrawals';
import { verifyCreResult } from '@samarth208p/null-payouts/cre';
import { createPrivacyProfile } from '@samarth208p/null-payouts/sdk';
import { normalizePaymentName } from '@samarth208p/null-payouts/ens';
import { encryptRecovery } from '@samarth208p/null-payouts/wallet';
import { proveInWorker, type ProofRequest } from '@samarth208p/null-payouts/prover';
import { proveLocally } from '@samarth208p/null-payouts/prover/runtime';
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';

const ens = createPublicClient({ chain: sepolia, transport: http() });
const context = { chainId: 11155111n, poolAddress: '0x1111111111111111111111111111111111111111' as const };
export async function prepare() {
  const recipients = await resolvePayoutRecipients(ens, [{ reference: 'invoice', name: 'alice.eth', amount: '1' }]);
  return preparePayout({ ens, context, recipients });
}
export type HostConfiguration = { options: LiveClientOptions; transport: BroadcastTransport; request: ProofRequest };
export const api = { PayoutClient, PayoutJob, WithdrawalJob, verifyCreResult, createPrivacyProfile, normalizePaymentName, encryptRecovery, proveInWorker, proveLocally };
