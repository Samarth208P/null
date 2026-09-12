# ETHOnline 2026 submission readiness

Updated September 12, 2026. This is an unaudited Sepolia prototype. Successful source checks, local simulation, historical transaction receipts, and real owner actions are recorded separately. Start with the [sponsor evidence walkthrough](SPONSOR_EVIDENCE.md) for the focused submission sequence.

## Embeddable toolkit update

The working implementation now includes an ENS-first source SDK and own-UI example, larger sequential payout jobs, a public developer preparation page, ENS during account setup, wallet/sponsor transport choice, and a new v0.3 partial-withdrawal circuit/pool/client. The [local genuine-proof rehearsal](PAYOUT_V3_VERIFICATION.md) completed with exact change recovery, sponsored gas, adversarial cases and zero remaining liabilities. SDK interruption/planning tests passed. This local evidence does not upgrade Sepolia or complete the Privy financial demo.

The npm developer preview is published as `@samarth208p/null-payouts@0.1.0-preview.2`; internal workspace packages retain their `@null-protocol/*` names. Use the existing v0.2 deployment for the main sponsor demonstration and complete its owner-approved payment. Public chosen-amount withdrawals would additionally require deploying/verifying v0.3 and its artifacts, updating the dependent services, and a fresh public rehearsal. That upgrade is not a prerequisite for presenting the demonstrated v0.2 scope. Jobs are non-atomic with no automatic resume after reload. High proof gas, operational sponsorship limits and correlation risks remain material weaknesses.

## September 12 review

The later implementation pass completed the signing surface: visible organization setup, backup-before-activation, existing-transaction activation checks, two-record ENS permission inspection/downloads, guarded CRE imports and confirmed public receipt exports. The payout dialog stays open after confirmation so receipts can be saved. Follow [the prepared owner rehearsal](OWNER_REHEARSAL.md); its financial actions remain pending until confirmed.

Validation passed 34 submission tests, 13 payout/job tests, workspace typechecks, production build and 17 assertions in the [genuine-proof local v0.2 rehearsal](../deployments/sponsor-local-rehearsal-2026-09-12.json). That rehearsal included exact activation reconciliation, a public receipt from the real local transaction, deposit, distribution, discovery, claim, withdrawal, treasury refund and zero remaining liabilities. It used an isolated signer on chain 31337, not Privy or Sepolia funds. The [fresh CRE simulation](../deployments/cre-simulation-2026-09-12.json) passed, and live Privy wallet controls again rejected an unsigned challenge with HTTP 401. Local web/API/relayer health probes passed. Interactive browser QA remains unavailable; the mechanical UI detector reported no findings. These checks preceded the hosted release below and did not record human narration.

Workspace typechecks, the production build and 51 selected tests passed, including real Noir withdrawal-circuit execution. The npm registry returned `0.1.0-preview.1`, and remote Git HEAD matched checkout `5c866f7` before these documentation edits. The public app returned HTTP 200 and its manifest reported v0.2.0 with no partial-withdrawal verifier. These checks did not execute a new Privy payment, CRE simulation or public-chain proof flow. Interactive browser control was unavailable; saved UI captures are historical evidence.

A subsequent [read-only ENS status run](../deployments/ens-status-2026-09-12.json) at 10:58 UTC verified live primary/alias resolution, revoked test-editor access, the Privy wallet's inbox ownership and one-record permission, and a successful write preflight. The new permission comparison confirmed that wallet has payment-record permission and no website-record permission. The recipient payment profile was still unpublished. No transaction was sent.

## Current decision

Target **ENS — Best Use of ENSv2**, **Privy — Best B2B financial product**, and **Chainlink — Best Confidential Workflow**. These are submission targets, not a claim of qualification or predicted wins. The Graph remains the discovery integration.

The critical ENS bypass is fixed in the live application: each new distribution recipient needs a confirmed Sepolia name and supported ENSv2 Permissioned Resolver. Raw IDs, empty name lists, incomplete name coverage, missing profiles, expired names, and changed owner/resolver/profile states block progression. Rechecks run before preparation, Privy approval, imported approval, and submission. The compiler uses the profiles from the confirmed names.

ENS is an application requirement, not an onchain constraint. The immutable pool and cryptographic SDK remain identity-agnostic. Recovery, claims, and withdrawal do not require an active ENS name. Names are public and their association with public profile keys is public; no name-to-batch roster is sent to the chain or Privy approval API.

## September 11 evidence

| Check | Result | Boundary |
| --- | --- | --- |
| Workspace TypeScript | All 15 workspaces passed | Static checks |
| Submission tests | 29 passed, including mandatory ENS coverage and destination-change rejection | Unit/service tests, not an audit |
| Withdrawal and domains | Six withdrawal tests and one domain-parity test passed | No new funded transaction |
| Production web build and hosting | Passed; production release verified at 08:59 UTC | Exact ENS asset hashes and all four circuit checksums match; API returns JSON 401 |
| ENS live status | Names resolve; editor revoked; Privy wallet owns its inbox name and can simulate a scoped record write | Recipient profile remains unpublished; no ENS transaction sent in this run |
| Privy live controls | Configured wallet/quorum verified; unsigned raw-sign request rejected HTTP 401 | No actual owner-approved financial action |
| CRE CLI | Failed credential refresh HTTP 500, then passed after user browser login | [Fresh synthetic receipt](../deployments/cre-simulation-2026-09-11.json); local simulation only |
| ENS → browser → CRE → review | Actual name resolution, encrypted draft export, CRE CLI, stale-result rejection, exact-result import and review passed | [Browser-run receipt](../deployments/cre-ens-browser-2026-09-11.json); test-only session provider, no Privy signature or payment |
| Desktop/mobile UI | 1440px and 390px: required inbox setup, publication consent, raw-ID rejection, unconfirmed-name rejection and discovery availability passed; no page errors/overflow | Local test harness; no claim of live owner login |

The CLI log's embedded display timestamp differs from the host UTC timestamp; receipt `startedAt`/`finishedAt` fields record host UTC. Do not treat the simulator log prefix as an independent trusted clock.

Historical full-flow evidence remains in [payment-flow-sepolia-v2.json](../deployments/payment-flow-sepolia-v2.json): genuine proofs, deposit → distribution → discovery → claim → withdrawal → treasury refund, with 0.1 test USDC returned. This was an isolated signer rehearsal. It does not establish a Privy-approved payment.

## Hosted release

Production deployment `6aa53de521c37e0008ad8eae` passed verification at **2026-09-12 11:59 UTC**. Netlify built pushed commit `22ad5bd1356f0dcc90e5100855a49e91218506a8` through its Git integration. The [release evidence](../deployments/submission-release-2026-09-12.json) records the new receipt/activation/ENS assets, all four circuit checksums, the unchanged canonical v0.2 pool manifest, JSON `401 NULL_SESSION_REQUIRED`, configured function health and rejected foreign origins. Hosted submission uses the connected wallet; a local relayer URL is ignored in production.

The [September 11 release record](../deployments/submission-release-2026-09-11.json) remains historical evidence. Successful deployment is separate from interactive browser QA, owner signatures and a completed financial payment.

## Remaining submission gates

1. Sign in as the actual Privy recipient. Restore or save its encrypted NULL backup, explicitly consent, and publish its Payment ID under `inbox.nullpay2026.eth`. That wallet owns the name; its profile is not published yet.
2. In the organization workspace, use **Use Privy organization** to obtain the signer public key via an identity-only approval. Back up the policy opening, register it, then fund and complete an actual owner-approved payment to the recipient's confirmed ENS name. Record the distribution, claim and withdrawal hashes. The identity signature alone is not a financial action.
3. Record the final human-narrated demo and add its link. No final video has been verified. Follow [the demo plan](SUBMISSION_DEMO.md).
4. Review [AI and build provenance](BUILD_PROVENANCE.md), confirm event-period contributions/track, and publish the exact source demonstrated.

The organization service health response is a configuration probe. It now reports `approvalExecution: "not-tracked"` instead of the misleading fixed `approvalExecuted: false`. Use the actual owner signature and confirmed matching transaction as evidence. Do not infer historical approval completion or absence solely from `/health`.

## Reproduce

```sh
pnpm check
pnpm test:submission
pnpm test:withdrawal
pnpm test:domains
pnpm build
pnpm ens:status
pnpm cre:simulate
```

For the integrated CRE demonstration, leave the CRE check enabled, export a private draft, run `pnpm cre:simulate --input "PATH_TO_PRIVATE_INPUT.json"`, and import the exact result into that draft. Never publish the private export, batch entropy, recovery files or credentials. Result equality is not remote provenance or attestation.

Official requirements checked September 11: [ENSv2](https://ethglobal.com/events/ethonline2026/prizes/ens) requires a central functional ENSv2 integration; [Privy](https://ethglobal.com/events/ethonline2026/prizes/privy) requires a functional business workflow with a real Privy control; [Chainlink](https://ethglobal.com/events/ethonline2026/prizes/chainlink) accepts successful confidential-workflow CLI simulation. See [event rules](https://ethglobal.com/events/ethonline2026/info/details). No probability of winning is asserted.
