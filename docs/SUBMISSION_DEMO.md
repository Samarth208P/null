# NULL — human-narrated demo plan

Use the [sponsor evidence walkthrough](SPONSOR_EVIDENCE.md) to prepare each scene. Lead with the reference app's v0.2 payout journey; briefly show the published `@samarth208p/null-payouts@preview` package to establish that applications can embed it. The internal workspace name is `@null-protocol/payouts`. Enter ENS names and amounts, show resolved destinations, then show actual approved payout receipts and local recipient discovery. Explain who pays gas. The public developer preparation example creates real ciphertext but sends no payment. Keep [v0.3 local proof evidence](PAYOUT_V3_VERIFICATION.md) for an optional clearly labeled appendix or Q&A; the main video should follow one payment on the public v0.2 pool. Larger jobs have separate confirmations and partial progress, and withdrawals expose their amount/address/timing.

Aim for 3:15, using actual results. Record a 2–4 minute video at 720p or higher with your own spoken narration; do not use AI narration or speed up footage. Confirm the deadline and final upload constraints in the [official event requirements](https://ethglobal.com/events/ethonline2026/info/details). Keep private exports, backup contents, passwords and credentials off-screen.

## 0:00–0:25 — The primitive

“Public business payouts expose the payment graph. NULL turns one funded batch into individually claimable private entitlements. Payroll is our demonstration: ENS provides the receiving inbox, Chainlink compiles the encrypted batch, and Privy controls organization approval.”

Show the real app. State Sepolia test tokens, public deposits and withdrawals, and an unaudited prototype.

## 0:25–1:05 — ENS is required

Show the recipient's saved backup and linked `inbox.nullpay2026.eth` only after the owner has actually published it. Show a new payment refusing a raw Payment ID, then resolve and confirm the recipient's name.

“Every recipient needs an ENSv2 payment inbox. The resolver maps a public name to public payment keys, so the sender can encrypt an entitlement. A delegated wallet can update one text record on one name. A changed owner, resolver, or profile stops the payment for review.”

Show one scoped permission and its confirmed revocation evidence. Pair it with the read-only verification that the former editor cannot update the payment record; the recorded setup also exercised rejection of unrelated record changes. Label historical transactions and eth_call preflight accurately. Explain that revoking editor access stops that editor changing future routing; it does not erase the profile or revoke already-issued funds. Names and linked profiles are public. Do not fund the `receive`/`pay` verification profiles as a substitute for the recipient's account.

## 1:05–1:45 — CRE contributes to this payment

Leave the CRE check enabled. Export the draft privately, show the actual CLI completion, import a mismatched result to demonstrate rejection, then import the matching public result and show review unlocking.

“The confidential handler fetches authenticated payroll and compiles eight encrypted envelopes. This is successful CRE CLI local simulation; we have not deployed or attested a remote enclave.”

Use the exact application export, not just a disconnected hello-world workflow. Prepare prerequisites before recording so the video can show real completed states without sped-up proof generation.

## 1:45–2:30 — Real Privy control

This scene remains blocked until the owner completes it. Show the dedicated organization wallet, exact-intent approval, and confirmed distribution transaction.

“Privy enforces a one-owner, threshold-one quorum. The wallet authorizes this exact chain, pool, and encrypted batch. NULL rechecks ENS destinations before approval and submission.”

Do not call it multi-signer or present the isolated rehearsal signer as Privy. An identity-only challenge is setup, not payment execution. If the actual financial action is still unavailable, say so explicitly and do not claim a complete Privy payment demo.

## 2:30–3:00 — Discover, claim, withdraw

Show live indexed discovery, the recipient's claim, and the confirmed withdrawal with explorer links. Save **Download transaction receipts** from each confirmation dialog before closing; the payout now stays on its confirmation screen until Done. The export excludes private note and recovery data and labels approval/compilation sources as app-observed, not independently attested. Explain that claims prove membership against the global accumulator without naming the source batch, while withdrawals publicly reveal the destination and amount. Existing funds remain accessible with recovery keys even if the ENS name expires.

## 3:00–3:15 — Evidence and close

Show the source repository, canonical deployment manifest, CRE receipt, and actual Privy-approved transaction. Close with: “One funded batch, private entitlements, and recipient-controlled recovery.” Keep testnet, public entry/exit, local simulation and audit boundaries visible.

## Before upload

- Confirm the video is 2–4 minutes with human narration, at least 720p, and no sped-up footage.
- Use the same actual recipient and payment across sponsor scenes wherever possible.
- Verify the hosted app includes the ENS flow and the organization API.
- Link sponsor claims to source and receipts; include the human-reviewed [build provenance disclosure](BUILD_PROVENANCE.md).
- Ensure new source changes are public. A CLI deploy alone does not push Git.
- Target ENSv2, Privy B2B, and Chainlink Confidential Workflow. Do not represent prize eligibility, finalist selection, or winnings as guaranteed.
