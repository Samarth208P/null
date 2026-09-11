import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { preparePayout, resolvePayoutRecipients, type PayoutRecipient, type ResolvedPayoutRecipient } from '@null-protocol/payouts';
import { NullLiveClient, PayoutClient, type LiveClientOptions, type ApprovePayoutOptions } from '@null-protocol/payouts/client';
import { PayoutJob, resolvePayoutJobRecipients } from '@null-protocol/payouts/jobs';
import { WithdrawalJob, planWithdrawal } from '@null-protocol/payouts/withdrawals';
import type { OwnedPrivateNote } from '@null-protocol/client';
import type { Address } from 'viem';

/** Framework-independent integration. The host owns UI, authentication, storage and wallet consent. */
export function createEmbeddedPayouts(options: LiveClientOptions, ensRpcUrl: string) {
  const ens = createPublicClient({ chain: sepolia, transport: http(ensRpcUrl) });
  const live = new NullLiveClient(options);
  const payouts = new PayoutClient(live, ens);
  return {
    jobs: {
      resolve: (recipients: readonly PayoutRecipient[]) => resolvePayoutJobRecipients(ens, recipients),
      prepare: (recipients: readonly ResolvedPayoutRecipient[]) => PayoutJob.prepare({ ens, context: live.context, recipients }),
      client: payouts,
    },
    resolve: (recipients: readonly PayoutRecipient[]) => resolvePayoutRecipients(ens, recipients),
    // Host displays names, fingerprints and amounts and obtains confirmation first.
    prepare: (recipients: readonly ResolvedPayoutRecipient[]) => preparePayout({ ens, context: live.context, recipients }),
    approve: (draft: Awaited<ReturnType<typeof preparePayout>>, authorization: ApprovePayoutOptions) => payouts.approve(draft, authorization),
    submit: payouts.submit.bind(payouts),
    reconcile: payouts.reconcile.bind(payouts),
    // Recovery and withdrawal must remain usable even after ENS expiry.
    recipient: {
      planWithdrawal,
      createWithdrawal: (notes: readonly OwnedPrivateNote[], amountAtomic: bigint, recipient: Address) => new WithdrawalJob(live, notes, amountAtomic, recipient),
      discover: live.discover.bind(live),
      prepareClaim: live.prepareClaim.bind(live),
      prepareWithdrawal: live.prepareWithdrawal.bind(live),
      submit: live.submit.bind(live),
      reconcile: live.reconcile.bind(live),
      recoverNotes: live.recoverPrivateNotes.bind(live),
    },
    treasury: {
      registerPolicy: live.registerPolicy.bind(live),
      prepareShield: live.prepareShield.bind(live),
      submit: live.submit.bind(live),
      reconcile: live.reconcile.bind(live),
      recoverNotes: live.recoverTreasuryNotes.bind(live),
    },
  };
}
