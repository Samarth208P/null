# Private payouts inside your application

NULL is an embeddable TypeScript payout toolkit. Your application supplies its interface, wallet connection, organization authorizer, and encrypted local recovery. NULL resolves ENS destinations, compiles encrypted entitlements, orchestrates proofs, discovers recipient allocations, and validates transaction outcomes. The web application is a reference integration, not a required destination for your users.

**Distribution:** the standalone npm developer preview is named `@samarth208p/null-payouts`; source builds use `pnpm pack:npm`. See [npm packaging and standalone imports](NPM_PACKAGE.md). The examples below use workspace imports; installed consumers replace `@null-protocol/payouts` with `@samarth208p/null-payouts` and use its `/sdk`, `/ens`, `/wallet`, and `/client` subpaths for the corresponding internal packages. **Network:** Ethereum Sepolia v0.2; v0.3 verified locally. **Capacity:** larger logical jobs split into distributions of up to eight recipients. **Security:** unaudited testnet prototype. There is no hosted payout API, drop-in React widget, or production SLA in this release.

## Run a real preparation

```sh
git clone https://github.com/Samarth208P/null.git
cd null
corepack enable
pnpm install --frozen-lockfile
pnpm example:payouts
```

Node.js 22.16+ and pnpm 11.9.0 are required. The example makes live Sepolia ENS reads and creates genuine ciphertexts locally. It performs no proof, CRE execution, approval, deposit, or payout. The default ENS name is a verification fixture; do not fund it. The homepage's interactive preparation uses the same API, with compilation in a Web Worker.

Start from [`apps/payout-example/src/integration.ts`](../apps/payout-example/src/integration.ts) for a browser host. Its `createEmbeddedPayouts` factory has no React or reference-app dependencies. The complete reference application's entry is [`apps/web/src/ReferenceApp.tsx`](../apps/web/src/ReferenceApp.tsx).

## Host responsibilities

| Host application supplies | NULL supplies |
| --- | --- |
| Recipient form and payer confirmation | ENS normalization, resolution, profile fingerprints and destination rechecks |
| Authentication, organization membership and authorizer | Bound intent callback, local signature/proof checks and Privy reference adapter |
| Encrypted recovery storage and backup/export UI | `createEncryptedCheckpointStore`, checkpoint callbacks and chain recovery methods |
| Wallet connection or configured relayer | Transaction encoding, simulation, submission and receipt/effect validation |
| User-facing progress and uncertain-state handling | Operation stages, transaction callbacks and reconciliation results |
| Circuit hosting and configured public RPC/indexer | Manifest/hash verification, local proving and validated discovery |

Keep user spending/viewing keys, recovery passwords, policy openings and checkpoints in the browser. Never put them in server requests, logs or analytics. Your RPC/indexer still sees network requests. A compromised browser or frontend can expose plaintext.

## Resolve, review, prepare

The host creates a viem Sepolia public client (`ens`) and uses the configured deployment's chain ID and pool address (`context`). The following is the preparation portion, not a payment:

```ts
import { resolvePayoutRecipients, preparePayout } from '@null-protocol/payouts';

const recipients = await resolvePayoutRecipients(ens, [
  { reference: 'invoice-42', name: 'alice.eth', amount: '25' },
]);
// Host UI: show name, profile fingerprint and amount; obtain payer confirmation.
const draft = await preparePayout({ ens, context, recipients });
const encrypted = draft.publicBundle;
```

`alice.eth` is illustrative; it must actually resolve to a supported Sepolia ENSv2 NULL profile. Amounts are positive decimal strings with at most six decimal places. Private references must be distinct. ENS resolution does not identify a legal person or substitute for the payer verifying the intended recipient.

All recipients require confirmed ENSv2 snapshots. Missing records, unsupported resolvers, and changed owners/resolvers/profiles block preparation or approval. ENS is required by this high-level SDK and the reference application; the low-level compiler and immutable pool remain identity-agnostic. Claims, recovery and withdrawals do not depend on an active ENS name.

`preparePayout` returns an in-memory `PayoutDraft`. It checks names before and after deterministic compilation. A `compiler` callback can run `compileDistribution` in your Web Worker; it is trusted application code, not a security sandbox. Do not replace it with an untrusted remote compiler. `batchEntropy`, when provided, must be fresh secret randomness, never reused across independent batches.

| Draft property | Sensitivity and meaning |
| --- | --- |
| `summary` | Recipient count, total atomic amount and commitment; private business metadata |
| `paymentNames` | Public ENS snapshots; the roster associating them with this draft is private |
| `publicBundle` | Public protocol context and eight padded encrypted envelopes |
| `compiled` | Private allocation data needed for proving; keep local |
| `creInput` | Explicit private simulation export, including amounts, profiles and secret entropy |

Getters return copies; mutating a displayed snapshot does not change the sealed draft. JSON serialization of the draft is blocked. That prevents a common accidental export, but cannot prevent a malicious host from reading private fields. JavaScript does not guarantee memory erasure.

## Authorize and prove

Construct a `NullLiveClient` from the verified manifest, public RPC URLs, artifact base URL and a `persistLocalSecret` callback that actually saves encrypted checkpoints. Pair it with a `PayoutClient(live, ens)`. The example factory constructs both.

Before the first distribution, register the organization's policy and shield its funds using the treasury methods. Both need explicit user consent and transaction confirmation. Recover and select the appropriate treasury notes; do not fabricate note openings or treat a displayed balance as a spendable note.

```ts
const operation = await payouts.approve(draft, {
  treasuryNotes, // One or two actual unspent treasury notes.
  authPolicy,    // The matching registered policy opening; private.
  authorize,     // Your owner-authorized signing adapter.
  compilation: { mode: 'local' },
  onProgress: showProgress,
});
```

This is a host-integration fragment: `treasuryNotes`, `authPolicy`, `authorize` and `showProgress` come from the host's secure storage, wallet/authorization flow and UI. `authorize` receives the exact digest, public inputs, context, commitment and envelope root. It must return the expected compact raw-digest signature. Do not substitute a personal-message signature. Use the [Privy adapter instructions](../packages/auth/README.md) when connecting an organization wallet. Server credentials remain on your own server.

The wrapper rechecks ENS before asking for authorization, after the owner returns a signature, after proof preparation, and before submission. The underlying client verifies the signature and proof inputs. These checks cannot make offchain ENS reads atomic with a later chain transaction. The encrypted destination is fixed to the approved draft; a subsequent key rotation does not redirect that payout.

## CRE compilation

For the current confidential-workflow demonstration, privately export `draft.creInput`, run `pnpm cre:simulate --input "PATH_TO_PRIVATE_INPUT.json"`, and read the resulting public JSON file. Then use:

```ts
compilation: { mode: 'cre-local-simulation', result: resultFileText }
```

The approval wrapper validates the batch ID, exact bundle, envelopes and context before invoking the authorizer. This is file integrity and successful local simulation, not remote TEE attestation. A required confidential-payroll product path must enforce the choice in the host; the toolkit also supports explicit local compilation. See [CRE setup](../cre-starter/README.md).

## Submit and reconcile

Save an encrypted funds backup and obtain the user's broadcast consent before calling:

```ts
const confirmed = await payouts.submit(operation, { mode: 'wallet', wallet }, {
  onProgress: showProgress,
  onTransactionSubmitted: rememberPublicTransactionHash,
});
```

Keep the `PayoutClient` instance and prepared operation alive. `SubmissionUncertainError` means the request may have reached the network. Preserve the operation/checkpoints and call `payouts.reconcile(operation, knownTransactionHash)`. Never auto-repeat a payout because a timeout elapsed. `not-observed` is not evidence of failure. Reconciliation remains available after an ENS name changes or expires.

After a reload, restore encrypted recovery checkpoints and sync chain history. Prepared operations are instance-bound and are not restored by JSON import. The example's `recipient.recoverNotes` and `treasury.recoverNotes` expose the recovery paths. `localRecoverySaved: false` on a confirmed result means the transaction succeeded but the subsequent local save failed; retain the pre-broadcast backup and recover from chain evidence.

## Recipient integration

Generate and back up the recipient's NULL spending/viewing keys using the existing [wallet package](../packages/wallet/). With explicit consent, publish only their public profile through the [ENS record helpers](../packages/ens/src/index.ts). A Privy login does not restore NULL keys.

The example adapter exposes `recipient.discover({ keys })`, `prepareClaim({ allocation })`, `submit`, `reconcile`, `recoverNotes`, and `prepareWithdrawal`. Discovery scans ciphertexts locally. Claims create private notes; withdrawing is a separate operation and requires `acknowledgePublicWithdrawal: true`. A withdrawal publicly reveals destination, amount and timing.

## Current evidence and limits

- Shared SDK adoption is implemented in the reference application's testnet preparation, approval, submission and reconciliation paths; the new homepage can run read-only preparation without loading Privy.
- Unit tests use genuine local encryption with test doubles for ENS and signing/broadcast boundaries. They do not establish a newly completed owner-approved payment or a security audit.
- The historical [Sepolia rehearsal](../deployments/payment-flow-sepolia-v2.json) used genuine proofs and an isolated signer. Recorded distribution/claim/recipient-withdrawal gas was approximately 6.99m/5.14m/4.01m. No production fee or throughput claim follows from that test.
- The Privy-controlled end-to-end financial demonstration remains outstanding. CRE evidence is local simulation. See [submission readiness](SUBMISSION_READINESS.md).
- Public entry/exit, public ENS profiles, small pool activity and network metadata constrain privacy. See [privacy boundaries](PRIVACY_GUARANTEES.md).

No browser/Netlify variable was added for the SDK or preparation example. The standalone relayer gained optional server-only `RELAYER_MAX_GAS`. A host still needs deployment, artifact, wallet/organization and recovery configuration. Enabling v0.3 requires new deployed contracts and verified artifacts; changing an environment value cannot upgrade the v0.2 pool. Never reuse private reference-service credentials in another application.

## Large organization payouts

The web form accepts ENS names and amounts, or `ens,amount` CSV. Your own UI can use:

```ts
import { resolvePayoutJobRecipients, PayoutJob } from '@null-protocol/payouts/jobs';

const recipients = await resolvePayoutJobRecipients(ens, rows);
// Host: show the resolved roster/amounts and obtain payer confirmation.
const job = await PayoutJob.prepare({ ens, context, recipients });
await job.send({
  client: payouts, transport,
  approveBatch: async (draft, index) => ({
    treasuryNotes: await recoverAndSelectCurrentTreasuryNotes(draft.summary.totalAmountAtomic),
    authPolicy, authorize, compilation: { mode: 'local' },
  }),
  onProgress: persistPublicJobProgress,
});
```

This is an integration fragment: the host supplies rows, transport, note selection, registered policy, authorizer and persistence callbacks. Rows contain `{ reference, name, amount }`; private references must be distinct across the entire job. Each group has at most eight recipients and a uint64 atomic total. It receives fresh entropy, authorization and proof. For CRE, provide each draft's matching result in `approveBatch`.

Jobs are sequential, not all-or-nothing. `completedBatches`, `confirmed` and `requiresReconciliation` expose in-memory progress. On uncertainty call `job.reconcile(payouts)` and save the returned receipt; `not-observed` remains blocked. After reload, restore encrypted checkpoints and check chain evidence before constructing a replacement job. There is no automatic serialized-job resume. The reference UI records each confirmed group and requires a new funds backup/confirmation for the next group. Large jobs may need several owner/wallet interactions.

## ENS during account creation

Ask for the recipient's preferred ENS name when creating local keys. The reference onboarding does this and prefills the record manager. The field does not register a name or publish keys: the user must own the supported Sepolia name, back up their local keys, and explicitly approve publishing the public NULL profile. ENS is the payment identifier. A public withdrawal wallet is a separate exit destination.

## Gas paid by the integrating app or organization

Use `{ mode: 'wallet', wallet }` for organization-paid gas, or a typed sponsor callback:

```ts
import type { BroadcastTransport, PublicOperation } from '@null-protocol/client';
import type { Hex } from 'viem';

const transport: BroadcastTransport = {
  mode: 'sponsored',
  send: async (operation: PublicOperation): Promise<Hex> => {
    const response = await fetch('/api/my-payout-sponsor', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(operation),
    });
    if (!response.ok) throw new Error('Sponsor did not return a transaction hash');
    return (await response.json()).transactionHash;
  },
};
```

This endpoint is one you implement; NULL does not host it. Authenticate customers, enforce allowed chain/pool/method and budgets, and return the broadcast hash. `createRelayer` in the bundled service validates and broadcasts public operations. Keep a separate gas key server-side. The client validates receipts/effects and treats callback errors as uncertain, without automatic wallet fallback.

The callback gets proofs, public inputs and encrypted envelopes, never private payroll rows, spending keys or recovery openings. The sponsor still observes network metadata. Sponsoring gas neither authorizes the organization payout nor provides its USDC. Initial ERC-20 approval/deposit currently requires the funding wallet; this is not sponsorship for arbitrary wallet actions.

The standalone relayer's optional `RELAYER_MAX_GAS` is a per-transaction ceiling including 20% padding. Its unchanged default of 3,000,000 is too low for several measured proof actions; the local v0.3 test used 10,000,000. Choose an explicit budget from your verified workload. CORS/IP limits alone do not authenticate a customer or limit total sponsor spending.

## Withdraw any amount from received balances

On a v0.3 manifest with `security.partialWithdrawalsImplemented: true`, `live.prepareWithdrawal({ note, amountAtomic, recipient, acknowledgePublicWithdrawal: true })` creates exact private change when the requested amount is smaller. Omitting the amount exits the whole note. Partial treasury refunds are not supported. The current public v0.2 pool rejects partial exits.

For an amount spanning several recovered, unspent recipient notes:

```ts
import { WithdrawalJob } from '@null-protocol/payouts/withdrawals';

const withdrawal = new WithdrawalJob(live, recoveredPrivateNotes, requestedAtomicAmount, publicExitAddress);
// Show amount, address and withdrawal.transactionCount; obtain consent.
await withdrawal.send({
  transport, acknowledgePublicWithdrawal: true,
  beforeSubmit: saveAndConfirmEncryptedRecovery,
  onConfirmed: persistPublicWithdrawalReceipt,
});
```

The host's `beforeSubmit` receives the prepared operation and transfer index; save its recovery encrypted before consent/broadcast. `onConfirmed` receives the confirmed result and index. A multi-note withdrawal creates several public transfers and can partially complete. Reconcile unknown results with `withdrawal.reconcile()` and retain returned receipts. `planWithdrawal` is exported separately for custom orchestration; the live client/contract still verify actual spendability.

Fresh change secrets cannot be reconstructed from the original Payment ID alone. Preserve the updated encrypted checkpoint/backup before every partial withdrawal. Partial exits keep the original received amount out of that proof's public inputs; timing, reused addresses and small pool activity still permit inference. See [v0.3 evidence](PAYOUT_V3_VERIFICATION.md) for local tests and public release boundaries.
