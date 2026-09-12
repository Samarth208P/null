# Sponsor evidence walkthrough

Prepared September 12, 2026. This is a navigation guide to implementation and recorded evidence, not a qualification certificate. Use the same v0.2 Sepolia payout across the three sponsor scenes. The full Privy-approved payment and final video are still pending in the available evidence.

The released app includes a visible organization setup, backup-before-activation, activation reconciliation, an ENS two-record permission comparison, explicit CRE rejection/success states, and public transaction receipt downloads. Follow the [owner rehearsal](OWNER_REHEARSAL.md) when ready to sign. The [September 12 release evidence](../deployments/submission-release-2026-09-12.json) records the pushed source, verified hosted assets, proof artifacts and organization API checks.

## Product in one sentence

NULL lets a business pay contributors by ENS name without publishing a plaintext recipient-and-amount roster, through a toolkit that applications embed in their own UI.

ENS records and entry/exit transfers are public. Claims hide the specific source distribution in their public inputs; small pools and timing can still reveal relationships. The SDK is a published developer preview; partial withdrawals are locally verified v0.3 functionality, not part of the live v0.2 pool.

## ENS: receiving identities with narrowly scoped editing

**Sponsor requirement:** functional ENSv2 on Sepolia, central to the product, with accessible source and a demo. [Official ENS requirements](https://ethglobal.com/events/ethonline2026/prizes/ens).

**Product consequence:** a name resolves to the keys used to encrypt the entitlement. An editor can receive permission for one payment record without control over all records. Changed destinations require renewed review.

| Show | Source or evidence | What this establishes |
| --- | --- | --- |
| Resolve a real name and its alias | [Resolver implementation](../packages/ens/src/index.ts), [setup transactions](../deployments/ens-sepolia.json) | Names determine receiving profiles; alias resolution is live infrastructure |
| Scoped editor grant, then its recorded revocation | [Permission UI](../apps/web/src/components/PaymentNameManager.tsx), [setup evidence](../deployments/ens-sepolia.json) | ENSv2 permissions govern who can change future routing |
| Read-only current resolution and revoked-editor status | [September 12 status](../deployments/ens-status-2026-09-12.json), [status script](../tools/ens-status.mts) | Chain reads and simulated permission checks; no new transaction |
| Changed destination rejected | [ENS boundary tests](../packages/ens/src/index.test.ts), [payout tests](../packages/payouts/src/index.test.ts) | Source-level rejection coverage; demonstrate the UI separately before calling it a browser result |

Say: "ENS is the receiving-key registry. Its scoped permissions let a recipient delegate a payment-record update without handing over the whole name."

Do not equate editor revocation with cancellation of funds. The pool does not enforce ENS; the reference app and high-level payout SDK do. Existing recovery and exits deliberately survive name expiry.

## Chainlink: confidential payroll becomes the reviewed encrypted batch

**Sponsor requirement:** a meaningful confidential handler processing sensitive input, integrated into the core app, with successful CRE CLI simulation or live deployment evidence. [Official Chainlink requirements](https://ethglobal.com/events/ethonline2026/prizes/chainlink).

**Product consequence:** the payroll compiler retrieves authenticated private input inside the confidential handler and returns the encrypted bundle used by the app. The browser compares it with the expected draft before enabling review.

| Show | Source or evidence | What this establishes |
| --- | --- | --- |
| Secret retrieval, authenticated fetch, compilation, public return | [Recorded simulation handler](../cre-starter/payroll/workflow.ts), [shared compiler](../services/cre-workflow/src/compiler.ts) | Sensitive processing is part of the handler; a local fixture supplies the demonstrated payroll API |
| Successful CLI completion | [September 12 simulation receipt](../deployments/cre-simulation-2026-09-12.json) | Successful local simulation, eight envelopes and authenticated fixture fetch |
| App draft through CLI and back into review | [Browser-to-CRE receipt](../deployments/cre-ens-browser-2026-09-11.json), [import checks](../apps/web/src/lib/cre.ts) | Recorded integration used a test-only session; no payment or Privy approval occurred |
| Mismatched import rejected, exact import accepted | [Import boundary test](../apps/web/src/lib/cre.test.ts) and actual app recording | Why the result matters to this draft; equality is not attestation |

Say: "This is the actual CRE CLI simulator running our confidential payroll handler. The app rejects a result from another batch and accepts the matching encrypted output."

Keep private exports, credentials and batch entropy off-screen. Show public output and fixed completion text. Remote TEE execution and attestation are not established. The low-level protocol can operate without CRE; this scene must show the application's CRE-enabled path.

## Privy: organization consent bound to the payout

**Sponsor requirement:** a Privy wallet, a functional B2B workflow, at least one Privy control, a working demo and source. Approval and wallet-administration workflows can qualify; Best financial flow separately requires a completed financial flow. [Official Privy requirements](https://ethglobal.com/events/ethonline2026/prizes/privy).

**Product consequence:** a dedicated organization wallet authorizes the exact intent. NULL validates the wallet controls and binds approval to the chain, pool and batch rather than treating login as permission to spend.

| Show | Source or evidence | Status |
| --- | --- | --- |
| Owner quorum and wallet-control validation | [Auth implementation](../packages/auth/src/server.ts), [control tests](../packages/auth/src/server.test.ts) | Implemented; current documented configuration is one owner, threshold one |
| Expiring, session-bound, single-use approval tickets | [Intent implementation](../services/organization/src/intents.ts), [ticket tests](../services/organization/src/intents.test.ts) | Tested, including concurrent consumption rejection |
| Actual owner approves the payout | [Approval and submission UI](../apps/web/src/components/LiveOperation.tsx) | Pending real owner action; identity-only signing is not this step |
| Matching distribution, recipient claim and withdrawal | [Current readiness](SUBMISSION_READINESS.md) | Pending for the Privy journey; the isolated-signer rehearsal is separate |

Say after execution: "The organization owner approved this exact payout through Privy; these are the resulting confirmed distribution and recipient transactions."

Before execution, describe the approval flow as implemented with a pending owner demonstration. Do not call one-owner/threshold-one control a multi-person approval. An HTTP 401 or configuration health probe does not prove a completed business workflow.

## Highest-priority remaining recording actions

1. Actual recipient restores or saves their encrypted backup and publishes their own payment profile under the owned inbox name. Verification fixture names are not payout recipients.
2. Organization completes setup and a small test-token payout through the existing Privy approval path. Record public transaction hashes and a redacted approval scene; keep raw authorization material private.
3. Recipient discovers, claims and withdraws from that distribution. Use confirmed receipts to connect the scenes, and explain the public exit.
4. Capture the ENS permission consequence and the CRE mismatch rejection. These short negative cases explain why the integrations matter.
5. Add the video link and observed timestamps to the submission. Complete the team contribution disclosure, publish final source, and check every submitted link.

Use the [3:15 recording plan](SUBMISSION_DEMO.md) and [submission wording](SUBMISSION_COPY.md). Give each sponsor a direct evidence link and the actual timestamp of its scene once the video exists. Do not invent timestamps or describe planned footage as recorded.

## Reproduce existing read-only and local checks

From the repository root after installing dependencies:

```sh
pnpm ens:status
pnpm test:submission
pnpm test:payouts
```

The status script sends no transactions. Tests use synthetic inputs and mocked external boundaries where documented; they do not complete a Privy payment. CRE simulation prerequisites and the existing wrapper are documented in the [CRE starter guide](../cre-starter/README.md).

Do not expand the critical demo path with a new pool deployment, a new sponsor integration, a new agent feature, or a changed quorum solely for submission. Those are optional future work; the current priority is demonstrated execution of the implemented product.
