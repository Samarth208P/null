# Architecture

NULL separates confidential preparation from public publication. The React application keeps payroll rows, privacy keys, allocation openings, and witness material in client memory. Encryption and scanning run in a Web Worker. Proof generation uses an isolated worker and the pinned Noir/Barretenberg artifact pair.

## Private preparation

The sender validates one to eight recipients and six-decimal uint64 amounts. Fresh 32-byte batch entropy determines ordering, dummy padding, ephemeral keys, allocation salts and AES-GCM nonces. Reusing that entropy for identical inputs permits an exact local/confidential compile comparison; it must not be reused for a separate distribution or published.

Each allocation commits a hidden stealth-derived secp256k1 key and amount. Eight leaves form an allocation root. Eight constant-size envelopes form the delivery root. The final distribution commitment binds these roots, the full transport tag and non-expiring version semantics. Names are absent from the public bundle.

The employer's organization authorization signs the finalized public intent. The signature and policy opening are private distribution-circuit witnesses. A connected frontend wallet alone does not satisfy the organization policy.

## Onchain state

`NullAuthRegistry` records opaque policy commitments. `NullPool` maintains note and distribution accumulators, accepted-root history and consumed nullifiers. Verifiers and their code hashes are immutable. The asset is a pinned six-decimal ERC-20.

Shield binds the public deposit amount to the hidden treasury note using its own proof. CreateDistribution consumes one or two treasury notes, checks the hidden organization signature, enforces real/dummy slots and value conservation, inserts a private change note and appends the distribution commitment. Claim proves a hidden allocation's membership in the global distribution accumulator, verifies hidden secp256k1 ownership, consumes one deterministic nullifier and inserts a private note with the same amount.

Note leaf indices finalize note commitments so identical note bodies cannot ambiguously collide across tree positions. Claims publish the global accumulator root rather than a specific batch root.

## Discovery and resilience

The Graph indexes public envelopes and protocol events. Queries cover broad block ranges. All view-tag filtering, ECDH and authenticated decryption happen locally. The scanner reconstructs and validates allocation membership, context and accepted distribution commitments.

RPC scanning is a first-class fallback. The index client pins Graph reads, validates checkpoints against block hashes, and replays affected history after reorgs. The live client reconstructs accumulators and compares them with contract roots. Recipient secrets do not enter RPC or Graph requests.

The relayer receives only the proof, public inputs and fixed envelope fields. Output commitments are already bound by the proof. A recipient can export the same public transaction and self-broadcast. An uncertain submission remains uncertain until receipts/nullifiers are reconciled.

## Recovery

Recipient base keys are sufficient to derive deterministic claim-note secrets from accepted history. The wallet package exports encrypted profile recovery. Treasury notes require their encrypted note openings, which the live client persists before submitting any funds. Live checkpoints and policy openings use a distinct encrypted archive format. Successful chain confirmation is reported even if final checkpoint persistence fails, with the failure surfaced for immediate backup/recovery.

The local sandbox has a separate in-memory ledger. It uses real cryptographic preparation and discovery but has no proof verifier, chain consensus, sponsor authorization or asset custody. It is not security evidence.
