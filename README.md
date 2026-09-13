<div align="center">
  <img src="docs/assets/logo.svg" width="96" height="96" alt="NULL Protocol" />
  <h1>NULL Protocol</h1>
  <p><strong>ENS payouts inside your app. Local keys, private entitlements, sponsored transactions.</strong></p>
  <p><a href="https://null-protocol.netlify.app/">Open the Sepolia app</a> · <a href="docs/SUBMISSION_READINESS.md">Verified status</a> · <a href="docs/SUBMISSION_DEMO.md">Demo walkthrough</a></p>
</div>

NULL is an embeddable TypeScript toolkit for private payouts on Ethereum. An organization enters ENS names and amounts; the toolkit resolves receiving keys, prepares encrypted entitlements, and coordinates approved transactions. Recipients discover and claim with local keys. Integrators keep their own UI and can pay transaction gas through a sponsor adapter or let organizations use their wallets. Start with the [integration guide](docs/SDK_INTEGRATION.md) and [framework-independent example](apps/payout-example/).

**Developer docs:** start with the [browser quickstart](https://null-protocol.netlify.app/#/developers/quickstart), browse [questions and answers](https://null-protocol.netlify.app/#/developers/faq), or give your coding assistant the [NULL integration skill](skills/null-payouts/SKILL.md). The [AI integration page](https://null-protocol.netlify.app/#/developers/ai) includes a downloadable `SKILL.md`, installation instructions and a suggested integration request. The guides also cover payout submission, recipient recovery, sponsored gas, API imports and privacy limits.

**Release state:** MIT-licensed npm developer preview: [`@samarth208p/null-payouts`](https://www.npmjs.com/package/@samarth208p/null-payouts), version `0.1.0-preview.2`. Install with `npm install @samarth208p/null-payouts@preview`; see the [npm integration guide](docs/NPM_PACKAGE.md). This is a toolkit, not a managed payout service. Lists larger than eight recipients become consecutive padded onchain batches, with separate approvals, receipts and partial progress. The reference app uses the same high-level payout API. Setup, funding and signing consent are still required; the current reference flow is not literally one click from an empty wallet.

**Partial withdrawal status:** the fresh [Sepolia v0.3 pool](deployments/11155111-partial-withdrawals-v3.json) is the sole active reference-app deployment. Individuals choose a positive amount up to their recovered private balance, with six decimal places; the exact remainder stays private. Amounts spanning several notes use sequential transfers. All five verifiers and circuit artifacts are configured. See [verification evidence](docs/PAYOUT_V3_VERIFICATION.md).

**Unaudited testnet prototype.** Deposits and withdrawals expose their wallet, amount and timing. ENS names and their linked public payment profiles are public. The sender knows its payroll. Current Chainlink evidence is **CRE CLI local simulation**, not remote enclave execution or attestation. The configured Privy control is **one owner, threshold one**; a completed owner-approved financial payment remains outstanding. See [privacy boundaries](docs/PRIVACY_GUARANTEES.md).

## The payment workflow

1. **Recipient sets up an ENS inbox.** Save the encrypted NULL backup, then use a Sepolia ENSv2 name to publish the public `null.paymentProfile` record. Scoped resolver permissions let a wallet update this one record; revocation removes that delegated editing right.
2. **Organization pays by ENS name.** Enter names and amounts or import `ens,amount` CSV. Every live recipient must have a confirmed name resolving to a NULL profile through the supported Permissioned Resolver. Raw Payment IDs and wallet addresses are rejected. The compiler constructs eight padded, encrypted delivery envelopes per batch; larger lists run sequentially.
3. **CRE checks the encrypted batch.** Export the private draft, run the actual confidential handler through the CRE CLI, and import its public result. With the CRE check enabled, review stays locked until the exact result matches the draft. This is local simulation and file-integrity checking, not proof of remote provenance.
4. **Organization approves the exact intent.** Privy checks the dedicated wallet and owner quorum. The signature is bound to the chain, pool, and encrypted batch. ENS destinations are checked again before approval and submission; changed destinations require a new review.
5. **Recipient discovers, claims, and withdraws.** The Graph indexes public ciphertext events. Recipient keys scan locally and Noir proofs authorize a claim against the global distribution accumulator. Withdrawal is a separate public token transfer.

```mermaid
flowchart LR
  ENS[ENSv2 name and scoped payment record] --> Resolve[Resolve and confirm every recipient]
  Resolve --> Compile[Compile private entitlements]
  Compile --> CRE[CRE confidential handler: local simulation]
  CRE --> Match[Match exact encrypted result]
  Match --> Approve[Privy owner approval]
  Approve --> Pool[NullPool: funded distribution]
  Pool --> Graph[Graph: public ciphertext events]
  Graph --> Claim[Local discovery and Noir claim]
  Claim --> Exit[Separate public withdrawal]
```

**ENS is required by the live reference application and high-level payout SDK for every new distribution.** Its function is receiving identity, key rotation, and delegated record management. Setup asks for a preferred ENS name; users must own and explicitly link it after backing up their keys. This does not register a name automatically. Recovery, claims, and withdrawal remain usable when ENS is unavailable or a name expires. The low-level cryptographic SDK and immutable pool are identity-agnostic: they do not verify ENS on chain. We do not publish a name-to-batch roster to enforce it.

## Integrations and evidence

| Integration | Responsibility | Evidence and boundary |
| --- | --- | --- |
| [ENSv2](docs/ENS_INTEGRATION.md) | Required receiving names; hierarchical subnames, aliases, scoped text permissions, rotation and revocation | [Confirmed setup transactions](deployments/ens-sepolia.json); live reads and negative cases. The Privy recipient's profile publication still needs its owner. |
| [Privy](services/organization/) | Authentication, embedded wallet, exact organization intent approval, session-bound single-use tickets | Live wallet/quorum checks and rejection of an unsigned request. One owner, threshold one; the full financial action still needs execution. |
| [Chainlink CRE](services/cre-workflow/) | `handlerInTee`, authenticated private payroll fetch, deterministic envelope compilation | [September 12 successful receipt](deployments/cre-simulation-2026-09-12.json). Local simulation only. |
| [Noir](circuits/) | Five UltraHonk circuits: shield, distribution, claim, full and partial withdrawal | [Recorded full Sepolia rehearsal](deployments/payment-flow-sepolia-v3.json) used genuine proofs and an isolated signer, not Privy owner approval. |
| [The Graph](subgraph/) | Public event discovery with chain validation and RPC fallback | [Sepolia event subgraph](https://api.studio.thegraph.com/query/1758859/null-protocol/v0.3.0). Substreams packaging is separate from live provider execution. |

## Run locally

Requires Node.js >=22.16.0 and pinned pnpm 11.9.0. Existing deployment configuration and service credentials are described in [deployment setup](docs/DEPLOYMENT.md); never place server secrets in `VITE_` variables.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev             # web at http://127.0.0.1:5173
pnpm dev:all         # local web and configured services
pnpm check           # workspace typechecks
pnpm test:submission # ENS, CRE import, Privy controls, sessions and storage
pnpm test:payouts    # SDK boundaries, multi-batch and withdrawal job reconciliation
pnpm example:payouts # live ENS reads and local encryption; sends no money
pnpm test:partial-withdrawal
pnpm test:flow-v3    # isolated Anvil, genuine proofs, no public-chain funds
pnpm test:withdrawal
pnpm test:domains
pnpm build
pnpm ens:status      # read-only live ENS verification
pnpm cre:simulate    # actual CRE CLI; requires CRE login
```

For integrated CRE execution, export a payment from the app, run `pnpm cre:simulate --input "PATH_TO_PRIVATE_INPUT.json"`, then import `payment-result.json` from the printed directory into the same draft. The export contains private payroll and secret batch entropy: keep it off-screen and out of Git. [CRE setup](cre-starter/README.md).

## Sepolia deployment

Ethereum Sepolia, chain 11155111. The [canonical manifest](apps/web/public/deployment.json) records addresses, bytecode hashes, circuit checksums, deployment block, and transaction receipts.

| Contract | Address |
| --- | --- |
| [NullPoolV3](contracts/src/NullPoolV3.sol) | [`0x17A41574900ca3120562Ae5616559EceebA74E36`](https://sepolia.etherscan.io/address/0x17A41574900ca3120562Ae5616559EceebA74E36) |
| [NullAuthRegistry](contracts/src/NullAuthRegistry.sol) | [`0x126ec72460f84f8DDC7A81aCE153982373b92DE9`](https://sepolia.etherscan.io/address/0x126ec72460f84f8DDC7A81aCE153982373b92DE9) |
| Shield verifier | [`0x3637802C52421Cadb6420d2A529515E3A1bD9aAF`](https://sepolia.etherscan.io/address/0x3637802C52421Cadb6420d2A529515E3A1bD9aAF) |
| Distribution verifier | [`0x016Cd5EB253e57a507432a24CE71F919DE503040`](https://sepolia.etherscan.io/address/0x016Cd5EB253e57a507432a24CE71F919DE503040) |
| Claim verifier | [`0x4b1a60aC45E08503Be4660956Cb48E90ac2A9257`](https://sepolia.etherscan.io/address/0x4b1a60aC45E08503Be4660956Cb48E90ac2A9257) |
| Full withdrawal verifier | [`0xa7605191B82657B3e91cA198cBb0f32ce2503A22`](https://sepolia.etherscan.io/address/0xa7605191B82657B3e91cA198cBb0f32ce2503A22) |
| Partial withdrawal verifier | [`0x8Ff182757c668973FA243A2BB630dC755Eb6057F`](https://sepolia.etherscan.io/address/0x8Ff182757c668973FA243A2BB630dC755Eb6057F) |

The [September 13 payment rehearsal](deployments/payment-flow-sepolia-v3.json) records deposit → distribution → discovery → claim → 0.025-USDC withdrawal → recovery and withdrawal of 0.035-USDC private change → 0.04-USDC treasury refund. It returned all 0.1 test USDC and left the pool empty. The isolated signer test does not represent a Privy owner approval.

## Repository map

| Path | Purpose |
| --- | --- |
| [apps/web](apps/web/) | React/Vite app, ENS inbox, payment wizard, local proving and recovery |
| [packages/payouts](packages/payouts/), [apps/payout-example](apps/payout-example/) | ENS-first integration API, payout and withdrawal jobs, own-UI example |
| [packages/ens](packages/ens/) | ENS resolution, mandatory live-payment guards, resolver permissions |
| [packages/sdk](packages/sdk/), [crypto](packages/crypto/), [protocol](packages/protocol/) | Batch compilation, cryptography, wire formats and witnesses |
| [packages/client](packages/client/) | Chain orchestration, discovery, receipt reconciliation |
| [packages/auth](packages/auth/), [services/organization](services/organization/) | Privy organization approval and API |
| [packages/wallet](packages/wallet/), [prover](packages/prover/) | Encrypted recovery and local proving |
| [contracts](contracts/), [circuits](circuits/) | Five deployed v0.3 circuits and the fresh partial-withdrawal pool |
| [services/cre-workflow](services/cre-workflow/), [cre-starter](cre-starter/) | Shared payroll compiler and CRE simulator |
| [subgraph](subgraph/), [substreams/private-payments](substreams/private-payments/) | Event indexing and separate stream module |

## Submission and AI disclosure

**For sponsor judges:** the [evidence walkthrough](docs/SPONSOR_EVIDENCE.md) maps ENSv2, Chainlink CRE and Privy requirements to exact source, recorded execution, and remaining demo actions.

Codex assisted with implementation, debugging, tests, documentation, and release preparation, including the September 11 ENS requirement and evidence corrections. Dependencies, generated verifiers, sponsor SDKs, templates, and pre-existing code are not claimed as original event work. The team must review the [build provenance disclosure](docs/BUILD_PROVENANCE.md) and confirm the actual event-period work and appropriate track; Git timestamps alone do not establish eligibility.

The [demo plan](docs/SUBMISSION_DEMO.md) includes human narration and the evidence sequence; [submission copy](docs/SUBMISSION_COPY.md) provides sponsor descriptions and judge questions. No final submitted demo video is claimed in this repository. See [readiness](docs/SUBMISSION_READINESS.md) for remaining actions and [security scope](SECURITY.md) for limitations.
