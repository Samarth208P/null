# NULL payout SDK

Embed private payouts in a web application with local keys and your own UI. This package composes the existing cryptographic SDK, ENSv2 integration, and live proof client. The reference app uses it for testnet preparation, approval, submission, and reconciliation.

**MIT-licensed developer preview.** Install the standalone registry package with `npm install @samarth208p/null-payouts@preview`. The source workspace keeps the private `@null-protocol/payouts` name; standalone imports use `@samarth208p/null-payouts` and its subpaths. Run `pnpm pack:npm` to build a local tarball containing compiled ESM, declarations and internal NULL modules. See [npm packaging](../../docs/NPM_PACKAGE.md). Unaudited; Sepolia v0.2 and locally verified v0.3.

`./jobs` resolves and sends larger ENS payout lists as consecutive groups of at most eight, retaining confirmed progress and blocking retries while a result is unknown. `./withdrawals` plans an amount across private notes and coordinates whole/partial exits. Partial exits require the new v0.3 pool, which is not yet deployed publicly. Both job types are in-memory, not durable queues.

Choose wallet-paid gas or `{ mode: 'sponsored', send }` with your authenticated sponsor endpoint. Only public operations reach that callback. Organization consent, private funding and encrypted recovery remain separate requirements. See the [integration guide](../../docs/SDK_INTEGRATION.md) and [local real-proof evidence](../../docs/PAYOUT_V3_VERIFICATION.md).

## Start

From the repository root:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm example:payouts
pnpm test:payouts
```

The example resolves a real ENSv2 verification name and runs local encryption. It prints only a preparation summary. It has no wallet, account, signing key, funding, or broadcast step. Do not pay the default verification profile.

## Entry points

| Import | Purpose |
| --- | --- |
| `@null-protocol/payouts` | `resolvePayoutRecipients`, `preparePayout`, `PayoutDraft`, recipient types and ENS errors |
| `@null-protocol/payouts/client` | `PayoutClient`, `NullLiveClient`, encrypted checkpoint storage, uncertain-submission error and integration types |
| `@null-protocol/payouts/cre` | `verifyCreResult` and private CRE input format |

Resolve names, display the snapshots and amounts in your UI, obtain payer confirmation, then prepare. `preparePayout` checks ENS both before and after compilation. `PayoutClient.approve` rechecks before and after authorization; `submit` rechecks before handing off to the live client. These are application checks, not ENS invariants in the pool. Records can still change after the final read; the approved encrypted destination remains fixed.

`PayoutClient.approve` requires an explicit compilation choice: `{ mode: 'local' }` or `{ mode: 'cre-local-simulation', result }`. A matching CRE file checks integrity, not remote provenance. The host supplies the organization authorizer; [Privy](../auth/README.md) is the reference adapter.

Draft getters return copies. `JSON.stringify(draft)` throws to discourage accidental private exports. Only `draft.publicBundle` is intended for public serialization. `draft.compiled` contains private allocations; `draft.creInput` contains payroll and secret entropy. Never log or upload these as ordinary API payloads. JavaScript cannot guarantee erasure of strings or garbage-collected copies.

An approved operation belongs to its `PayoutClient` instance. Keep that instance and operation alive while submitting or reconciling. The underlying `NullLiveClient` owns duplicate submission protection and receipt validation. After a page reload, restore encrypted checkpoints and recover against chain history; do not reconstruct an operation from arbitrary JSON and resend it.

See the [integration guide](../../docs/SDK_INTEGRATION.md), [typed host adapter](../../apps/payout-example/src/integration.ts), [read-only example](../../apps/payout-example/src/prepare.ts), and [privacy boundaries](../../docs/PRIVACY_GUARANTEES.md).
