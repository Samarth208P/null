# NULL

**Private distribution infrastructure for Ethereum.**

NULL is a protocol implementation and reference application for funded private entitlements. A distribution has eight committed allocation slots and eight constant-size encrypted envelopes. Recipients discover allocations locally and prove entitlement against a global distribution accumulator. A claim creates a private note instead of paying a publicly visible receiving address.

Payroll is the first application. The same primitive can serve contractors, grants, and contributor payouts.

## Run the application

Use Node **22.16.0 or newer** and pnpm **11.9.0**.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Open **http://127.0.0.1:5173**. The app starts in a clearly labeled local sandbox. It does not require credentials to try the development interface.

The sandbox includes sample profiles, three editable distribution drafts, and 100,000 sample USDC. Open a draft, prepare the encrypted payload, publish locally, then scan the private inbox. The current profile is the first sample recipient. Local claims produce real note commitments, but **do not generate a ZK proof, move assets, submit transactions, or perform sponsor approvals**.

Drafts, payroll rows, and sandbox funds live in memory. Export password-encrypted recovery before reloading if you want to keep the profile. Recipient key recovery does not preserve the sandbox ledger.

## Interface

- Organization overview, treasury and distribution history.
- Four-step distribution creation with CSV import, exact decimal amounts, profile validation, eight-slot padding, and deterministic preflight.
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
| SDK | Compilation, scanning, commitments, nullifiers, Merkle paths, Shield/Distribution/Claim witness builders |
| Wallet | Password-encrypted key files and IndexedDB; separate encrypted live-note checkpoints and archives |
| Circuits | Noir Shield, CreateDistribution and Claim, including hidden ECDSA authorization and value constraints |
| Contracts | Immutable verifier bindings, note/distribution/auth trees, double-spend nullifiers, exact ERC-20 deposits |
| Live client | Runtime/hash checks, tree reconstruction, local proving, simulation, relayed/self-broadcast transactions, receipt reconciliation |
| Organization | Privy authorization adapter and authenticated organization service |
| CRE | Confidential `handlerInTee` workflow and independent local compiler |
| Discovery | Public Graph schema and mappings, RPC fallback, confirmations, reorg handling |
| Relayer | Strict public payloads, rate limits, deployment checks, simulation and broadcast fallback |
| Substreams | Rust normalizer, protobuf and package source |

See [implementation status](docs/IMPLEMENTATION_STATUS.md) for compilation evidence and outstanding release work. **Development compilation is not security validation.** Tests were deliberately omitted at the user's request. No deployment or integration success is implied by a package being present.

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

1. Generate the pinned circuit/verifier artifacts and deploy the immutable contracts with the deployment script. Only testnet is supported.
2. Fill the deployment manifest with the actual asset, contract addresses, runtime bytecode hashes, artifact hashes, and deployment block. Keep the template's unconfigured status unchanged until a deployment exists.
3. Copy `apps/web/.env.example` to `apps/web/.env.local` and configure public endpoints and deployment values. Restart Vite after changes.
4. Configure the organization service, Privy policies/quorum, CRE confidential execution, Graph deployment and optional relayer using [service configuration](docs/SERVICE_CONFIGURATION.md).
5. Open the Sepolia workspace. The live client verifies the manifest against runtime bytecode before preparing funds or proofs. Recovery checkpoints are encrypted locally before submission.

**Never place wallet private keys, Privy app secrets, view/spend keys, payroll rows, or private witnesses in `VITE_` variables.** These are public bundle values.

The ordinary public deposit and withdrawal boundaries reveal their wallet, amount, and time. **This MVP has no withdrawal route.** Do not deposit real-value assets. Authorization policies cannot seize notes.

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

[PRD.md](PRD.md) is the original specification. Implementation changes and omitted testing are explicitly recorded. No test suite, privacy audit, live sponsor qualification, public deployment, or production readiness is claimed.
