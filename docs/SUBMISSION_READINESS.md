# ETHOnline 2026 submission readiness

Updated September 8, 2026. ENS, browser/CRE integration, build and deployment responses were checked today; the earlier proof and sponsor checks below remain separately identified. No commit was made by this integration work. This is a testnet prototype, not an audited production payment system.

## Current decision

Recommended three prize applications: **ENSv2, Privy and Chainlink**. The Graph remains the real discovery integration; using it does not require selecting its prize. **Do not yet claim a completed Privy-approved financial flow.** The ENS integration is live on Sepolia, while its latest UI source needs deployment. The complete Sepolia payment and withdrawal rehearsal passed with an isolated signer. Actual Privy-owner payment approval remains outstanding. CRE production-access approval is not required for the selected simulation-based category.

The hosted site now serves the light design and the organization Function route. The Function returns **503 `NULL_ORGANIZATION_CONFIG_REQUIRED`**: it needs its server configuration. The local Netlify CLI is not logged in. A working function route is not evidence of working Privy approvals.

### Latest frontend and live checks — 2026-09-08

- Simplified sign-in, inbox, ENS setup, payment preparation, balances and settings. The inbox uses one receive panel, one backup row and explicit scan status; advanced details stay collapsed. A linked ENS name can be copied directly after a fresh lookup. Public-deposit, public-name, backup and public-withdrawal notices remain at the relevant actions.
- Removed the sample activity from the testnet workspace and the Help instructions for an unavailable practice-mode switch. New deposits start with an empty amount.
- Inbox scans ignore and erase stale results after identity changes or unmounting, and prevent overlapping scans.
- Browser checks covered eleven screens/states at desktop 1440px and mobile 390px, with no page errors or horizontal overflow. Live ENS resolution, publication consent, encrypted preparation, the CRE review gate and Graph-backed inbox scanning passed. These checks use an explicit test-only session provider; they do not sign in as or approve for the Privy owner.
- The new v0.2 pool completed the funded deposit → distribution → discovery → claim → withdrawal → treasury refund flow on Sepolia with real proofs. All 0.1 test USDC returned; the pool ended at zero. See [public receipts](../deployments/payment-flow-sepolia-v2.json).
- ENS check at 06:07 UTC: primary and alias resolve; editor access is revoked; the Privy wallet owns `inbox.nullpay2026.eth` and passes the scoped write simulation. Its recipient Payment ID remains unpublished.

See [Netlify deployment requirements](NETLIFY_SUBMISSION.md). Committing and deploying the frontend does not supply missing Function secrets. No Git commit or Netlify deployment was made. The subsequent explicitly authorized v0.2 contract deployment and rehearsal are recorded below; no additional ENS transaction was sent.

## Withdrawal release — verified

See [withdrawal verification](WITHDRAWAL_VERIFICATION.md), the [new deployment](../deployments/11155111-withdrawals-v2.json) and [confirmed full-flow receipts](../deployments/payment-flow-sepolia-v2.json). Recipient funds can be recovered from either the original Payment ID keys or a saved funds checkpoint. Both routes exclude withdrawn notes. A fresh CRE CLI simulation passed against the new pool after one transient organization-authentication error. Remote TEE deployment and real Privy-owner financial approval remain separate boundaries.

## Evidence

| Component | Verified | Boundary |
| --- | --- | --- |
| UI | Shared light Soft Outline/neumorphic design, supplied logo, subtle motion; eleven desktop/mobile screen and state checks pass | Test harness uses simulated sessions |
| ENSv2 | Real namespace, subregistry, Permissioned Resolver, record publishing/rotation, aliases, scoped grants and revocation; 19 confirmed ENS setup/permission transactions including Privy subname assignment | Sepolia beta; verification profile is separate from the user's unpublished profile |
| ENS + Privy | Existing embedded wallet owns `inbox.nullpay2026.eth`, holds one-name/one-key record permission, and passes a write simulation | User must consent and sign to publish their Payment ID; this is not a completed financial transfer |
| ENS + CRE | Live browser ENS resolution → exact recipient confirmation → encryption → actual CRE CLI → reject stale result → review | Test-only session provider; live ENS RPC and real CRE simulator; no payment broadcast |
| CRE product flow | Browser draft export → real CRE CLI simulation → stale-output rejection → exact-output import → review unlocked | Local simulation, no remote TEE execution or attestation |
| Proofs and full flow | Four genuine proof circuits; complete funded Sepolia flow including recipient withdrawal and approved treasury refund; all 0.1 test USDC returned | Isolated signer, not Privy owner approval; public entry and exit remain observable |
| Proof worker | Shield proof through the production worker API's Node adapter accepted by deployed verifier | Supports prepared rehearsal; not a browser-wallet transaction |
| Privy controls | Dedicated organization wallet and one-owner quorum verified live; unsigned raw-sign request rejected HTTP 401 | Signed owner approval still required |
| Privy hosting | Function route now responds with JSON; prior bundling, shared approval storage, concurrency, expiry and HTTP routing checks passed | Live endpoint returns configuration-required 503; needs site access and server configuration |
| TypeScript/web | Workspace typechecks, production web build, 27 submission tests, six withdrawal tests and complete local proof flow | No security-audit claim |
| Graph event subgraph | Live Studio v0.2.0 indexes the new pool without indexing errors | Client verifies accumulator roots and checks spent notes on chain |
| Substreams | WASM/package build and two Rust tests pass; common NULL/ERC-5564 model and deterministic EntityChanges | Provider request returned Unauthenticated; Studio rejects SPS deployments as unsupported |

Public context: Ethereum Sepolia (11155111), pool `0x734da58C285D211e7C0ad904f522c221c982447E`; [event subgraph](https://api.studio.thegraph.com/query/1758859/null-protocol/v0.2.0), [hosted app](https://null-protocol.netlify.app/). The latest ENS frontend source has not been deployed by this work.

## Reproduce

```sh
pnpm check
pnpm test:submission
pnpm build
pnpm proofs:check
pnpm cre:simulate
pnpm rehearsal:plan
pnpm ens:status
```

The proof check uses synthetic witnesses and calls deployed verifiers read-only. The rehearsal plan broadcasts nothing. The separate `tools/rehearse-withdrawal-sepolia.mts` completed the authorized 0.1 test USDC round trip. Deployment plus rehearsal cost 0.060963962483533119 test ETH, below the explicitly reallocated 0.065 combined cap. It seals recovery material locally and saves signed transactions before broadcast. Never blindly rerun after uncertainty; preserve the existing journal.

For the integrated CRE demo, create a testnet payment, keep the CRE checkbox enabled, export its private input, run `pnpm cre:simulate --input "PATH_TO_PRIVATE_INPUT.json"`, and import payment-result.json from the printed directory. Keep inputs private. Only sanitized logs/receipts and public encrypted results belong in evidence. Exact-output matching checks integrity against the local draft; it does not cryptographically authenticate file provenance.

## Chainlink — Best Confidential Workflow

[Official requirements](https://ethglobal.com/events/ethonline2026/prizes/chainlink) accept successful CLI simulation or live deployment. NULL uses handlerInTee and its real shared payroll compiler; output now participates in the actual review path. Record the flow and CLI completion log. State that confidential deployment remains pending. The separate Continuity upgrade prize has different requirements; its mandatory onchain change is not a prerequisite of this category.

## ENS — Best Use of ENSv2

[Official requirements](https://ethglobal.com/events/ethonline2026/prizes/ens) require a functional Sepolia ENSv2 integration that is central to the product. NULL uses the hierarchical registry and `authorizeTextRoles` to let a Privy wallet manage only its public payment profile, plus alias-aware Universal Resolver reads. Names drive the actual encrypted-payment preparation path. The integration blocks changed destinations and checks again before approval/submission. This goes beyond displaying a name beside an address.

See [ENS implementation and demo instructions](ENS_INTEGRATION.md) and [confirmed transaction evidence](../deployments/ens-sepolia.json). Demonstrate a recipient linking their own saved profile, an organization paying by name, and record access/revocation. Do not claim that the isolated ENS verification allocation was a funded onchain payment.

## Privy — Best B2B financial product

[Official requirements](https://ethglobal.com/events/ethonline2026/prizes/privy) require a Privy wallet, functional business workflow and real control. Dedicated wallet `0x6567226D425c423b1A5765384Ae343aE5FDeB1d1` uses the owner's quorum rather than an unsupported raw-sign policy rule. Exact wallet, entity, quorum membership/threshold and absence of bypass signers are rechecked. Existing policy-based configurations remain strict.

Follow [Netlify setup](NETLIFY_SUBMISSION.md). Sign in as the actual owner, use the identity-only approval to obtain its public key, back up and register the local policy opening, then complete a real payment approval. Do not describe an isolated rehearsal signer as Privy. Best Financial Flow also requires a completed generally available Privy financial action.

## The Graph — Composable or Standardized products

Retained as an integration. This prize is not one of the recommended three while ENS, Privy and Chainlink are selected. The additional work below matters only if choosing to replace a selected prize with The Graph.

[Official requirements](https://ethglobal.com/events/ethonline2026/prizes/the-graph) require meaningful composition/standardization and live provider data. A single custom event subgraph is insufficient by itself. The reusable module/shared NULL/ERC-5564 model exists, but live execution and consumption need evidence.

Graph Studio rejected SPS deployment because that hosting path is no longer supported. The event subgraph remains intact. The documented Sepolia Substreams endpoint returned Unauthenticated. Follow [standalone instructions](../substreams/private-payments/README.md), privately configure a provider credential, and demonstrate a bounded live run plus reusable consumer. Never reuse the Studio deploy key as a Substreams token or present packaging as live composition.

## Final delivery

1. Deploy the ENS frontend; finish the organization Function's server settings and verify the authenticated API.
2. Sign in to the existing Privy recipient wallet, restore/save its NULL backup, and publish the Payment ID under `inbox.nullpay2026.eth` with the app's explicit consent.
3. Complete actual owner-approved payment/recovery and retain transaction hashes plus live Graph discovery evidence.
4. Record ENS scoped access and the integrated CRE simulation. Use the [demo script](SUBMISSION_DEMO.md), public source and a two-to-four-minute video. Disclose pre-existing work and event-period changes for the appropriate ETHGlobal pool.

Ignored local evidence includes .artifacts/proof-validation.log, .artifacts/cre-ui-simulation.log, .artifacts/cre-before-desktop.png, .artifacts/cre-verified-desktop.png, entry screenshots and cre-starter/.artifacts/payment-*/simulation-receipt.json. These are not automatically public submission artifacts. Do not upload private payroll inputs, backups, .env or credential files.

