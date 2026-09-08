# ETHOnline 2026 submission readiness

Verified September 7, 2026. No commit was made. This is a testnet prototype, not an audited production payment system.

## Current decision

The code and reproducible checks are substantially improved. **Do not yet claim a completed live flow across all three sponsors.** Remaining requirements are the Netlify deployment, actual Privy-owner approval, the bounded Sepolia payment rehearsal, and a live standalone Substreams run/consumer. CRE production-access approval is not required for the selected simulation-based demo.

## Evidence

| Component | Verified | Boundary |
| --- | --- | --- |
| UI | Shared light Soft Outline/neumorphic design, supplied logo, subtle motion; eight desktop/mobile entry checks pass | Test harness uses simulated sessions |
| CRE product flow | Browser draft export → real CRE CLI simulation → stale-output rejection → exact-output import → review unlocked | Local simulation, no remote TEE execution or attestation |
| Proofs | Real shield, distribution and claim proofs generated and accepted by deployed Sepolia verifiers using eth_call | Read-only verifier calls, not completed pool transactions |
| Proof worker | Shield proof through the production worker API's Node adapter accepted by deployed verifier | Supports prepared rehearsal; not a browser-wallet transaction |
| Privy controls | Dedicated organization wallet and one-owner quorum verified live; unsigned raw-sign request rejected HTTP 401 | Signed owner approval still required |
| Privy hosting | Netlify Function bundles; shared approval storage, concurrency, expiry and HTTP routing tested | Needs site login, environment configuration and live deployment |
| TypeScript/web | Workspace typechecks and production web build pass; 16 submission tests pass | No security-audit claim |
| Graph event subgraph | Live Studio v0.1.0 responds without indexing errors | Earlier note/distribution collections empty; no new payment broadcast in this review |
| Substreams | WASM/package build and two Rust tests pass; common NULL/ERC-5564 model and deterministic EntityChanges | Provider request returned Unauthenticated; Studio rejects SPS deployments as unsupported |

Public context: Ethereum Sepolia (11155111), pool `0x5d67Ff96D115127645437C0E3a71c61d37465E71`; [event subgraph](https://api.studio.thegraph.com/query/1758859/null-protocol/v0.1.0), [hosted app](https://null-protocol.netlify.app/). The hosted frontend still needs the current source deployed.

## Reproduce

```sh
pnpm check
pnpm test:submission
pnpm build
pnpm proofs:check
pnpm cre:simulate
pnpm rehearsal:plan
```

The proof check uses synthetic witnesses and calls deployed verifiers read-only. The rehearsal plan broadcasts nothing. The separate `tools/rehearse-sepolia.mts --broadcast` path needs approval for 0.1 test USDC (no withdrawal path) and at most 0.015 test ETH reserved for gas. It seals recovery material locally and saves signed transaction hashes before broadcast. Never blindly rerun after uncertainty.

For the integrated CRE demo, create a testnet payment, keep the CRE checkbox enabled, export its private input, run `pnpm cre:simulate --input "PATH_TO_PRIVATE_INPUT.json"`, and import payment-result.json from the printed directory. Keep inputs private. Only sanitized logs/receipts and public encrypted results belong in evidence. Exact-output matching checks integrity against the local draft; it does not cryptographically authenticate file provenance.

## Chainlink — Best Confidential Workflow

[Official requirements](https://ethglobal.com/events/ethonline2026/prizes/chainlink) accept successful CLI simulation or live deployment. NULL uses handlerInTee and its real shared payroll compiler; output now participates in the actual review path. Record the flow and CLI completion log. State that confidential deployment remains pending. The separate Continuity upgrade prize has different requirements; its mandatory onchain change is not a prerequisite of this category.

## Privy — Best B2B financial product

[Official requirements](https://ethglobal.com/events/ethonline2026/prizes/privy) require a Privy wallet, functional business workflow and real control. Dedicated wallet `0x6567226D425c423b1A5765384Ae343aE5FDeB1d1` uses the owner's quorum rather than an unsupported raw-sign policy rule. Exact wallet, entity, quorum membership/threshold and absence of bypass signers are rechecked. Existing policy-based configurations remain strict.

Follow [Netlify setup](NETLIFY_SUBMISSION.md). Sign in as the actual owner, use the identity-only approval to obtain its public key, back up and register the local policy opening, then complete a real payment approval. Do not describe an isolated rehearsal signer as Privy. Best Financial Flow also requires a completed generally available Privy financial action.

## The Graph — Composable or Standardized products

[Official requirements](https://ethglobal.com/events/ethonline2026/prizes/the-graph) require meaningful composition/standardization and live provider data. A single custom event subgraph is insufficient by itself. The reusable module/shared NULL/ERC-5564 model exists, but live execution and consumption need evidence.

Graph Studio rejected SPS deployment because that hosting path is no longer supported. The event subgraph remains intact. The documented Sepolia Substreams endpoint returned Unauthenticated. Follow [standalone instructions](../substreams/private-payments/README.md), privately configure a provider credential, and demonstrate a bounded live run plus reusable consumer. Never reuse the Studio deploy key as a Substreams token or present packaging as live composition.

## Final delivery

1. Deploy the current frontend and organization Function; verify real sign-in and authenticated API.
2. Complete actual owner-approved payment/recovery and retain transaction hashes plus live Graph discovery evidence.
3. Record integrated CRE simulation and the live reusable Graph pipeline.
4. Use the [demo script](SUBMISSION_DEMO.md), public source and a two-to-four-minute video. Disclose pre-existing work and event-period changes for the appropriate ETHGlobal pool.

Ignored local evidence includes .artifacts/proof-validation.log, .artifacts/cre-ui-simulation.log, .artifacts/cre-before-desktop.png, .artifacts/cre-verified-desktop.png, entry screenshots and cre-starter/.artifacts/payment-*/simulation-receipt.json. These are not automatically public submission artifacts. Do not upload private payroll inputs, backups, .env or credential files.

