# Submission copy and judge questions

Use only after checking [current readiness](SUBMISSION_READINESS.md). Replace pending evidence with actual receipt links; do not submit hypothetical transaction hashes or claim an unexecuted action.

## Short description

NULL turns one funded business payout into individually claimable private entitlements. ENSv2 supplies recipient-controlled payment inboxes, Chainlink CRE compiles encrypted delivery envelopes, and Privy binds organization approval to the exact encrypted batch. Recipients discover payments locally and use Noir proofs to claim against a global distribution accumulator. Payroll is the demonstration; the primitive also fits grants and contractor distributions.

## What is distinctive

The sender publishes one funded distribution with eight padded ciphertext slots. A later claim proves entitlement against the global distribution accumulator without identifying its source batch in public inputs. ENS separates a stable receiving name from payment-key rotation and gives editors narrowly scoped record permissions. Recipient recovery does not depend on retaining an ENS registration. Deposits and withdrawals remain public, and timing or network observations can reduce practical privacy.

## ENS — Best Use of ENSv2

Every recipient in NULL's live payment workflow needs a confirmed Sepolia ENS name resolving to a NULL public payment profile. Names provide the actual encryption destination, with hierarchical subname ownership, aliases, and one-name/one-key Permissioned Resolver delegation. NULL blocks missing or expired names and requires new review after owner, resolver, or profile changes. It rechecks names before compilation, organization approval and broadcast. Record rotation and editor revocation affect future payment routing while existing entitlements remain recoverable.

Evidence: [implementation](ENS_INTEGRATION.md), [confirmed transactions](../deployments/ens-sepolia.json), and the [ENS-to-CRE application run](../deployments/cre-ens-browser-2026-09-11.json). The requirement is enforced in the application; it is not an ENS assertion inside the immutable pool or circuit.

## Chainlink — Best Confidential Workflow

NULL's real `handlerInTee` retrieves a payroll API secret, fetches authenticated payroll, validates recipients and atomic amounts, and compiles the eight encrypted envelopes used by the payment flow. The September 11 application export ran successfully through the actual CRE CLI; stale output was rejected and the matching result unlocked review. Only public encrypted results leave the handler. This is local simulation, with no remote TEE execution or attestation claim.

Evidence: [workflow source](../services/cre-workflow/src/main.ts), [simulation receipt](../deployments/cre-simulation-2026-09-11.json), and [browser export receipt](../deployments/cre-ens-browser-2026-09-11.json).

## Privy — Best B2B financial product

NULL uses a dedicated Privy organization wallet and owner quorum. The service verifies organization membership and the wallet's exact controls, issues an expiring session-bound intent ticket, and requests raw digest signing only after owner authorization. The signature binds the chain, pool and encrypted batch; the browser verifies it before building its proof. The current configuration is one owner with threshold one.

**Evidence gap:** wallet/control verification and unsigned-request rejection passed, but the actual owner-approved financial payment remains pending. Do not replace this with login, identity-only signing, or the separate isolated-signer rehearsal. Add the completed owner-approved transaction before describing the payment as demonstrated.

## Questions to prepare for

- **Why is ENS necessary?** It is the application's required receiving registry: names resolve to encryption keys and support controlled rotation and delegated editing. A cosmetic address label would not determine who can discover an envelope.
- **Can the protocol be used without ENS?** Yes, a separate client can call the low-level SDK or immutable pool directly. The reference application's new-payment flow requires ENS. Claims and withdrawals deliberately do not depend on a name remaining live.
- **Does revoking an editor revoke payment?** No. It revokes that editing grant. It does not erase the profile, revoke broader administrator rights, or undo an existing entitlement.
- **Is the system fully anonymous?** No. ENS records, deposits and withdrawals are public; the sender knows its payroll, and network/timing information can correlate activity. The prototype is unaudited.
- **Is CRE running in a remote enclave?** No. The demonstrated confidential handler executes in the real CLI simulator. Production deployment and attestation are separate, unverified milestones.
- **What did the team build, and what did AI build?** Answer from the human-reviewed [provenance disclosure](BUILD_PROVENANCE.md), retaining the event's required specs/planning artifacts. Do not infer authorship from commit dates.
