# ADR 0002: Enforced funding, fixed state transitions, and proof artifacts

Status: implemented in source. Behavioral testing is deferred by user instruction.

## Decisions

NULL v1 uses Noir `1.0.0-beta.22`, Barretenberg `5.0.0-nightly.20260522`, and Solidity `0.8.28`. The versions come from Barretenberg's [official compiler/backend compatibility map](https://raw.githubusercontent.com/AztecProtocol/aztec-packages/next/barretenberg/bbup/bb-versions.json). All proof generation and verifier generation explicitly select `verifierTarget: 'evm'`, which sets `disableZk: false` and the Keccak transcript in the [pinned backend source](https://raw.githubusercontent.com/AztecProtocol/aztec-packages/v5.0.0-nightly.20260522/barretenberg/ts/src/barretenberg/backend.ts). The non-ZK EVM mode is never used.

The PRD's example shield API accepted an unconstrained treasury-body commitment. That is insufficient: a caller could deposit one unit while committing to a larger hidden amount. A third circuit, `shield`, proves that the body contains exactly the public deposit amount. The contract additionally checks the registered policy, six asset decimals, and exact pool balance increase, rejecting fee-on-transfer behavior.

The pool and organization registry are immutable deployments. Their verifiers and Poseidon contract are constructor dependencies. There is no admin, upgrade method, emergency reserve withdrawal, note redirection, or nullifier override. The deployment script only accepts generated verifier sources with matching compiler integrity records. `UnavailableVerifier` is a deliberately reverting inspection helper; it is never selected by deployment tooling.

Notes, organization policies, and distributions use append-only depth-20 binary Poseidon trees. Capacity is 1,048,576 leaves per tree. Each tree accepts its latest 128 roots to allow concurrent transactions. An old allocation remains in every later tree root; a wallet whose proof references an evicted root refreshes its path and proves again. No distribution expiry or reclaim is active.

Every distribution consumes exactly two public nullifier slots and produces one change-note commitment. The second input may be a constrained phantom: zero amount, note secret, leaf index and path; its nullifier is `Poseidon(PHANTOM_NULLIFIER, nonzeroOwnerKey, nonce, slot, policy)`. The first input must be real. Change is appended even when its private amount is zero, so the presence of a change output does not leak that amount. Both real treasury inputs and change are bound to the same hidden registered policy. A zero-value change note cannot be spent as a real input.

The organization registry is permissionless. Registering a commitment does not authorize spending someone else's treasury note. The distribution circuit proves knowledge of the registered policy opening, its hidden signer key, a valid signature, and input notes with that same policy. Registration itself may reveal which wallet uses NULL; later distribution calldata contains neither that wallet nor the policy commitment.

## Hashes and signatures

Protocol hashes are Circom-compatible Poseidon on the BN254 scalar field. `poseidon-lite@0.3.0` supplies client hashes; `circomlibjs@0.1.7` generates the onchain three-input hash bytecode; the vendored Noir Poseidon functions use the same permutation parameters. Direct arities are used, not a new sponge construction. `contracts/scripts/generate-domains.mjs` derives domain fields from the first 31 bytes of SHA-256 of each UTF-8 label. This yields values below 2^248 without modular reduction. All public fields are checked against the scalar modulus in the pool.

The Noir dependency is `noir-lang/poseidon v0.1.1`, archive SHA-256 `8d47283bd7cff2baa6e955e6b8ec47eda1c08c863a1acb25a99125b5bad5e18a`. It is vendored under `circuits/vendor/poseidon-0.1.1` with its Apache-2.0 license. The following compatibility edits are explicit: the unused Poseidon2/benchmark/test module imports are omitted from `src/lib.nr`; the empty slice in `PoseidonHasher::default` uses the current Noir literal `[]` instead of `&[]`. Poseidon constants, round functions and `hash_1` through `hash_16` are unchanged. Vendoring also avoids a Noir WASM archive-loader path-separator defect on Windows. The build script normalizes the loader's Node path adapter within its own process; installed dependencies are not edited.

Coordinates are encoded as 32 bytes each and hashed as four 128-bit big-endian limbs. Public Keccak roots and transport tags retain all 256 bits by splitting into two limbs. Amounts are unsigned 64-bit values. Field sums are bounded by the fixed number of uint64 terms, far below the modulus.

The distribution signature digest is the canonical 32-byte big-endian encoding of `Poseidon(AUTH_INTENT, ...15 public inputs)`. The claim digest similarly uses `Poseidon(CLAIM_INTENT, ...8 public inputs)`. Both are signed as raw secp256k1 digests, with compact low-s signatures. Different purpose domains and the signed version/chain/pool/output/nullifier/root/deadline fields prevent cross-context replay and relay redirection. The [Noir secp256k1 primitive](https://www.noir-lang.org/docs/libraries/standard_library/cryptographic_primitives/signatures) validates the hidden point and signature. Input allocation coordinate bytes are range-constrained; the SDK validates point syntax while compiling, and the claim circuit enforces point validity through ECDSA. A malicious payer can still sabotage delivery, as described in PRD section 36.

## Observable state

Exactly eight envelope events are emitted per distribution. Each envelope uses a 33-byte compressed ephemeral key, one-byte view tag, and 540-byte ciphertext containing a 12-byte nonce, 512-byte encrypted body and 16-byte GCM tag. The full serialized envelope is 608 bytes. The pool recomputes all Keccak envelope leaves and their root from calldata before accepting the proof. The authorized root is part of the distribution proof and signature.

`NoteInserted` supplies the commitment/index/root needed to replay the note tree. It is emitted once for each shield, change, and claim note. Indexers must use it for tree insertion and use `Shielded`/`AllocationConsumed` only for their additional semantics. `AllocationConsumed` never exposes a distribution commitment, transport tag, allocation root, amount, key, or allocation index.

## Artifact and deployment boundary

Source compilation, verification-key generation, Solidity-verifier generation, behavioral tests, deployment, and sponsor evidence are distinct steps. The build scripts do not run tests. An artifact checksum demonstrates byte identity, not circuit correctness or an audit. Browser proving requires pinned artifact and verification-key hashes. The deployment manifest remains unconfigured until actual deployment; no address, transaction hash, proof, deployment block, or successful sponsor execution is fabricated.

The deploy script defaults to a read-only deployment plan and restricts networks to Sepolia/local development. Broadcasting requires its explicit command flag. It checks chain, asset decimals/code, all generated source hashes and compiled artifact integrity. Runtime code hashes are recorded for the pool, registry, verifiers, hasher and asset. If the chosen asset is a proxy, its runtime code hash does not pin the proxy implementation or governance; asset issuer/proxy risk remains a separate trust boundary.

Version 0.1 ends at a recipient private note and has no exit. Version 0.2 adds a separate full-note withdrawal circuit: note ownership and membership remain private, destination and amount are public, and treasury exits require the registered policy signer. It uses the existing spent-note nullifier set and checks both pool and recipient token balance deltas. There is still no private-note transfer circuit. Only testnet assets are appropriate. The README/demo must identify actual proof and deployment evidence and must not claim an audited or untraceable system.

