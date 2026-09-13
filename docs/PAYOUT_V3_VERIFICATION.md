# Payout toolkit and partial-withdrawal verification

Updated September 13, 2026. The active reference deployment is fresh Sepolia v0.3. Local adversarial tests and the public-chain rehearsal below are separate evidence; neither constitutes an audit, a Privy owner-approved payment or an anonymity assessment.

## Real-proof local-chain rehearsal

`pnpm test:flow-v3` starts isolated Anvil with fresh test keys and an ERC-20 test token. It compiles/deploys genuine UltraHonk verifiers and `NullPoolV3`, verifies artifact/code hashes, and runs the browser-compatible client through a worker adapter. No production secrets or public-chain funds are required.

The successful run deposited 1 test USDC, allocated 0.6, claimed it, withdrew 0.25 through a separate gas-paying sponsor, recovered the 0.35 private remainder, withdrew that remainder through the relayer, and refunded the organization's remaining 0.4. Final token liabilities and pool balance were zero. See the [sanitized local receipt](../deployments/payment-flow-v3-local-2026-09-13.json); its transaction hashes belong to an ephemeral local chain and cannot be looked up on Sepolia.

Assertions passed for exact deposits/change/withdrawals; genuine claim discovery; original-key recovery of claimed notes; encrypted-backup recovery; amount and recipient substitution rejection by the deployed verifier; failed token transfer leaving the source spendable; independent sponsored gas; double-spend rejection; reconciliation without a returned hash; policy-controlled treasury refund; and conservation across the complete flow.

## Other exercised boundaries

- `pnpm test:partial-withdrawal`: actual Noir execution with correct change; negative ownership, altered amount/change, zero/oversized amount, and treasury-domain cases.
- `pnpm test:payouts`: genuine encryption with mocked ENS/network boundaries; stale or missing ENS, inconsistent compiler, stale CRE output, context mismatch, changed destinations after approval, large-job partitioning, uncertain-send reconciliation, and multi-note withdrawal planning/job progress.
- `pnpm example:payouts`: live Sepolia ENS reads plus local encryption. No money sent, proof generated, or owner signature requested.

The real-proof flow exercises one source note with a partial exit and later full exit. Multi-note withdrawal scheduling and multi-batch payout interruption have unit coverage; a full multi-note, multi-batch browser payment with Privy is not claimed.

## Reproduce

```sh
pnpm install --frozen-lockfile
node tools/build-circuits.mjs --kind=withdraw_partial --verifiers
pnpm test:partial-withdrawal
pnpm test:payouts
pnpm test:flow-v3
```

Use the repository's pinned Noir/Barretenberg and local Foundry/Anvil setup. The first four existing circuit artifacts must also be built; `pnpm circuits:build` prepares all five. Local proof generation is substantial CPU/memory work. Raw run output is written to `.artifacts/`; the committed receipt includes only public transaction/build metadata and checks.

## Fresh Sepolia deployment — September 13, 2026

The [release manifest](../deployments/11155111-partial-withdrawals-v3.json) records a fresh pool at `0x17A41574900ca3120562Ae5616559EceebA74E36`, registry, Poseidon hasher, two verifier libraries and five genuine verifiers. The deployment verified constructor bindings, exact runtime bytecode and immutable verifier hashes before synchronizing the web artifacts. The app has one active pool; no migration or earlier-pool switch was added.

The [public rehearsal receipt](../deployments/payment-flow-sepolia-v3.json) records these completed steps:

- Deposit 0.1 test USDC and privately allocate/claim 0.06.
- Withdraw exactly 0.025 USDC, creating exactly 0.035 in private change.
- Recover that change from saved encrypted checkpoints, reconcile the partial exit, and reject a duplicate submission.
- Withdraw the remaining 0.035, reconcile without a returned hash, and exclude spent notes from recovery.
- Refund the treasury's 0.04 with its required signature; verify all 0.1 USDC returned, zero pool token balance, successful receipts, and encrypted-journal recovery.

The initial rehearsal-only gas cap stopped the refund before signing. All seven existing transactions were reconciled successfully. Only the refund was resumed with a 0.04-ETH rehearsal cap, within the unchanged combined 0.085-ETH deployment/rehearsal ceiling. Final rehearsal gas cost: `36042722236796306` wei. This uses an isolated test signer, not Privy owner approval.

The [new Graph endpoint](https://api.studio.thegraph.com/query/1758859/null-protocol/v0.3.0) indexes the fresh address and its partial-withdrawal change event without indexing errors. Root configuration, local relayer manifest, CRE staging pool, browser manifest and Netlify pool configuration target this release.

## Application verification and limits

Workspace typechecks, production builds, 79 submission tests, 13 payout/withdrawal job tests, and 8 focused amount/circuit/job tests passed. The complete local real-proof rehearsal was rerun successfully. The amount UI was inspected at 1280px and 390px with the real production component in a synthetic fixture: explicit amount, exact remainder, full-balance shortcut, invalid-value blocking and balance masking. A fresh review found one hidden-balance disclosure in error text; the correction was recaptured and scored resolved.

Static hosting verification checks the exact release manifest, all five circuit SHA-256 hashes and the application entry. Production API verification requires an unauthenticated request to return 401. Netlify preview contexts intentionally lack production-only Privy settings; preview API 503 is not claimed as a working authenticated preview.

The real-proof flow exercises one source note with a partial exit and later full exit. Multi-note scheduling has unit and synthetic-browser coverage; a complete multi-note Privy browser payment is not claimed. Preserve the updated encrypted funds backup: identity keys alone cannot reconstruct fresh private-change openings. Public withdrawal amounts, destination addresses, timing and funding relationships remain observable.

## Published web release

The [production release record](../deployments/web-release-v3-2026-09-13.json) records Netlify deploy `6aa6842031cf6b29611956ad`. The live site served the exact v0.3 manifest and all five matching artifacts; its organization API returned `401 NULL_SESSION_REQUIRED` without authentication. The browser loaded the existing authenticated account into ENS-link setup and displayed its organization approval wallet without console errors. No organization preference, ENS record or Privy-approved payment was changed by browser verification.
