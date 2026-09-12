# Payout toolkit and partial-withdrawal verification

Recorded September 11, 2026. This is local implementation evidence, not a public deployment, audit, Privy financial demonstration or production anonymity assessment.

## Real-proof local-chain rehearsal

`pnpm test:flow-v3` starts isolated Anvil with fresh test keys and an ERC-20 test token. It compiles/deploys genuine UltraHonk verifiers and `NullPoolV3`, verifies artifact/code hashes, and runs the browser-compatible client through a worker adapter. No production secrets or public-chain funds are required.

The successful run deposited 1 test USDC, allocated 0.6, claimed it, withdrew 0.25 through a separate gas-paying sponsor, recovered the 0.35 private remainder, withdrew that remainder through the relayer, and refunded the organization's remaining 0.4. Final token liabilities and pool balance were zero. See the [sanitized local receipt](../deployments/payment-flow-v3-local-2026-09-11.json); its transaction hashes belong to an ephemeral local chain and cannot be looked up on Sepolia.

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

## Public release boundary

Final source verification passed workspace typechecks, production web build, 13 payout/withdrawal job tests and 29 submission boundary tests. The developer page resolved the live ENS fixture and produced ciphertext in the browser; raw wallet input was rejected. Desktop 1280px and mobile 390px checks showed no horizontal page overflow. A separate synthetic-session UI harness verified the new required ENS setup field and nine recipient rows; it did not authenticate with Privy or send money. Review captures are in `.impeccable/review/`. The two material design-review findings were corrected and passed their follow-up review.

The canonical web manifest still describes v0.2 Sepolia, with four circuit artifacts and full-note exits. Supporting v0.3 publicly requires a new immutable pool and fifth verifier, validated artifact hosting, updated pool/manifest/indexer/relayer configuration, and a fresh public-chain rehearsal. Existing deployment scripts still target v0.2 and must not be described as a v0.3 deploy command. Funds in v0.2 must exit through that pool; there is no hidden migration.

The SDK is now available as the npm developer preview `@samarth208p/null-payouts@0.1.0-preview.1`; internal workspace packages retain their original names. Publishing the SDK did not deploy v0.3. The reference UI's v0.3 balance field is capability-gated and cannot activate partial exits on the old pool. A gas sponsor pays public transaction costs; it does not make deposits/withdrawals anonymous or imply free operation for the sponsoring business.
