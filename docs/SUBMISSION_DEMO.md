# NULL — three-minute demo shooting script

Prepared September 13, 2026. Target runtime: **3:00**, including transitions. Read only the blockquotes aloud. Use a relaxed, conversational voice, like you are showing the app to a friend. Pause when a result appears. Rehearse with a timer; the timestamps are editing targets, not measured speech duration.

**Recording prerequisite:** repository evidence still marks the actual Privy-owner-approved Sepolia payout as pending. Complete [the owner rehearsal](OWNER_REHEARSAL.md) before using the successful-payment narration below. Historical isolated-signer receipts cannot stand in for that approval. This script is prepared footage direction, not evidence that recording or execution has occurred.

## Open these tabs before recording

Record each section separately, then cut waiting to fit its time window. Use one test recipient and one payout throughout. Keep passwords, encrypted backup contents, private payroll exports and raw signatures off-screen.

| Tab / link | What to point at |
| --- | --- |
| [NULL app](https://null-protocol.netlify.app/#/demo), or [local app](http://127.0.0.1:5173/#/demo) after `pnpm dev:all` | Recipient Inbox; organization New payment; recipient Balance. Navigate using the app so account state is preserved. |
| [ENS explorer](https://explorer.ens.dev/) | Search **demo.nullpay2026.eth** on Sepolia. Its receiving profile is published. Show `null.paymentProfile`; use the app's permission comparison for payment-record versus website-record access. |
| [Actual recipient name link](https://sepolia.etherscan.io/tx/0xf8c584f2c49fd741fc51fa2359e08b845bd42085d2fabb3dd05f3b73ae3d4801) | Show **Success** and the resolver's `TextChanged` event for `null.paymentProfile`. MetaMask wrapped this call, so the outer destination is its DelegationManager. |
| [Actual organization activation](https://sepolia.etherscan.io/tx/0xdddb70bd6d5fc53f614a95a0b3d095d2cefaacef56c8d443dc1e4b2c76ee2ff0) | Show **Success** and the registry's `PolicyRegistered` event. This activates the organization setup; it is separate from payout approval. |
| [Actual 10 test USDC deposit](https://sepolia.etherscan.io/tx/0x253e013dcb3e8afb020ed043f5962eee935c12f0fb3185ed2d550afad2d398d7) | On **Token Transfers**, point to 10 USDC moving from `0x7fD5…87433` into the NULL pool. Say **funding is public**. This proves the deposit, not a private payout. |
| [Recorded ENS permission result](https://github.com/Samarth208P/null/blob/main/deployments/ens-status-2026-09-12.json) | `recipientPermissionCheck.paymentRecord: true` and `websiteRecord: false`. This is a historical read; that same record says the recipient profile was still unpublished. |
| [CRE handler source](https://github.com/Samarth208P/null/blob/main/cre-starter/payroll/workflow.ts#L32-L64) | `getSecret`, authenticated `sendRequest`, `compilePayroll`, and `handlerInTee`. Keep this as a backup tab; actual CLI completion plus app rejection/acceptance is stronger demo footage. |
| [Recorded browser-to-CRE result](https://github.com/Samarth208P/null/blob/main/deployments/cre-ens-browser-2026-09-11.json) | `status: passed`, `localSimulation: true`, `encryptedEnvelopes: 8`; also `remoteExecutionVerified: false`. It did not broadcast a payout. Prefer the fresh result for the recorded draft. |
| **Your new distribution transaction** — open the Sepolia explorer link in the app's confirmed receipt | `Success`, contract destination and transaction hash. Then the distribution logs: `EnvelopePublished` with ciphertext, not a readable recipient-and-amount list. Save the approval footage too: a chain receipt alone does not prove Privy provenance. |
| **Your new claim transaction** — open the explorer link in the claim receipt | `Success`, then decoded `claim` inputs and `AllocationConsumed`. No explicit allocation amount or specific source-batch identifier. Decoding availability depends on the explorer/ABI; unreadable hex alone is not proof of hidden fields. |
| [Claim circuit: public/private boundary](https://github.com/Samarth208P/null/blob/main/circuits/claim/src/main.nr#L4-L18) | Line 6, `inputs: pub [Field; 8]`, versus private `allocation`, `allocation_index`, `distribution_index` and membership paths. The comment at line 4 names the public fields. This source explains the statement; a matching successful transaction demonstrates execution. |
| [Pool claim verification](https://github.com/Samarth208P/null/blob/main/contracts/src/NullPool.sol#L146-L159) | Global root check, claim verifier call, nullifier consumption and `AllocationConsumed`. Keep as backup detail, not a long code tour. |
| **Your new withdrawal transaction** — open the explorer link in the withdrawal receipt | `Success` and ERC-20 transfer destination/amount. Explicitly point out that this full-note exit is public. |
| [Deployment manifest](https://null-protocol.netlify.app/deployment.json) | `chainId: 11155111`, `protocolVersion: 0.2.0`, `contracts.nullPool`. Compare that pool to the transaction destination. A manifest alone is not transaction confirmation. |
| [Developer quickstart](https://null-protocol.netlify.app/#/developers/quickstart) and [npm preview](https://www.npmjs.com/package/@samarth208p/null-payouts/v/0.1.0-preview.2) | Installation command and the public package name. |
| [Local partial-withdrawal evidence](https://github.com/Samarth208P/null/blob/main/docs/PAYOUT_V3_VERIFICATION.md) | Under “Real-proof local-chain rehearsal”: 0.6 claimed, 0.25 withdrawn, 0.35 private remainder. Point at the local-only scope as well. |

### Historical transaction links — backup reference only

The following hashes come from [the September 8 rehearsal record](https://github.com/Samarth208P/null/blob/main/deployments/payment-flow-sepolia-v2.json), which explicitly has `privyOwnerApproval: false`:

- [Historical distribution](https://sepolia.etherscan.io/tx/0xe783fbbf3107cea7678a844b5907dd6de0273c6fdfdae30655a25bd5e9ad44e8)
- [Historical claim](https://sepolia.etherscan.io/tx/0xba10690d55b04d238ef106db15a39f5a8ffe01c33283c36216e0f5d89f14f20b)
- [Historical recipient withdrawal](https://sepolia.etherscan.io/tx/0x10698633ed2069160d291d8388099f07cbbb8a356a4f4750aa3b8d3106f90fc4)

The fresh RPC attempt during video preparation could not retrieve the historical claim receipt, and the web tool could not open that explorer page. Do not rely on these links for shooting until they load and show the matching successful transaction in your browser. Use your newly confirmed receipt links for the actual demo. Never describe these historical transactions as the new Privy-approved payment.

## 0:00–0:20 — Problem, audience and solution

> Paying your team shouldn't mean publishing your business. On a public blockchain, payments can reveal who you work with and what you pay them. Meet NULL. It lets developers add encrypted payouts to their apps. Built for teams paying contributors, contractors, or grants. Let's make a payment.

Show the actual reference app, then briefly the developer quickstart. Overlay **NULL · Private payouts inside your app** and **Unaudited Sepolia prototype · Test tokens**. Payroll is the demonstrated use case; the others are intended applications, not claimed customer adoption.

## 0:20–0:40 — Recipient setup and ENSv2

> First, I set up my receiving account, save my backup, and link my ENS name. ENSv2 connects that name to my public payment keys. I can let someone update just my payment record. Here, you can see they can't change my website record.

Show backup-complete state, explicit name-linking consent and confirmed inbox. Then **Advanced: payment record access → Check access**: highlight payment-record permission versus website-record permission. Keep passwords and backup contents off-screen. If showing recorded revocation, label it historical; it changes future editing rights, not existing funds.

## 0:40–1:00 — Organization prepares the payout

> Now, the team adds funds, enters my ENS name and payment amount, and checks the destination. NULL encrypts the payment details and adds empty slots to make eight slots per batch. If the receiving details change, the team must review them again.

Show a brief confirmed treasury deposit, **New payment**, the recipient's name, resolve/confirm and preparation. Overlay **Deposit is public**. Use one recipient and one payout throughout. Do not fund the `receive` or `pay` verification fixtures. Do not introduce a larger job solely for the video.

## 1:00–1:21 — Chainlink CRE

> Chainlink CRE takes the private payroll data and prepares the encrypted batch. Here, we're running its local simulator, not a live remote enclave. Watch what happens with the wrong result: rejected. Import the matching result, and we can continue. This check is part of our payment flow.

Keep **Verify with Chainlink CRE (local simulation)** enabled. Export privately; run `pnpm cre:simulate --input "PATH_TO_PRIVATE_INPUT.json"`. Show safe CLI completion, a genuine mismatched-result rejection, then the matching `payment-result.json` unlocking this draft. Keep **CRE CLI local simulation** visible. Match checking establishes draft consistency, not remote provenance. Never open private payroll exports, entropy or credentials on camera.

## 1:21–1:43 — Privy financial approval

> Privy handles login and the team's approval wallet. The owner approves this specific payout before it can go through. This demo needs one owner's approval. We send it, and here's the confirmation. Here, the connected wallet pays gas. Apps can also set up gas sponsorship.

Show only after execution: redacted **Approve with organization** for the financial intent, submission and confirmed distribution receipt. Setup's identity-only approval is not this step. Save **Download transaction receipts** and the owner-approval footage; the receipt's approval-source field is app-observed, not independent proof of Privy provenance. Do not expose signatures or authorization tickets.

The spoken transport lines assume the hosted connected-wallet path. If recording an actual local relayer transaction, substitute: **“Here, our sending service pays the gas fee for the user.”** Confirm the real transport before using that line.

## 1:43–2:16 — Recipient flow and privacy evidence

> Back in my account, The Graph helps find the encrypted payment. My keys unlock it on my device. Noir and Barretenberg create a proof so I can claim it. Our Solidity contract checks that proof on Ethereum. Look at the public claim: no readable payment amount, no specific source batch. Now I withdraw. This step shows my wallet, the full amount, and the time. So this is not fully untraceable.

Show recipient discovery → collect/claim → confirmed claim → public distribution/claim evidence → full-note withdrawal and its confirmed token transfer. Save claim and withdrawal receipts. Use cuts between actual completed states. Keep **Public withdrawal** visible for the exit. The video deliberately reveals the test-payment relationship: use consented test identities.

## 2:16–2:34 — Impact and available product

> The value is simple: pay your contributors without posting a readable list of everyone's share onchain. Developers can install our npm preview and build payouts into their own app. This demo uses React and TypeScript. Recipients keep control of their payment keys.

Show `npm install @samarth208p/null-payouts@preview` on the developer quickstart, then the [architecture image](assets/submission-2026-09-13/01-null-architecture.png). Overlay **npm developer preview · v0.2 Sepolia**. Integration, funding, recovery and signing setup remain required. Do not invent adoption, gas savings or throughput figures.

## 2:34–3:00 — Bottlenecks, future and close

> Today, proofs are costly, CRE results need manual import, and batches need separate approvals. With few users, public transfers can still be linked. Withdrawing part and keeping the rest private works in local tests. Next: bring that onchain, get audited, and make the flow cheaper and smoother. NULL. Your app. Your team. Encrypted payouts.

Show one closing card, at most four bullets:

- **Available:** npm preview; v0.2 whole-note exits on Sepolia.
- **Limits:** proof cost/time; manual CRE import; batch approvals; correlation.
- **Local v0.3:** partial withdrawals and private change; public deployment pending.
- **Next:** audit; cheaper proving; durable job recovery; remote CRE execution.

Keep app and source links visible. Future items are directions, not delivered features or promised dates. Public v0.3 needs a new pool/verifier and matching services; existing funds do not automatically migrate.

## Privacy evidence to prepare before shooting

Use the **same newly recorded payout** in all views. Check chain and pool against [the canonical manifest](../apps/web/public/deployment.json). Open distribution, claim and withdrawal receipts in separate explorer tabs. If necessary, decode calldata/logs with the matching contract ABI; never present a manually typed explanation as decoded transaction output.

| View | Highlight | Supported conclusion |
| --- | --- | --- |
| Local recipient discovery | Test amount decrypted with recipient keys | Authorized discovery of this entitlement |
| Distribution calldata/logs | Eight `EnvelopePublished` events: ephemeral public keys, view tags, ciphertext; `DistributionInserted`: commitments, roots, tag | Public encrypted delivery data, without a plaintext ENS-and-amount roster |
| Claim calldata/logs | Public inputs: version, chain, pool, global distribution root, nullifier, private body commitment, nonce, expiry. `AllocationConsumed`: nullifier, commitment, index, root, type | Explicit public fields omit the private allocation amount and specific source-distribution identifier |
| Matching claim circuit | `inputs: pub [Field; 8]`; allocation and membership paths are private parameters | The verified statement checks private membership and ownership |
| Withdrawal and ERC-20 transfer | Confirmed destination and whole-note amount | Funds exited; direct evidence of the public privacy boundary |

Source anchors: [claim circuit](../circuits/claim/src/main.nr), [pool events and checks](../contracts/src/NullPool.sol), [privacy scope](PRIVACY_GUARANTEES.md), [deployment/proof verification](WITHDRAWAL_VERIFICATION.md).

Supported wording: **“This payout used encrypted allocations and a zero-knowledge claim whose public inputs omit its allocation amount and specific source batch.”** A hidden UI number or successful transaction alone does not establish that property. Receipt inspection illustrates the public interface; it is not an independent cryptographic or anonymity audit.

Do not say **“Nobody can identify the payer, learn the original payout amount, or trace this payment.”** The v0.2 whole-note exit reveals the received note amount. ENS profiles, transaction senders, funding, timing and network metadata remain observable. One participant padded to eight envelopes is still one participant. See [privacy boundaries](PRIVACY_GUARANTEES.md).

The [September 8 Sepolia rehearsal](../deployments/payment-flow-sepolia-v2.json) is explicitly historical isolated-signer evidence: deposit 0.1 → allocation/claim/withdrawal 0.06 → treasury refund 0.04 test USDC, with `privyOwnerApproval: false`. It must not be relabeled as a new Privy payment.

## Partner acknowledgements

| Integration | Contribution | Functional evidence in this video |
| --- | --- | --- |
| ENSv2 | Receiving-key registry and scoped record editing | Confirmed name supplies encryption keys; limited record access is visible |
| Chainlink CRE | Confidential-handler payroll fetch and encrypted compilation | Wrong output rejected; exact simulator result enables review |
| Privy | Authentication, dedicated organization wallet and exact-intent approval | Actual financial approval followed by confirmed payout; current quorum 1-of-1 |
| Noir + Barretenberg | Private-witness circuits, UltraHonk proofs and generated EVM verifiers | Real claim accepted without plaintext allocation/source-batch fields |
| The Graph | Public ciphertext/event indexing | Recipient discovers indexed events and decrypts locally |

ENSv2, Privy and Chainlink are the three documented prize targets. Acknowledge Noir/Barretenberg and The Graph regardless of prize selection. Live Graph evidence concerns the event subgraph, not live Substreams provider execution. ENS is required by the app/high-level SDK, not by the immutable pool. CRE evidence is local simulation.

Supporting credits in the description/repository: React/Vite, TypeScript, Solidity/Ethereum Sepolia, viem, underlying cryptographic libraries, Netlify hosting, and Codex assistance/generated visual assets as described in [build provenance](BUILD_PROVENANCE.md) and [gallery provenance](assets/submission-2026-09-13/README.md). Do not imply provider endorsement.

## Before recording and upload

1. Complete [the owner rehearsal](OWNER_REHEARSAL.md): actual recipient profile, organization setup/funding, same-draft CRE result, Privy financial approval, distribution, claim and withdrawal. Keep encrypted recovery private and public receipts available. If this is unavailable, label the Privy flow pending and historical evidence separately; the successful-flow narration above cannot be used as written.
2. Prepare app, safe terminal output, explorer receipts, claim source, quickstart and closing card. Capture at 1080p if practical, minimum 720p; zoom text and close unrelated notifications. Preserve enough transaction context to connect scenes.
3. Rehearse narration against the targets. Cut waiting; do not accelerate footage or speech. Use your own voice. Spend most of the video in the product and evidence views.
4. Replay the exported three-minute video for audible narration, readable evidence and accidental secret exposure. Add observed timestamps, demonstrated source revision and the video link to submission evidence only after recording.

The [official event instructions](https://ethglobal.com/events/ethonline2026/info/details), checked September 13, require a 2–4 minute video, at least 720p, human narration and no sped-up footage. They explicitly permit cutting unnecessary waiting. The posted deadline is September 13, 2026, 12:00 pm EDT (**9:30 pm India time**).

Official prize references: [ENSv2](https://ethglobal.com/events/ethonline2026/prizes/ens), [Privy](https://ethglobal.com/events/ethonline2026/prizes/privy), [Chainlink](https://ethglobal.com/events/ethonline2026/prizes/chainlink). These inform the evidence sequence, not an award or qualification guarantee. Review event-period contributions and AI attribution before submitting.
