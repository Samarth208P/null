# NULL

**Private distribution infrastructure for Ethereum.**

NULL is a protocol implementation and reference application for funded private entitlements. A distribution has eight committed allocation slots and eight constant-size encrypted envelopes. Recipients discover allocations locally and prove entitlement against a global distribution accumulator. A claim creates a private note instead of paying a publicly visible receiving address.

Payroll is the first application. The same primitive can serve contractors, grants, and contributor payouts.

ETHOnline 2026: see the [submission readiness review](docs/SUBMISSION_READINESS.md) for verified deployment checks, current sponsor requirements, and the remaining demo work. The [hosted application](https://null-protocol.netlify.app/) may lag the local source.

## Run the application

Use Node **22.16.0 or newer** and pnpm **11.9.0**.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Open **http://127.0.0.1:5173**. The current application starts in the Sepolia workspace and requires configured Privy sign-in. Configure the public app ID and deployment values using `.env.example` and [the integration guide](docs/INTEGRATION_SETUP.md). A fresh checkout without those values shows a clear setup/sign-in state.

The source also contains sandbox fixtures and local simulation helpers. Those fixtures do not establish a live financial flow or sponsor approval. The current public UI is configured for testnet; do not tell judges that a mocked session or local ledger moved assets.

Drafts, payroll rows, and sandbox funds live in memory. Export password-encrypted recovery before reloading if you want to keep the profile. Recipient key recovery does not preserve the sandbox ledger.

## Interface

- Organization overview, treasury and distribution history.
- Four-step distribution creation with CSV import, exact decimal amounts, profile validation, eight-slot padding, and deterministic preflight.
- Real ENSv2 payment names, scoped Privy-wallet record access, aliases and changed-destination checks. See [ENS integration and live evidence](docs/ENS_INTEGRATION.md).
- Local worker-based encryption and discovery.
- Recipient inbox, claim preparation, private-note balances, encrypted key recovery.
- Public payload inspector and explicit entry/exit privacy boundaries.
- Sepolia status, Privy wallet connection, and configuration-aware live operation preparation.
- Responsive navigation, keyboard focus, reduced motion, and consistent minimal styling.

The UI uses React, TypeScript and Vite. Styling is local CSS; there are no remote fonts, tracking scripts, or stock-image dependencies in the application shell. Privy is loaded when an app ID is configured.

## What is implemented

| Layer | Development implementation |
|---|---|
| Cryptography | secp256k1 stealth profiles, circomlib-compatible Poseidon hashing, HKDF domain separation, strict field encoding |
| Encrypted delivery | 512-byte plaintext, 540-byte AES-GCM ciphertext, 608-byte wire envelope, eight slots |
| SDK | Compilation, scanning, commitments, nullifiers, Merkle paths, Shield/Distribution/Claim/Withdraw witness builders |
| Wallet | Password-encrypted key files and IndexedDB; separate encrypted live-note checkpoints and archives |
| Circuits | Noir Shield, CreateDistribution, Claim and Withdraw, including hidden ECDSA authorization and value constraints |
| Contracts | Immutable verifier bindings, note/distribution/auth trees, double-spend nullifiers, exact ERC-20 deposits and withdrawals |
| Live client | Runtime/hash checks, tree reconstruction, local proving, simulation, relayed/self-broadcast transactions, receipt reconciliation |
| Organization | Privy authorization adapter and authenticated organization service |
| ENSv2 | Live Sepolia registry/resolver, one-key delegation, name-to-profile resolution and payment destination snapshots |
| CRE | Confidential `handlerInTee` workflow and independent local compiler |
| Discovery | Public Graph schema and mappings, RPC fallback, confirmations, reorg handling |
| Relayer | Strict public payloads, rate limits, deployment checks, simulation and broadcast fallback |
| Substreams | Rust normalizer, protobuf and package source |

See the current [submission readiness review](docs/SUBMISSION_READINESS.md) for executed checks, live evidence and outstanding release work. Development compilation is not a security audit. No deployment or integration success is implied by a package being present.

## Build commands

```sh
pnpm build                 # TypeScript + production web bundle
pnpm check                 # Workspace TypeScript compilation
pnpm build:contracts       # Solidity and generated ABIs
pnpm circuits:build        # Noir artifacts + ZK-enabled EVM verifier generation
pnpm build:graph           # Graph mapping source build
pnpm preview              # Serve the production web bundle
```

The Noir/Barretenberg versions are pinned together. Verifier generation can require substantial memory and a network download of public SRS data. See [contract development](contracts/README.md) and [circuit development](circuits/README.md) for exact artifact handling. Do not replace generated verifiers with accept-all implementations.

## Connect Sepolia

The sandbox needs no `.env` or contract deployment. Real Sepolia operations need both. From the workspace root:

```sh
pnpm setup:sepolia         # Create or reuse the private key in the single root .env
pnpm deploy:plan           # Check RPC/artifacts and show the Sepolia ETH funding allowance
# Fund the displayed public address with Sepolia ETH, then:
pnpm deploy:sepolia        # Deploy or resume the contracts and configure public artifacts
pnpm treasury:init         # Create the separate local authorization policy
pnpm treasury:register --broadcast
pnpm setup:relayer --fund  # Fund a separate local relay wallet with up to 0.05 Sepolia ETH
pnpm dev:all               # Run the web app, relayer, and configured local services
```

All configuration lives in one Git-ignored, access-restricted root `.env`; [.env.example](.env.example) is the only template. Setup preserves existing keys and nonempty settings. Deployment checks the pinned artifacts and contract-library links, then writes `deployments/11155111-withdrawals-v2.json`, the browser manifest/circuits, and public deployment values in that same environment file. Restart local processes after configuration changes. See [withdrawal verification](docs/WITHDRAWAL_VERIFICATION.md) for the latest deployment and complete-flow evidence.

The web app can run locally or on Netlify using `netlify.toml`; the Privy organization API is included as a Function. The relayer and remote payroll service require separate hosting. Use the injected wallet, public RPC discovery, and [local treasury approval CLI](tools/TREASURY.md) for the free path. `pnpm dev` starts only the web app; `pnpm relayer` starts only the relay. `pnpm dev:all` also starts the private payroll API when its token is configured. Privy, Graph, and CRE are optional integrations with separate access and usage limits. See [current integration setup](docs/INTEGRATION_SETUP.md), [the free Sepolia guide](docs/FREE_SEPOLIA.md), [deployment details](docs/DEPLOYMENT.md), and [service configuration](docs/SERVICE_CONFIGURATION.md). The live client checks runtime bytecode before preparing funds or proofs and encrypts recovery checkpoints locally before submission.

**Never place wallet private keys, Privy app secrets, view/spend keys, payroll rows, or private witnesses in `VITE_` variables.** These are public bundle values.

The ordinary public deposit and withdrawal boundaries reveal their wallet, amount, and time. The v0.2 pool supports proof-authorized full-note withdrawals, including approved treasury refunds. The immutable v0.1 pool has no exit; new deposits into it are disabled. Do not deposit real-value assets. Authorization policies cannot seize notes.

## Structure

```text
apps/web/                 React reference application and local workers
packages/crypto/          Keys, hashes, encoding, amount arithmetic
packages/protocol/        Commitments, trees, envelope wire format
packages/sdk/             Compilation, scanning, witness builders
packages/wallet/          Encrypted recipient recovery
packages/prover/          Local Noir / Barretenberg worker
packages/client/          Live orchestration and encrypted checkpoints
packages/contracts/       Generated ABIs and bindings
packages/auth/            Privy intent authorization
packages/graph-client/    Public Graph + RPC discovery
contracts/                Solidity source and deployment scripts
circuits/                 Noir circuits and pinned generated artifacts
services/                 Organization host, relayer, confidential workflow
subgraph/                 Public indexing schema and mappings
substreams/               Composable event-normalization source
docs/                     Architecture, boundaries, wire and deployment guides
```

## Privacy and release boundaries

Inside the **intended, fully verified private flow**, public fields are commitments, nullifiers, proofs, fixed-size ciphertexts, and broadcaster transactions. Recipient names, receiving addresses, allocation amounts and claim-to-distribution membership remain private witnesses or encrypted content.

This does not hide the employer's own payroll knowledge, public entry/exit events, IP addresses, timing correlations, compromised endpoints, or browser supply-chain attacks. It is an **unaudited hackathon prototype**. See [SECURITY.md](SECURITY.md), [privacy guarantees](docs/PRIVACY_GUARANTEES.md), and [architecture decisions](docs/ADR/).

[PRD.md](PRD.md) is the original specification. Implementation changes and omitted testing are explicitly recorded. Contract deployment and local service setup do not establish a completed proof/payment flow, privacy audit, live sponsor qualification, or production readiness.
