# NULL — Product Requirements Document

> **Private distribution infrastructure for Ethereum**
>
> **Core thesis:** A payer should be able to commit a funded distribution onchain without publishing the recipients, individual amounts, receiving addresses, or a claim-to-batch link. A recipient should be able to discover their allocation non-interactively, prove entitlement privately, and materialize it as a shielded note without revealing which allocation they claimed.

---

## Document Control

| Field | Value |
|---|---|
| Product | **NULL** |
| Working tagline | **Distribute value, reveal nothing.** |
| Document | Product Requirements Document / Protocol Specification |
| Version | `0.1.0-hackathon` |
| Status | Implementation-ready draft |
| Target event | ETHOnline 2026 |
| Submission mode | Finalist + Partner Prizes |
| Primary prize targets | **Privy**, **Chainlink**, **The Graph** |
| Primary network | Ethereum Sepolia unless sponsor constraints require an additional deployment |
| Primary asset for MVP | One USDC-compatible six-decimal stablecoin, address pinned in deployment manifest |
| Planning date | 2026-09-05 |
| ETHOnline deadline | 2026-09-13 12:00 PM EDT / 9:30 PM IST |
| Demo constraint | 2–4 minute submission video |
| Finalist format | 4-minute demo + 3-minute Q&A |
| Security status | Hackathon prototype; not audited; no production-value funds |

### Normative language

The words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**, and **MAY** are requirements language.

### Source of truth

This file is the source of truth for the hackathon implementation. If code diverges from it, add an Architecture Decision Record documenting:

1. the change;
2. why it was necessary;
3. privacy/security impact;
4. testing impact;
5. whether any public claim in the README/demo must change.

---

# 1. Executive Summary

NULL is a **private distribution protocol**, not merely a payroll application.

The protocol allows an organization to move value from a pre-shielded treasury into a fixed-size set of private entitlements. Public observers see commitments, nullifiers, zero-knowledge proofs, fixed-size encrypted envelopes, and relayer transactions. They do **not** receive the recipient's identity, recipient wallet address, one-time stealth public key, individual allocation amount, allocation index, or the specific distribution from which a later claim originated.

The first application is **private payroll** because it gives an immediate, concrete reason for the protocol to exist:

> Public blockchains should not force a company to publish every employee's salary and financial address graph.

The same primitive can serve:

- payroll;
- contractor payouts;
- DAO contributor compensation;
- grants;
- private airdrops;
- creator payouts;
- revenue sharing;
- rebates;
- affiliate distributions;
- investor distributions;
- bug bounties;
- private vesting claims.

NULL has five core layers:

1. **Shielded treasury** — organization funds are represented by hidden-value notes before a distribution is created.
2. **Private distribution** — a ZK proof converts treasury notes into a committed fixed-size set of private entitlements while enforcing value conservation.
3. **Stealth delivery** — ERC-5564 scheme-1 key derivation and view-tag concepts produce one-time recipient claim keys and encrypted allocation envelopes without publishing the stealth address.
4. **Private claim** — a recipient proves control of the hidden one-time stealth key and converts one allocation into a shielded note.
5. **Resilient discovery** — The Graph provides a standardized fast indexing path while raw RPC scanning remains a first-class fallback.

Sponsor integrations are load-bearing:

- **Privy** controls organization treasury authorization and approvals.
- **Chainlink CRE Confidential Workflows** process sensitive payroll inputs and payment-routing data inside a TEE.
- **The Graph** indexes standardized public privacy events and encrypted envelopes without ever receiving viewing keys.

No sponsor service may custody recipient secrets or become required for a previously published recipient to recover/claim funds.

---

# 2. Product in One Sentence

> **NULL turns a funded business payout into private onchain entitlements that recipients discover with stealth keys and claim as shielded notes without revealing their address, amount, or source distribution.**

---

# 3. Finalist-Level Thesis

NULL MUST be presented as a **protocol primitive with payroll as the flagship demonstration**.

It MUST NOT be positioned primarily as:

- a payroll dashboard;
- an ERC-5564 wallet;
- a stealth-address generator;
- an encrypted CSV app;
- a relayer;
- a mixer;
- a private transfer wrapper.

The protocol contribution is:

> **Private distribution commitments + hidden entitlement claims + stealth-compatible encrypted delivery + globally unlinkable claim membership.**

A traditional distributor commonly commits recipient/amount information and reveals enough at claim time to identify who is receiving what. NULL instead creates a fixed-size committed distribution. A recipient privately proves:

- one valid allocation exists;
- that allocation belongs to a valid accepted distribution;
- the claimant controls the hidden one-time stealth key committed to it;
- the allocation has not already been consumed;
- the new shielded note contains exactly the committed amount.

The chain learns none of the allocation's plaintext values.

---

# 4. Why NULL Is Not "Just Another Private Payroll Project"

Private payroll and stealth payments already exist as hackathon concepts. NULL therefore competes on **protocol depth**.

Differentiators:

- fixed-arity private distributions;
- hidden individual amounts;
- hidden recipient one-time keys;
- claim-to-distribution unlinkability;
- recipient-control proof inside ZK;
- shielded note output instead of token-to-stealth-EOA settlement;
- constant-size encrypted delivery payloads;
- permissionless relaying;
- client-only view/spend secrets;
- reusable private-payment indexing standard;
- explicit operational fallbacks.

Desired judge reaction:

> "Payroll is only one application. This is reusable privacy infrastructure."

---

# 5. Goals

## 5.1 P0 — Hackathon Critical

The system MUST demonstrate on public testnet:

1. A business-controlled wallet shields treasury funds.
2. A sensitive payroll dataset is processed through a Chainlink CRE Confidential Workflow.
3. A Privy-governed organization authorizes a private distribution.
4. Distribution calldata/events reveal neither individual recipient identifiers nor individual allocation amounts.
5. Each distribution uses a fixed slot count with real and dummy allocations indistinguishable by public payload length.
6. Every real allocation is addressed to a one-time stealth-derived secp256k1 public key that is never published in plaintext.
7. Recipient delivery data is encrypted in constant-size envelopes.
8. The Graph indexes only public commitments/ciphertexts and never receives a viewing or spending key.
9. A recipient locally scans/decrypts announcements and discovers their entitlement.
10. The recipient generates a ZK claim proof locally.
11. The claim does not reveal:
    - recipient wallet;
    - recipient stealth public key;
    - salary/allocation amount;
    - allocation leaf;
    - allocation index;
    - specific distribution being claimed.
12. Claim creates a shielded note.
13. Claim can be broadcast by a relayer that cannot redirect the output.
14. Claim remains possible without the hosted relayer.
15. Claim remains discoverable without The Graph via raw RPC.
16. Published distributions remain claimable if CRE is unavailable later.
17. No server stores view keys, spend keys, one-time stealth private keys, note-owner secrets, or plaintext payroll rows.
18. `pnpm privacy:audit` demonstrates that fixture recipient addresses and individual salaries are absent from public private-flow calldata/logs.

## 5.2 Post-MVP

Design SHOULD support:

- multiple assets;
- 16/32-slot versions;
- expiry/reclaim;
- selective disclosure;
- private note-to-note payments;
- recurring private distributions;
- ENSv2 privacy profiles;
- cross-chain distribution;
- multiple relayers;
- mobile scanning.

---

# 6. Non-Goals and Honest Privacy Boundaries

NULL v0.1 MUST NOT claim to solve:

- IP anonymity;
- browser fingerprinting;
- global passive network surveillance;
- mempool anonymity unless an explicitly private relay is used;
- hiding a normal public deposit at the pool-entry boundary;
- hiding a normal public withdrawal at the pool-exit boundary;
- hiding payroll facts from the employer who created the payroll;
- compromised endpoints;
- malware on recipient devices;
- legal/compliance requirements;
- production-grade anonymity;
- arbitrary private smart-contract calls;
- audited production security.

The README and demo MUST say exactly where privacy begins and ends.

---

# 7. Success Criteria

## 7.1 Functional

A successful demonstration includes:

- 4 real employees in an 8-slot distribution;
- 4 dummy slots;
- different non-round salaries;
- one real Privy organization approval/control;
- one successful CRE confidential simulation/deployment;
- live Graph data;
- one recipient discovery;
- one private claim;
- one raw RPC fallback scan;
- one relayer fallback/self-broadcast path or CLI;
- explorer inspection proving sensitive values are absent.

## 7.2 Privacy

For fixture data:

- employee EOA appears **0 times** in `createDistribution`/`claim` public inputs and events;
- one-time stealth public key appears **0 times** in plaintext onchain;
- exact individual salary appears **0 times** in private distribution/claim public calldata/events;
- employee name/email/ENS identifier appears **0 times** in protocol events;
- viewing key appears **0 times** outside recipient-controlled storage/memory;
- spending key appears **0 times** outside recipient-controlled storage/memory;
- claim exposes **no specific distribution root or transport tag**;
- real/dummy envelopes have identical serialized length;
- every distribution publishes exactly the configured fixed number of envelopes.

## 7.3 Reliability

- With wallet secrets + chain history, recipient can reconstruct claim state without NULL's database.
- Any broadcaster can submit a valid claim.
- Double claim fails.
- Proof mutation fails.
- Changing output note commitment invalidates authorization.
- No privileged admin can redirect/seize a private note.

## 7.4 Repository Quality

MUST include:

- reproducible installation;
- pinned toolchain;
- clean commit history;
- public test vectors;
- circuit tests;
- Foundry tests;
- fuzz/invariant tests;
- end-to-end flow;
- privacy audit command;
- security doc;
- architecture doc;
- wire format doc;
- implementation-status doc;
- deployment manifest;
- zero-localhost release verifier.

---

# 8. Personas

## 8.1 Finance Admin

Needs:

- human-readable USDC workflow;
- shielded treasury state;
- private payroll import;
- approvals;
- deterministic preflight;
- clear privacy guarantees.

## 8.2 CFO / Approver

Needs:

- organization identity;
- quorum/policy enforcement;
- human-readable intent;
- confirmation that the signed intent exactly matches the committed distribution.

## 8.3 Recipient / Employee

Needs:

- local key custody;
- no public receiving wallet;
- easy inbox;
- gasless claim when relayer is available;
- recovery;
- clear boundary if exiting publicly.

## 8.4 Protocol Integrator

Needs:

- SDK;
- stable event/wire formats;
- test vectors;
- proof interfaces;
- reference model;
- live standardized index.

---

# 9. Product Principles

1. **Primitive first, app second.**
2. **No fake privacy claims.**
3. **Fail closed.**
4. **No server-held recipient secrets.**
5. **No hosted service is necessary to recover an existing entitlement.**
6. **Recipient output is cryptographically bound before relay.**
7. **Fixed-size public structures wherever practical.**
8. **Every public field needs a documented reason.**
9. **Every dependency has a documented trust boundary.**
10. **Every hash has domain separation.**
11. **Every wire encoding has test vectors.**
12. **Sponsor integrations are load-bearing, not decorative.**
13. **No admin seizure path.**
14. **UI polish never overrides a privacy invariant.**
15. **Hackathon prototype language must remain explicit.**

---

# 10. Privacy Model

## 10.1 Public/Private Matrix

| Data | Public? | Notes |
|---|---:|---|
| Pool-entry wallet | Yes at shield boundary | unavoidable for ordinary ERC-20 deposit |
| Pool-entry amount | Yes at shield boundary | avoid exact payroll top-up |
| Employer identity during distribution | Hidden target | relayer + private auth proof |
| Distribution existence | Yes | required |
| Exact real recipient count | Hidden within fixed batch | 8-slot MVP |
| Recipient identity | No | required |
| Recipient EOA | Not used | required |
| One-time stealth public key | No | committed/encrypted |
| Individual amount | No | private witness |
| Allocation leaf/index | No during claim | required |
| Specific distribution claimed | No | global distribution accumulator |
| Claim nullifier | Yes | replay prevention |
| Output note commitment | Yes | shielded state |
| Distribution envelopes | Ciphertext only | fixed size |
| View tag | Yes | scanning hint |
| Public withdrawal recipient | Yes | explicit exit boundary |
| Public withdrawal amount | Yes | explicit exit boundary |

## 10.2 Strong Claim

Allowed wording:

> **Inside the NULL private zone, public chain data does not reveal the recipient address, one-time stealth key, individual allocation amount, allocation position, or claim-to-distribution link.**

## 10.3 Strong Privacy Operating Mode

Use:

- pre-funded rolling shielded treasury;
- non-correlated shield deposits;
- relayed distributions;
- relayed claims;
- fixed-size batches;
- constant-size ciphertext;
- broad-range Graph/RPC queries;
- no third-party analytics;
- delayed/randomized claim timing.

---

# 11. Funding Boundary

A standard ERC-20 deposit into a shielded pool exposes:

- sender;
- token;
- amount;
- timestamp.

Therefore the app MUST warn against:

```text
deposit exact payroll total
immediately create payroll distribution
```

Recommended:

```text
shield larger rolling treasury balance
wait / use independently of payroll cadence
later spend hidden treasury notes into distributions
```

For the demo, treasury SHOULD be pre-funded in earlier blocks.

---

# 12. Withdrawal Boundary

A public withdrawal reveals:

- destination;
- amount;
- time.

The default finalist demo SHOULD stop at the recipient's private note balance.

If withdrawal is demonstrated, UI MUST show a privacy-boundary warning.

---

# 13. Threat Model

## 13.1 Passive Chain Observer

Can read all calldata/logs/transactions.

Target: hide recipient, amount, allocation, source distribution.

## 13.2 RPC Provider

Can see requests and network metadata.

Must never receive secret keys.

RPC must be replaceable.

## 13.3 Graph Provider

Can see public indexed data and query patterns.

Must never receive recipient view/spend key.

Must be replaceable by RPC.

## 13.4 Relayer

Can see proof/public inputs and requester network metadata.

Must not learn amount/recipient from protocol payload.

Must not redirect output.

Must be replaceable.

## 13.5 Hosted Frontend

Could be compromised.

Design minimizes server exposure, but malicious frontend supply-chain compromise remains an endpoint risk.

## 13.6 Employer

Knows its own payroll roster and intended salaries.

Must not know recipient stealth private key or internal note owner secret.

Employer knowing its own intended employee-to-salary mapping is unavoidable and not a protocol privacy goal.

## 13.7 Malicious Recipient

Must not:

- claim twice;
- alter amount;
- claim dummy/other leaf;
- inflate output.

## 13.8 Malicious Compiler / Compromised TEE

Must not spend treasury without valid business authorization.

Could produce invalid delivery data and cause DoS; deterministic preflight mitigates.

## 13.9 Compromised Recipient Device

Out of scope.

## 13.10 Verifier/Circuit Bug

Critical foundational risk.

Mitigation:

- immutable versioned deployments;
- adversarial tests;
- independent reference model;
- testnet only;
- audit required before real funds.

---

# 14. Privacy Invariants

These are release blockers.

### INV-P1 — No recipient address

No employee EOA or plaintext stealth address in private distribution/claim calldata/events.

### INV-P2 — No individual amount

No salary as public proof input.

### INV-P3 — No claim-to-batch link

Claim proves membership against a **global distribution accumulator root**, not a specific public allocation root.

### INV-P4 — Local viewing

Viewing/spending keys never leave recipient environment.

### INV-P5 — Bound relay output

Relayer cannot alter output note commitment.

### INV-P6 — Constant envelope size

Real and dummy envelopes same serialized public length.

### INV-P7 — Fixed slot count

MVP distribution always has `8` slots.

### INV-P8 — Value conservation

```text
sum(private treasury inputs)
=
sum(real allocations)
+
private change
```

### INV-P9 — One entitlement, one consumption

Claim/reclaim share a deterministic allocation consumption nullifier.

### INV-P10 — No admin seizure

No privileged path to modify note ownership, consume allocations, or withdraw reserves.

---

# 15. Terminology

## Privacy Profile

Long-lived stealth public material:

- spend public key;
- view public key;
- scheme ID/version.

## Stealth Claim Key

One-time secp256k1 key derived from recipient profile and fresh sender ephemeral key.

The public key is committed but not published.

## Treasury Note

Hidden-value organization-owned pool note.

## Allocation

Hidden entitlement:

- one-time stealth key commitment;
- amount;
- salt;
- flags.

## Distribution

Fixed-size Merkle set of 8 allocations.

## Distribution Accumulator

Global append-only tree of valid distribution commitments.

## Envelope

Constant-size encrypted delivery payload.

## Claim Nullifier

Public deterministic marker preventing one allocation being consumed twice.

## Private Note

Shielded recipient output created by claim.

---

# 16. High-Level Architecture

```text
                 EMPLOYER / FINANCE
                        |
                        | Privy org control
                        v
              signed DistributionIntent
                        |
private payroll          |
      |                 |
      v                 v
+-------------------------------+
| Chainlink CRE Confidential    |
| Workflow                      |
| - private HR/API input        |
| - validate / canonicalize     |
| - derive allocations          |
| - pad slots                   |
| - encrypt envelopes           |
+---------------+---------------+
                |
      local deterministic compare
                |
                v
+-------------------------------+
| Local CreateDistribution      |
| ZK Prover                     |
+---------------+---------------+
                |
             proof
                |
                v
          any relayer
                |
                v
+-------------------------------+
| NullPool                      |
| - note tree                   |
| - distribution tree           |
| - nullifier sets              |
| - immutable verifiers         |
+---------------+---------------+
                |
              events
                |
                v
+-------------------------------+
| The Graph                     |
| Substreams + standardized     |
| Subgraph                      |
+---------------+---------------+
                |
        ciphertext/public data
                |
                v
+-------------------------------+
| Recipient wallet              |
| local view-key scanner        |
| local decrypt                 |
| local claim prover            |
+---------------+---------------+
                |
             proof
                |
           any relayer
                |
                v
             NullPool
                |
                v
       shielded private note
```

---

# 17. Chain and Asset Scope

## 17.1 Network

Preferred unified network: **Ethereum Sepolia**.

If a sponsor requires another network, add a secondary deployment without changing protocol semantics.

## 17.2 Asset

MVP uses one configured six-decimal stablecoin.

Exact address lives only in:

```text
deployments/<chainId>.json
```

Local tests use `MockUSDC`.

## 17.3 Why Single Asset

- simpler circuit;
- fewer confusion attacks;
- no token-address privacy question;
- focuses judging on distribution primitive.

Multi-asset is P2.

---

# 18. Cryptographic Stack

## 18.1 Requirements

Need:

- ZK-friendly hashes;
- Merkle membership;
- range constraints;
- hidden secp256k1 ECDSA verification;
- EVM verifier;
- local/browser proving;
- deterministic vectors.

## 18.2 Planned Implementation

Preferred:

- Noir;
- Barretenberg;
- Noir secp256k1 ECDSA verification primitive;
- pinned Poseidon/Poseidon2-compatible hash;
- generated Solidity verifier.

Exact versions MUST be pinned before final implementation.

If proof backend changes, ADR must record:

- proof system;
- setup/SRS assumptions;
- verifier generation;
- proof size;
- gas;
- proving benchmarks.

## 18.3 Integer/Field Encoding

Never silently modulo arbitrary `uint256` values into the SNARK field.

secp256k1 coordinates:

- exactly 32-byte big-endian;
- split each coordinate into two 128-bit limbs;
- range-constrain limbs.

Amounts:

```text
uint64 atomic units
```

Real:

```text
1 <= amount <= 2^64-1
```

Dummy:

```text
amount = 0
```

## 18.4 Domain Separation

Logical domains:

```text
null.v1.pk
null.v1.merkle
null.v1.treasury-note
null.v1.private-note
null.v1.final-note
null.v1.note-nullifier
null.v1.allocation
null.v1.distribution
null.v1.claim-nullifier
null.v1.auth-policy
null.v1.auth-intent
null.v1.note-owner
null.v1.note-secret
```

A script generates field constants across:

- circuits;
- Solidity;
- TypeScript;
- reference model;
- vectors.

CI checks equality.

---

# 19. ERC-5564 Relationship

NULL uses ERC-5564 scheme-1-compatible concepts for:

- spending/viewing key separation;
- fresh sender ephemeral key;
- ECDH;
- one-time stealth key;
- view tags.

NULL intentionally does **not** use a normal ERC-5564 transfer announcement as the payroll settlement record.

Reason:

- a standard announcement exposes the stealth address;
- ordinary token transfer exposes amount;
- NULL creates a shielded note, not an ERC-20 transfer to a stealth EOA.

Accurate README wording:

> "NULL uses ERC-5564 scheme-1-compatible stealth key derivation for hidden entitlement authorization, with a NULL-specific constant-size encrypted delivery transport."

Do not claim full announcement compatibility unless implemented.

---

# 20. Recipient Key Model

Recipient maintains:

```text
spendPrivateKey
viewPrivateKey
```

and shares:

```text
spendPublicKey
viewPublicKey
schemeId
```

For every real allocation sender generates fresh `r`:

```text
R = rG
sharedSecret = ECDH(r, viewPublicKey)
stealthPublicKey = ERC5564Derive(spendPublicKey, sharedSecret)
viewTag = ERC5564ViewTag(sharedSecret)
```

Recipient:

```text
sharedSecret = ECDH(viewPrivateKey, R)
stealthPrivateKey = ERC5564Recover(spendPrivateKey, sharedSecret)
```

Fresh `r` MUST be used per allocation.

---

# 21. Internal Note Key Derivation

Do not reuse stealth private key directly as internal note nullifier key.

After a valid entitlement is found, wallet deterministically derives:

```text
ownerNullifierKey =
  HashToField(
    HKDF(
      stealthPrivateKey,
      "null.v1.note-owner" ||
      chainId ||
      poolAddress ||
      distributionCommitment ||
      allocationLeaf
    )
  )

noteSecret =
  HashToField(
    HKDF(
      stealthPrivateKey,
      "null.v1.note-secret" ||
      chainId ||
      poolAddress ||
      distributionCommitment ||
      allocationLeaf
    )
  )
```

Benefits:

- sender cannot derive;
- recipient can recover from base stealth keys + chain history;
- no extra server backup.

`HashToField` must use documented rejection sampling/unbiased mapping.

---

# 22. Allocation Format

Logical private structure:

```text
AllocationV1 {
  stealthPubKeyX: 256 bits
  stealthPubKeyY: 256 bits
  amount: uint64
  leafSalt: field
  flags: uint8
}
```

`flags.bit0 = isReal`.

Constraints:

```text
isReal ∈ {0,1}

if isReal == 1:
  amount > 0

if isReal == 0:
  amount == 0

all unused flag bits == 0
```

Stealth key commitment:

```text
pkCommitment =
  H(
    PK_DOMAIN,
    x_hi128,
    x_lo128,
    y_hi128,
    y_lo128
  )
```

Allocation leaf:

```text
allocationLeaf =
  H(
    ALLOCATION_DOMAIN,
    pkCommitment,
    amount,
    leafSalt,
    flags
  )
```

---

# 23. Dummy Allocation Rules

Dummy slots MUST:

- amount = 0;
- use random salt;
- use a syntactically accepted dummy key representation;
- generate a normal-looking leaf;
- publish a constant-size dummy envelope;
- have no public dummy marker.

Exact dummy-key validation rule must be frozen and tested so public behavior does not distinguish it.

---

# 24. Distribution Format

MVP:

```text
DISTRIBUTION_SLOTS = 8
```

Allocation root:

```text
allocationRoot = MerkleRoot8(allocationLeaf[0..7])
```

Envelope hashes:

```text
envelopeHash[i] = keccak256(serializedEnvelope[i])
envelopeRoot = MerkleRoot8(envelopeHash[0..7])
```

Distribution commitment:

```text
distributionCommitment =
  H(
    DISTRIBUTION_DOMAIN,
    protocolVersion,
    allocationRoot,
    envelopeRoot,
    expiry,
    transportTag
  )
```

P0:

```text
expiry = 0
```

`transportTag` is random public grouping data for envelope transport only.

---

# 25. Global Distribution Accumulator

Every accepted distribution commitment is inserted into a global append-only Merkle tree.

The claim circuit exposes only the **global distribution tree root**.

Private claim witnesses include:

- specific distribution commitment;
- its distribution-tree path/index;
- allocation root;
- allocation leaf/path/index;
- transport tag.

This prevents claims from publicly identifying a payroll batch.

This is a core NULL differentiator.

---

# 26. Shielded Note Model

## 26.1 Treasury Note

Logical hidden values:

```text
TreasuryNoteV1 {
  ownerNullifierKey
  authPolicyCommitment
  amount: uint64
  noteSecret
  leafIndex
}
```

Body:

```text
treasuryBody =
  H(
    TREASURY_NOTE_DOMAIN,
    H(OWNER_KEY_DOMAIN, ownerNullifierKey),
    authPolicyCommitment,
    amount,
    noteSecret
  )
```

Final commitment:

```text
treasuryNoteCommitment =
  H(
    FINAL_NOTE_DOMAIN,
    treasuryBody,
    leafIndex
  )
```

## 26.2 Recipient Private Note

```text
PrivateNoteV1 {
  ownerNullifierKey
  amount: uint64
  noteSecret
  leafIndex
}
```

```text
ownerNullifierKeyHash =
  H(OWNER_KEY_DOMAIN, ownerNullifierKey)

privateNoteBody =
  H(
    PRIVATE_NOTE_DOMAIN,
    ownerNullifierKeyHash,
    amount,
    noteSecret
  )

privateNoteCommitment =
  H(
    FINAL_NOTE_DOMAIN,
    privateNoteBody,
    leafIndex
  )
```

## 26.3 Note Nullifier

```text
noteNullifier =
  H(
    NOTE_NULLIFIER_DOMAIN,
    noteCommitment,
    ownerNullifierKey
  )
```

Must be deterministic per note but unlinkable to the note without secret key.

---

# 27. Shield Treasury Flow

`shield` transfers the configured stablecoin into `NullPool`.

Public:

- depositor transaction;
- amount;
- asset;
- note commitment.

UI MUST state:

> Shielding is a public entry into the private pool. Do not shield the exact payroll amount immediately before payroll if you want stronger sender/amount unlinkability.

Strong mode uses a rolling pre-funded treasury.

---

# 28. Organization Authorization and Privy

## 28.1 Objective

Use a real Privy organization financial-control flow while hiding signer identity from later private distribution calldata.

## 28.2 Registration

Organization creates an auth policy commitment from:

- authorized Privy signer identity/public key;
- policy metadata commitment;
- random registration blinder.

The Privy wallet registers this once.

Registration may reveal the organization uses NULL. Later distribution proofs should not reveal which registered organization authorized them.

## 28.3 Distribution Authorization

1. Finance creates canonical `DistributionIntent`.
2. UI shows summary.
3. Privy organization controls enforce signer/policy/quorum.
4. Authorized signer signs intent.
5. Signature + public key become private circuit witnesses.
6. Circuit verifies ECDSA and private auth-policy membership.
7. Relayer submits proof, not the raw signer signature.

## 28.4 Canonical Intent

Logical:

```text
DistributionIntentV1 {
  chainId
  poolAddress
  protocolVersion
  inputNullifierCommitment
  distributionCommitment
  changeBodyCommitment
  envelopeRoot
  nonce
  validUntil
}
```

Signature binds:

- chain;
- contract;
- distribution;
- envelope set;
- change;
- nonce;
- expiry.

## 28.5 Integration Gate

The team MUST validate that the chosen current Privy API can perform the required real authorization.

If an intended API is unavailable:

- adapt the intent flow;
- preserve real Privy wallet/control usage;
- do not mock the bounty-qualifying financial action.

---

# 29. CreateDistribution Circuit

## 29.1 Purpose

Consume private treasury notes and create:

- one accepted distribution commitment;
- one private treasury change note;
- spent input nullifiers.

Hide:

- organization signer;
- treasury input amount;
- distribution total;
- recipient identities;
- individual allocations.

## 29.2 Arity

```text
MAX_TREASURY_INPUTS = 2
ALLOCATION_SLOTS = 8
CHANGE_OUTPUTS = 1
```

Unused treasury input slot uses constrained phantom form.

## 29.3 Private Witnesses

- treasury notes;
- treasury Merkle paths;
- owner-nullifier keys;
- 8 allocation preimages;
- allocation-tree intermediates;
- change note data;
- auth policy leaf/path;
- Privy public key;
- Privy signature;
- auth blinding;
- real/dummy flags;
- nonce/intent private values.

## 29.4 Public Inputs

Only values needed by contract, e.g.:

- accepted note root;
- accepted auth registry root;
- input nullifiers;
- distribution commitment;
- envelope root/bound commitment;
- change body commitment;
- proof version;
- expiry/chain domain if necessary.

MUST NOT be public:

- salaries;
- salary total;
- employee key;
- stealth key;
- employee identifier;
- organization signer address;
- real recipient count.

## 29.5 Constraints

### Treasury Membership

Each real input proves:

- note membership;
- owner key correctness;
- nullifier correctness.

### Phantom Input

Unused input:

- amount zero;
- explicit phantom flag;
- separate nullifier domain if public phantom marker needed.

### Organization Auth

Prove:

- signer is valid under accepted policy;
- ECDSA signature valid;
- signature covers canonical intent;
- chain/pool/version correct;
- intent not expired.

### Allocations

For every slot:

- boolean real flag;
- amount range;
- real => amount > 0;
- dummy => amount = 0;
- exact leaf recomputation;
- exact Merkle root.

### Conservation

```text
sum(real treasury input amounts)
=
sum(real allocation amounts)
+
change amount
```

### Change

- valid hidden owner;
- amount range;
- exact commitment.

### Distribution Binding

- allocation root correct;
- envelope root authorized;
- transport tag bound;
- distribution commitment exact.

---

# 30. CreateDistribution Contract Flow

Contract:

1. verifies proof;
2. checks accepted roots;
3. rejects used treasury nullifiers;
4. marks input nullifiers;
5. inserts private change note if nonzero;
6. inserts distribution commitment into global distribution tree;
7. emits exactly 8 envelope events;
8. emits no salary/recipient plaintext.

---

# 31. Claim Authorization

The allocation commits a hidden one-time stealth public key.

Recipient proves control inside ZK using a secp256k1 ECDSA signature.

Canonical claim intent:

```text
ClaimIntentV1 {
  chainId
  poolAddress
  protocolVersion
  globalDistributionRoot
  claimNullifier
  privateNoteBodyCommitment
  nonce
  validUntil
}
```

The one-time stealth private key signs this.

The signature MUST bind the output note commitment.

---

# 32. Claim Circuit

## 32.1 Purpose

Prove:

> I control the hidden one-time stealth key for a positive-value allocation inside an accepted distribution, the allocation has one deterministic nullifier, and the private output contains exactly that hidden amount.

## 32.2 Private Witnesses

- distribution commitment;
- distribution-tree path/index;
- allocation root;
- distribution fields;
- allocation preimage;
- allocation path/index;
- amount;
- salt;
- flags;
- stealth pubkey x/y;
- ECDSA signature;
- output ownerNullifierKey;
- output noteSecret;
- nonce/expiry witness fields as needed.

## 32.3 Public Inputs

- accepted global distribution root;
- claim nullifier;
- private note body commitment;
- proof version;
- chain/pool binding;
- valid-until if public.

Not public:

- distribution ID;
- transport tag;
- distribution commitment;
- allocation root;
- allocation index;
- salary;
- stealth public key.

## 32.4 Constraints

### Distribution Membership

Recompute hidden distribution commitment and prove membership in public global tree root.

### Allocation Membership

Recompute hidden allocation leaf and prove membership in hidden allocation root.

### Real Allocation

```text
isReal == 1
amount > 0
```

### Recipient Control

Verify hidden secp256k1 ECDSA signature under hidden stealth public key.

Signature message binds the final output note.

### Claim Nullifier

```text
claimNullifier =
  H(
    CLAIM_NULLIFIER_DOMAIN,
    distributionCommitment,
    allocationLeaf
  )
```

### Amount Preservation

```text
outputPrivateNote.amount
==
allocation.amount
```

---

# 33. Claim Contract Flow

`claim`:

1. verifies proof;
2. validates accepted global distribution root;
3. rejects used claim nullifier;
4. marks nullifier;
5. finalizes/inserts private note commitment;
6. emits:
   - claim nullifier;
   - output note commitment/index/root;
   - version;
7. emits no distribution identifier.

---

# 34. Why the Global Accumulator Matters

Naive claim:

```text
claim(allocationRoot, proof, ...)
```

leaks which payroll batch is being claimed.

NULL:

```text
claim(globalDistributionRoot, proof, ...)
```

Proof privately shows:

```text
allocation ∈ hidden distribution
AND
hidden distribution ∈ global accepted distributions
```

Observer sees:

```text
global root
claim nullifier
output note commitment
proof
```

but not which batch.

This materially enlarges the anonymity set.

---

# 35. Encrypted Envelope Protocol

## 35.1 Requirements

Each slot publishes:

- same event structure;
- same ciphertext length;
- fresh ephemeral key;
- view tag;
- authenticated encryption;
- chain/pool context binding.

## 35.2 Event

Conceptual:

```solidity
event EnvelopePublished(
    bytes32 indexed transportTag,
    uint8 indexed slot,
    uint8 version,
    bytes ephemeralPubKey,
    bytes1 viewTag,
    bytes ciphertext
);
```

`ciphertext.length` is constant for v1.

## 35.3 Encryption

Use a standard audited primitive:

- ECDH shared secret from stealth derivation;
- HKDF-SHA256 for key separation;
- XChaCha20-Poly1305 or another pinned AEAD.

Do not invent encryption.

AAD includes:

- version;
- chain ID;
- pool address;
- transport tag;
- slot.

## 35.4 Encrypted Plaintext

Logical contents:

```text
EnvelopePlaintextV1 {
  magic
  version
  flags
  slotIndex
  chainId
  poolAddress
  transportTag
  distributionCommitment
  allocationRoot
  allocationAmount
  leafSalt
  stealthPublicKey
  allocationMerklePath[3]
  distributionLeafHint
  reservedPadding
}
```

Exact bytes go in `docs/WIRE_FORMAT.md`.

## 35.5 Dummy Envelope

Same public length, random-looking ephemeral key/view tag/ciphertext.

No public dummy flag.

## 35.6 No Plaintext Metadata

Never expose:

- amount;
- employee ID;
- salary type;
- payroll memo.

---

# 36. Envelope Sabotage Boundary

Encryption semantics are not fully proven inside the ZK circuit.

A malicious payer/compiler could construct an undecryptable envelope, causing denial of service.

It cannot use this to redirect funds or inflate value, but it may prevent recovery.

Mitigations:

- deterministic local compiler;
- CRE/local root comparison;
- envelope-root binding in signed intent;
- test vectors;
- preflight;
- future in-circuit delivery verification if practical.

Document this limitation.

---

# 37. The Graph Architecture

## 37.1 Target Prize

**Best Use of Composable or Standardized Graph Products**

## 37.2 Reusable Substreams Module

Repository:

```text
substreams/private-payments/
```

Normalize:

- NULL distribution events;
- NULL envelope events;
- NULL claim/note events;
- ERC-5564 `Announcement` events;

into a reusable privacy event model.

## 37.3 Standard Schema

Conceptual:

```text
PrivatePaymentEnvelope {
  protocol
  chainId
  blockNumber
  txHash
  emitter
  transportTag
  slot
  schemeId
  ephemeralPubKey
  viewTag
  ciphertext
}

PrivateDistribution {
  protocol
  chainId
  blockNumber
  txHash
  commitment
  envelopeRoot
  transportTag
  slotCount
  version
}

PrivateConsumption {
  protocol
  chainId
  blockNumber
  txHash
  nullifier
  outputCommitment
  version
}
```

No decrypted fields.

## 37.4 Composition

Preferred:

1. Substreams parses/normalizes.
2. Standardized Subgraph exposes live entities.
3. NULL SDK consumes live Graph provider data.
4. wallet filters/decrypts locally.

## 37.5 Privacy Rule

Graph queries must not include:

- view key;
- spend key;
- expected salary;
- employee address.

Query broad block ranges; filter locally.

## 37.6 RPC Fallback

```text
eth_getLogs
-> EnvelopePublished
-> local view-tag filter
-> local decrypt
```

Must be tested.

---

# 38. Chainlink CRE Confidential Workflow

## 38.1 Target Prize

**Best Confidential Workflow**

## 38.2 Role

CRE is the **confidential batch compiler**, not custodian.

Sensitive inputs:

- employee identifier;
- amount;
- privacy profile;
- payroll API credential;
- internal routing/configuration.

## 38.3 Suggested Demo

Private authenticated payroll endpoint:

```text
GET /payroll/2026-09
Authorization: Bearer <TEE-only secret>
```

TEE:

1. fetches credential inside enclave;
2. fetches payroll;
3. validates schema;
4. canonicalizes amounts;
5. validates privacy profiles;
6. pads to 8 slots;
7. derives stealth recipients;
8. builds allocation leaves;
9. encrypts envelopes;
10. computes roots;
11. returns only artifacts needed by approved local flow;
12. logs no plaintext salary.

## 38.4 No Custody

CRE must not hold:

- treasury private key;
- recipient spend/view private key;
- unilateral spending authority.

## 38.5 Fallback

Local compiler accepts CSV/JSON.

For deterministic test entropy:

```text
CRE compiled root == local compiled root
```

Mismatch => fail closed.

## 38.6 Sponsor Evidence

Include:

- actual confidential handler;
- successful simulation/deployment;
- logs/evidence;
- explanation of sensitive values inside TEE.

---

# 39. Privy Integration

## 39.1 Target Prize

**Best B2B Financial Product**

## 39.2 Required Use

At least:

- one Privy wallet;
- real organization/business context;
- real payment/treasury flow;
- real policy/signer/quorum/intent control;
- resulting authorization used by NULL protocol.

## 39.3 Flow

```text
Finance
  -> create private distribution
  -> Privy organization
  -> quorum/policy
  -> signed DistributionIntent
  -> private ZK witness
  -> NULL distribution proof
```

## 39.4 Privacy

If feasible, raw signer signature/address is hidden inside proof and relayer is transaction sender.

## 39.5 Failure

Privy outage may block new company actions.

It must not affect:

- existing recipient claims;
- existing private notes;
- chain-level entitlement validity.

---

# 40. Smart Contract System

Expected P0:

```text
NullPool.sol
NullAuthRegistry.sol
CreateDistributionVerifier.sol
ClaimVerifier.sol
Merkle/Poseidon libraries
MockUSDC.sol   # local only
```

P1:

```text
WithdrawVerifier.sol
ReclaimVerifier.sol
```

Contracts SHOULD be immutable/non-proxy.

No admin may:

- replace verifiers;
- seize reserve;
- mark nullifiers;
- redirect notes.

Upgrades use a new version/deployment.

---

# 41. NullPool State

Conceptual:

```solidity
IERC20 immutable ASSET;

uint256 public noteRoot;
uint256 public nextNoteIndex;

uint256 public distributionRoot;
uint256 public nextDistributionIndex;

mapping(uint256 => bool) public spentNoteNullifier;
mapping(uint256 => bool) public spentClaimNullifier;

IVerifier immutable createDistributionVerifier;
IVerifier immutable claimVerifier;
```

Exact types follow field/verifier ABI.

---

# 42. Contract Interfaces

Illustrative:

```solidity
interface INullPool {
    function shield(
        uint64 amount,
        uint256 treasuryNoteBodyCommitment,
        uint256 authPolicyCommitment,
        bytes calldata noteDeliveryData
    ) external;

    function createDistribution(
        bytes calldata proof,
        uint256[] calldata publicInputs,
        EnvelopeV1[8] calldata envelopes
    ) external;

    function claim(
        bytes calldata proof,
        uint256[] calldata publicInputs
    ) external;

    function withdraw(
        bytes calldata proof,
        uint256[] calldata publicInputs
    ) external;
}
```

Final ABI must be generated, not manually duplicated.

---

# 43. Events

Conceptual:

```solidity
event Shielded(
    uint256 indexed noteCommitment,
    uint256 indexed noteIndex,
    uint64 amount
);

event DistributionInserted(
    uint256 indexed distributionCommitment,
    uint256 indexed distributionIndex,
    uint256 postDistributionRoot,
    bytes32 envelopeRoot,
    bytes32 transportTag,
    uint8 version
);

event EnvelopePublished(
    bytes32 indexed transportTag,
    uint8 indexed slot,
    uint8 version,
    bytes ephemeralPubKey,
    bytes1 viewTag,
    bytes ciphertext
);

event AllocationConsumed(
    uint256 indexed claimNullifier,
    uint256 indexed noteCommitment,
    uint256 noteIndex,
    uint256 postNoteRoot,
    uint8 version
);
```

`AllocationConsumed` MUST NOT emit:

- transport tag;
- distribution commitment;
- allocation root.

---

# 44. Root Handling

Append-only trees use latest root where possible.

If accepted root history is necessary for concurrency:

- bounded root history;
- documented size;
- stale-root tests;
- wallet refresh/reprove behavior.

A new distribution must not invalidate older entitlements.

---

# 45. Recipient Scanner

Fast path:

```text
Graph broad query
-> local view-tag filter
-> local ECDH
-> local AEAD decrypt
-> context checks
-> entitlement
```

Fallback:

```text
RPC logs
-> same local scanner
```

After decrypt, validate:

- magic/version;
- chain ID;
- pool;
- transport tag;
- slot;
- derived stealth public key;
- allocation leaf;
- Merkle path/root;
- accepted distribution.

False-positive view tags are normal; failed authenticated decrypt is ignored.

---

# 46. Recipient Claim UX

```text
NULL
Private Inbox

September compensation
Status: Ready to claim

Amount: 4,201.123456 USDC

Privacy
✓ recipient hidden
✓ amount hidden onchain
✓ source distribution hidden

[ Claim privately ]
```

Progress:

```text
Verify entitlement       ✓
Build private note       ✓
Generate proof           ...
Broadcast                ...
Confirm                  ✓
```

Never show a public receiving address for private claim.

---

# 47. Private Balance UX

After claim:

```text
Private balance
4,201.123456 USDC

Public chain can see:
• proof
• nullifier
• note commitment

Public chain cannot see:
• your wallet
• your amount
• your payroll batch
```

P0 actions:

- Keep private
- Export recovery
- Withdraw publicly (boundary warning)

P2:

- Pay privately
- Split/merge
- Selective disclosure

---

# 48. Payroll Application

The payroll UI is a reference app.

Employer sections:

- shielded treasury;
- private import;
- privacy preflight;
- approvals;
- proof generation;
- distribution status.

Example private rows:

```text
Employee | Amount | Privacy profile | Status
Alice    | 4201.123456 | Valid | Ready
Bob      | 7503.654321 | Valid | Ready
Carol    | 3107.777777 | Valid | Ready
Dave     | 9211.222222 | Valid | Ready
```

Employee identifiers must never enter public protocol state.

---

# 49. Privacy Preflight

Before approval show:

```text
Real allocations        4
Padded slots             8
Public employee names    0
Public employee wallets  0
Public salary amounts    0
Envelope size            constant
Treasury source          shielded
Claim source linkage     hidden by global accumulator
```

Button:

```text
Run deterministic verification
```

Distribution must fail closed if verification differs from compiled artifacts.

---

# 50. No-Single-Operational-Point-of-Failure Definition

Absolute "no single point of failure" is impossible: chain consensus, verifier correctness, and user key custody remain foundational.

NULL's precise requirement:

> **No single hosted NULL service or sponsor service may be able to steal recipient funds, learn recipient secrets by design, or make an already published entitlement permanently unclaimable if chain data and recipient keys remain available.**

| Component | Can steal by design? | Private data | Outage effect |
|---|---:|---|---|
| NullPool | security boundary | public state | chain protocol unavailable |
| Verifier | security boundary | none | proof path unavailable |
| Privy | no unilateral claim custody | org auth | new company actions affected |
| CRE | no | TEE payroll input | local compiler fallback |
| The Graph | no | ciphertext + query metadata | RPC fallback |
| Hosted relayer | no | proof + network metadata | self/other relay |
| Hosted frontend | no by design | client secrets in browser only | local build/CLI |
| RPC provider | no | query metadata | switch provider |
| Recipient device | yes if compromised | secrets | endpoint risk |

---

# 51. Relayer Design

Any address may submit proof.

`msg.sender` must not determine recipient ownership.

Relay payload:

```json
{
  "chainId": 11155111,
  "pool": "0x...",
  "method": "claim",
  "proof": "0x...",
  "publicInputs": []
}
```

Must not contain:

- view key;
- stealth private key;
- salary;
- leaf plaintext.

Mutation of output/nullifier/context invalidates proof.

CLI fallback:

```bash
pnpm null claim:broadcast --proof ./claim.json --rpc $RPC_URL
```

---

# 52. Local Storage and Recovery

Recipient secrets:

- long-lived stealth spend private key;
- long-lived stealth view private key.

Never upload.

Use encrypted IndexedDB / WebCrypto where practical.

Do not store raw secrets in `localStorage`.

Recovery process:

1. restore base keys;
2. rescan public envelopes;
3. derive matching one-time stealth keys;
4. derive note owner/nullifier secrets;
5. reconstruct note state.

v1 derivation must remain stable forever for v1 wallets.

---

# 53. Logging and Data Retention

Server MUST NOT persist:

- decrypted payroll;
- recipient keys;
- decrypted envelopes;
- proof private witnesses.

Allowed logs:

- block number;
- proof duration;
- tx hash;
- public root;
- public nullifier;
- public error code.

Forbidden logs:

- salary;
- employee name/email;
- view/spend key;
- stealth private key;
- decrypted envelope;
- leaf salt/path;
- note owner key.

No third-party analytics in hackathon demo.

---

# 54. SDK

Package:

```text
@null-protocol/sdk
```

Recipient:

```ts
createPrivacyProfile()
parsePrivacyProfile()
```

Compiler:

```ts
compileDistribution({
  recipients,
  batchEntropy
})
```

Envelope:

```ts
buildEnvelope()
scanEnvelope()
decryptEnvelope()
```

Proof inputs:

```ts
buildCreateDistributionWitness()
buildClaimWitness()
```

Chain:

```ts
getLatestNoteRoot()
getLatestDistributionRoot()
getDistributionPath()
getNotePath()
isClaimNullifierSpent()
```

Discovery:

```ts
scanWithGraph()
scanWithRpc()
```

Methods accepting secret keys must be marked client-only.

---

# 55. Wire Format

`docs/WIRE_FORMAT.md` MUST define byte-by-byte:

- endianness;
- field canonicalization;
- secp key encoding;
- amount encoding;
- domain constants;
- envelope length;
- AAD;
- signature normalization;
- Merkle left/right rules;
- tree ordering;
- chain/pool binding.

Cross-language vector file:

```text
test/vectors/v1.json
```

Contains:

- privacy profile;
- sender ephemeral key;
- expected view tag;
- expected stealth pubkey;
- encrypted envelope;
- 8 allocation leaves;
- allocation root;
- distribution commitment;
- note commitment;
- note nullifier;
- claim nullifier.

Fixture keys must be clearly marked unsafe.

---

# 56. Independent Reference Model

Add:

```text
tools/reference/null_reference.py
```

Implement independently:

- serialization;
- domain constants;
- allocation leaf;
- Merkle8;
- distribution commitment;
- note commitment;
- claim/nullifier formulas.

No proof generation required.

CI compares:

```text
TypeScript
==
reference model
==
circuit expected outputs
==
Solidity helper values where applicable
```

---

# 57. Repository Structure

```text
null/
├── apps/
│   └── web/
│       ├── employer/
│       ├── recipient/
│       ├── workers/
│       └── e2e/
├── contracts/
│   ├── src/
│   ├── test/
│   │   ├── unit/
│   │   ├── integration/
│   │   ├── fuzz/
│   │   └── invariant/
│   └── script/
├── circuits/
│   ├── create_distribution/
│   ├── claim/
│   ├── shared/
│   └── tests/
├── packages/
│   ├── crypto/
│   ├── protocol/
│   ├── sdk/
│   ├── wallet/
│   ├── contracts/
│   ├── graph-client/
│   └── privacy-audit/
├── services/
│   ├── relayer/
│   └── cre-workflow/
├── substreams/
│   └── private-payments/
├── subgraph/
│   ├── schema.graphql
│   ├── subgraph.yaml
│   └── tests/
├── tools/
│   ├── reference/
│   ├── release-verify/
│   └── vector-gen/
├── test/
│   └── vectors/
├── deployments/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── WIRE_FORMAT.md
│   ├── THREAT_MODEL.md
│   ├── PRIVACY_GUARANTEES.md
│   ├── IMPLEMENTATION_ORDER.md
│   ├── IMPLEMENTATION_STATUS.md
│   ├── DEPLOYMENT.md
│   ├── DEMO_SCRIPT.md
│   ├── SPONSOR_COMPLIANCE.md
│   ├── AI_USAGE.md
│   └── ADR/
├── SECURITY.md
├── CONTRIBUTING.md
├── PRD.md
├── README.md
├── pnpm-workspace.yaml
└── package.json
```

---

# 58. Toolchain Discipline

Pin:

- Node;
- pnpm;
- Foundry;
- Solidity;
- Noir;
- Barretenberg;
- Graph/Substreams tools.

Top-level checks:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm lint
pnpm build
pnpm test
pnpm contracts:test
pnpm contracts:fuzz
pnpm circuits:test
pnpm vectors:verify
pnpm graph:test
pnpm e2e
pnpm privacy:audit
pnpm release:verify
```

---

# 59. Solidity Test Plan

## Shield

- valid deposit;
- zero reject;
- boundary amount;
- token transfer failure;
- note insertion;
- tree capacity.

## Distribution

- valid proof;
- invalid proof;
- public input mutation;
- reused treasury nullifier;
- stale root;
- changed envelope root;
- changed distribution commitment;
- replay;
- wrong chain/pool;
- expired intent.

## Claim

- valid;
- double claim;
- wrong output;
- fake nullifier;
- invalid global distribution root;
- invalid proof;
- note insertion.

## Invariants

- spent nullifier never becomes unspent;
- indices monotonic;
- root changes only via valid insertions;
- reserve cannot leave except defined public withdrawal;
- no admin withdrawal.

---

# 60. Circuit Test Plan

## CreateDistribution Negative Cases

Fail on:

- wrong treasury path;
- wrong owner key;
- changed amount;
- duplicate note;
- zero real allocation;
- nonzero dummy;
- non-boolean flag;
- modified leaf;
- modified salary after root;
- allocations exceed inputs;
- wrong change;
- overflow attempt;
- wrong Privy signer;
- invalid signature;
- modified signed intent;
- wrong auth path;
- changed envelope root;
- changed chain/pool;
- expired intent.

## Claim Negative Cases

Fail on:

- allocation not in tree;
- distribution not in global tree;
- dummy claim;
- changed amount;
- changed stealth pubkey;
- wrong-key signature;
- changed output note;
- changed nullifier;
- wrong chain/pool;
- changed salt;
- changed path/index.

Every private witness type must be explicitly constrained.

---

# 61. Property / Fuzz Testing

SDK properties:

- canonical serialize/parse;
- constant envelope length;
- real/dummy public shape equal;
- canonical ordering deterministic;
- randomized distribution always conserves amount.

Solidity fuzz:

- nullifiers;
- roots;
- proofs;
- envelopes;
- amount bounds;
- replay IDs.

Differential:

```text
TS == Python reference == circuit == Solidity
```

for committed vectors.

---

# 62. `privacy:audit`

MUST exist:

```bash
pnpm privacy:audit
```

Use unique fixture values:

```text
Alice EOA: 0x111111111111111111111111111111111111A11C
Alice salary: 4,201.123456 USDC

Bob EOA: 0x222222222222222222222222222222222222B0B0
Bob salary: 7,503.654321 USDC
```

Inspect:

- distribution calldata/logs;
- claim calldata/logs;
- Graph entities;
- relayer fixture payload;
- optional browser network capture.

Search for:

- raw/checksummed/lowercase addresses;
- salary decimal;
- 8-byte LE/BE salary;
- 32-byte ABI salary;
- employee identifiers;
- raw stealth keys;
- secret fixture keys.

This is a metadata regression test, not proof of anonymity.

---

# 63. Metadata Leakage Tests

Must prove:

- 8 envelope events always;
- ciphertext length identical;
- ephemeral key format identical;
- no public dummy flag;
- no amount outside encryption;
- claim event does not identify distribution;
- Graph schema never emits decrypted/derived private fields.

---

# 64. Fault Injection

## Graph Down

Expected: RPC scanner works.

## Hosted Relayer Down

Expected: self/alternate broadcast works.

## CRE Down

Expected: local compiler can create new batch; existing claims unaffected.

## Hosted UI Down

Expected: local build/CLI can scan/claim.

## RPC Provider Down

Expected: switch provider.

---

# 65. Performance Targets

Hackathon targets:

| Operation | Target |
|---|---:|
| Graph query | <2s typical |
| Demo-range RPC scan | <10s |
| Scan 1,000 envelopes | <1s local |
| Envelope decrypt | <100ms |
| Claim witness | <2s |
| Claim proof | <15s modern desktop |
| 8-slot distribution proof | <30s dev laptop |
| EVM verification | practical Sepolia gas |

Record real hardware and real measurements.

If browser proving is too slow:

- keep witness local;
- use Web Worker;
- optionally native local prover for employer;
- do not move private witnesses to hosted prover.

---

# 66. Frontend Requirements

Suggested:

- React;
- TypeScript;
- Vite or client-first Next;
- viem;
- Privy SDK.

Privacy work SHOULD execute in Web Worker.

Private values must never enter:

- URL query;
- route parameter;
- analytics event;
- server action payload.

---

# 67. P0 Screens

1. Landing.
2. Organization setup.
3. Shield treasury.
4. Import payroll.
5. Privacy preflight.
6. Privy approvals.
7. Distribution proof progress.
8. Distribution success/explorer.
9. Recipient setup.
10. Private inbox.
11. Claim progress.
12. Private balance.
13. Privacy inspector.
14. Protocol/dev live state.

---

# 68. Privacy Inspector

High-value demo screen:

```text
PUBLIC CHAIN DATA
✓ distribution commitment
✓ encrypted envelopes
✓ proof
✓ claim nullifier
✓ private-note commitment

NOT PUBLIC
✗ Alice
✗ alice.eth
✗ Alice wallet
✗ stealth public key
✗ 4,201.123456 USDC
✗ allocation slot
✗ source distribution of claim
```

---

# 69. Developer Protocol Screen

Show public-only:

- current note root;
- current distribution root;
- note count;
- distribution count;
- latest events;
- Graph sync status;
- RPC fallback status;
- verifier addresses;
- deployment hash;
- version.

---

# 70. Security UX

Label:

- public shield entry;
- public withdrawal exit;
- view-key export;
- plaintext payroll copy.

Never show "private" solely because a stealth address exists.

---

# 71. Sponsor Fit

## Privy

Load-bearing role:

- organization wallet;
- business governance;
- approvals;
- signed financial authorization.

Demo:

- policy/quorum;
- approval;
- authorization used in proof.

## Chainlink

Load-bearing role:

- protected payroll API credential;
- confidential payroll rows;
- confidential route/commitment compilation.

Demo:

- TEE workflow;
- protected input;
- successful run;
- batch artifact.

## The Graph

Load-bearing role:

- live envelope discovery;
- standardized schema;
- reusable Substreams module.

Demo:

- live data;
- recipient scans indexed ciphertext;
- RPC fallback.

---

# 72. Why ENS Is Not a P0 Prize Target

ENS is a natural privacy-profile adapter, but ETHOnline permits only three partner selections.

P0 prioritizes:

1. Privy;
2. Chainlink;
3. The Graph.

ENSv2 can be a post-P0 adapter after release gates are green.

Do not dilute core execution to chase a fourth sponsor.

---

# 73. ArcBook-Level Engineering Standard

NULL aims for the same **quality pattern** seen in strong finalist projects:

- a real primitive;
- deterministic semantics;
- custom protocol logic;
- typed SDK;
- live deployment;
- live indexer;
- independent reference model;
- fuzz/adversarial tests;
- exact wire format;
- generated ABIs;
- deployment manifest;
- release verifier;
- implementation-status documentation;
- short high-signal demo.

Repository should look credible without the UI.

---

# 74. Release Verification

Command:

```bash
pnpm release:verify
```

Fail if:

- app URL is localhost/private;
- contract bytecode absent;
- deployment manifest mismatch;
- verifier missing/mismatched;
- Graph endpoint unreachable;
- Graph not synced;
- seeded distribution absent;
- seeded claim absent;
- RPC fallback fails;
- privacy audit fails;
- fixture salary/address leaked.

---

# 75. Deployment Manifest

Example:

```json
{
  "protocolVersion": "0.1.0",
  "chainId": 11155111,
  "asset": {
    "symbol": "USDC",
    "address": "0x..."
  },
  "contracts": {
    "nullPool": "0x...",
    "nullAuthRegistry": "0x...",
    "createDistributionVerifier": "0x...",
    "claimVerifier": "0x..."
  },
  "graph": {
    "subgraph": "...",
    "substreamsPackage": "..."
  },
  "build": {
    "gitCommit": "...",
    "circuitVersion": "...",
    "verifierHash": "..."
  }
}
```

No duplicated hard-coded addresses.

---

# 76. CI

PR:

1. format;
2. typecheck;
3. lint;
4. units;
5. circuit tests;
6. Foundry;
7. fuzz/invariants;
8. vectors;
9. Graph tests;
10. privacy fixtures;
11. build.

Release:

- live testnet integration;
- Graph live query;
- public release verification.

---

# 77. Git/Hackathon Compliance

Need:

- clear commit history;
- no final-day monolith;
- dependency attribution;
- AI usage documentation;
- all specs/prompts retained if using spec-driven AI;
- new vs reused work clearly documented.

Suggested commits:

```text
chore: initialize null monorepo and toolchain
docs: define privacy invariants and wire model
feat(crypto): domain constants and vector generator
feat(circuits): allocation and merkle primitives
feat(contracts): note and distribution accumulators
feat(circuits): create distribution proof
feat(circuits): private claim proof
feat(sdk): stealth envelope compiler and scanner
feat(graph): private payments substreams module
feat(graph): standardized subgraph
feat(privy): organization authorization
feat(cre): confidential batch compiler
feat(web): employer workflow
feat(web): recipient private inbox
test: privacy audit and fault injection
chore: public deployment and release verifier
docs: demo and sponsor compliance
```

---

# 78. Implementation Order

## Gate 0 — Spec Freeze

Freeze:

- domains;
- bytes;
- hash;
- amount type;
- slot count;
- public/private proof inputs.

Exit: v1 vector committed.

## Gate 1 — Crypto Kernel

- allocation;
- Merkle8;
- note;
- nullifier;
- distribution;
- stealth vectors.

Exit: TS == reference.

## Gate 2 — Claim Proof First

Validate hidden secp auth and global distribution membership early.

Exit:

- valid proof EVM-verifies;
- wrong key/amount/root fails.

## Gate 3 — Distribution Proof

Exit:

- private conservation;
- private auth;
- dummies;
- verifier deployed.

## Gate 4 — Contracts

Local:

```text
shield -> distribution -> claim
```

## Gate 5 — Envelope/Scanner

Recipient discovers only their allocation.

## Gate 6 — The Graph

Live provider + standardized schema + app consumption.

## Gate 7 — Privy

Real org control feeds proof.

## Gate 8 — CRE

Real confidential handler + local fallback.

## Gate 9 — UX

Complete judge path.

## Gate 10 — Security/Release

All blockers green.

---

# 79. Hackathon Schedule

Deadline: **Sunday, September 13, 2026 at 12:00 PM EDT / 9:30 PM IST**.

## Sep 5

- freeze PRD;
- initialize repo;
- pin tools;
- test-vector format;
- Noir hidden secp verification + Solidity verifier spike.

**Kill gate:** if hidden secp verification is impractical, redesign immediately before app work.

## Sep 6

- crypto primitives;
- Merkle;
- note/nullifier;
- reference model;
- claim circuit.

## Sep 7

- claim verifier;
- accumulators;
- local claim;
- negative tests.

## Sep 8

- distribution circuit;
- conservation;
- 8-slot padding;
- envelope binding;
- local E2E.

## Sep 9

- encryption;
- scanner;
- RPC recovery;
- privacy audit v1.

## Sep 10

- Substreams;
- Subgraph;
- live indexing;
- Graph inbox.

## Sep 11

- Privy;
- CRE;
- sponsor evidence.

## Sep 12

- UI polish;
- fuzz;
- fault injection;
- public deploy;
- release verifier;
- record demo.

## Sep 13

- bug fixes only;
- final verify;
- submit with margin.

---

# 80. Scope Control

## P0 MUST

- single asset;
- 8 slots;
- hidden amount;
- hidden recipient key;
- global distribution accumulator;
- private claim;
- encrypted envelopes;
- Graph + RPC fallback;
- Privy authorization;
- CRE confidential workflow;
- public deployment;
- privacy/security tests.

## P1 SHOULD

- public withdrawal;
- reclaim;
- selective disclosure;
- improved recovery UI;
- multi-relayer.

## P2 FUTURE

- multiasset;
- larger batch;
- private transfers;
- split/merge;
- recurring distribution;
- ENSv2;
- cross-chain;
- companion ERC.

No P1 work until P0 security gates pass.

---

# 81. Reclaim Design — P1

Non-expiring P0 is safer than half-correct reclaim.

Future reclaim:

- distribution commits expiry and recovery auth;
- after expiry employer privately proves recovery authorization;
- reclaims one unconsumed allocation at a time;
- uses same allocation nullifier as recipient claim;
- first valid consumption wins;
- amount remains hidden;
- output returns to private treasury note.

Must test recipient-vs-reclaim race.

---

# 82. Selective Disclosure — P1

Recipient may prove:

- exact compensation by consent;
- `amount >= X`;
- paid during period;
- valid entitlement.

Must not reveal:

- other notes;
- other employers;
- total balance;
- wallet history.

---

# 83. Compliance Boundary

Base protocol does not encode a jurisdiction-specific compliance system.

App layer may provide:

- employer-side KYC;
- encrypted audit export;
- selective disclosure;
- policy constraints.

Never publish employee identity in commitments "for compliance."

---

# 84. Risk Register

| Risk | Severity | Mitigation |
|---|---:|---|
| Circuit underconstraint | Critical | negative tests, review, vectors |
| Verifier mismatch | Critical | verifier hash in manifest |
| Double claim | Critical | deterministic nullifier |
| Inflation | Critical | conservation constraints |
| Wrong envelope | High | preflight + root binding |
| Metadata leak | High | fixed size + privacy audit |
| Public salary leak | Critical | release blocker |
| Public recipient leak | Critical | no address public input |
| Claim/batch link | High | global accumulator |
| Relayer substitution | Critical | output bound |
| Privy signature leak | High | hidden in proof |
| CRE custody creep | High | no keys/funds |
| Graph privacy oracle | High | local filtering |
| Funding timing correlation | High | rolling treasury |
| Exact withdrawal correlation | High | explicit boundary |
| Browser supply chain | Critical | CSP/lockfile/no analytics |
| Key loss | High | deterministic recovery/export |
| Proof too slow | Medium | benchmark early, 8-slot scope |
| Gas too high | Medium | benchmark verifier early |

---

# 85. Prohibited Shortcuts

MUST NOT:

1. transfer USDC directly to a stealth EOA and call amounts private;
2. put salary in reversible public encoding;
3. send view key to Graph;
4. send private proof witness to hosted prover;
5. publish `keccak(employeeAddress)` as if that solved address privacy;
6. expose a specific distribution root in claim;
7. expose raw Privy signer in distribution if private-auth claim is made;
8. publish variable-size real/dummy envelopes;
9. mock bounty-qualifying integrations;
10. skip circuit negative tests;
11. add admin seizure path;
12. say "untraceable" or "anonymous" without qualification;
13. depend on localhost in release;
14. squash project into one final commit;
15. use undocumented proof setup assumptions.

---

# 86. Release Blockers

- [ ] salary appears in private-flow public data
- [ ] recipient address appears
- [ ] stealth public key appears in plaintext
- [ ] claim reveals specific distribution
- [ ] envelope sizes differ
- [ ] view/spend keys leave recipient environment
- [ ] relayer can change output
- [ ] double claim succeeds
- [ ] invalid amount proof succeeds
- [ ] Graph is sole recovery path
- [ ] CRE required for old claim
- [ ] Privy only used for login
- [ ] CRE confidential handler is placeholder
- [ ] Graph data is mocked/static
- [ ] no public deployment
- [ ] README overclaims privacy
- [ ] deployment manifest missing
- [ ] test vectors disagree
- [ ] public app depends on localhost
- [ ] security warning missing

---

# 87. Demo Script

## 0:00–0:15 — Hook

> "Onchain payroll normally publishes a permanent financial graph: who got paid, where, when, and how much. NULL turns payroll into a private distribution. Ethereum verifies the value without learning the employee, salary, receiving address, or even which distribution a later claim came from."

## 0:15–1:00 — Employer

Show:

- 4 employees;
- different amounts;
- 8-slot padding;
- CRE confidential compile;
- Privy approval/quorum.

## 1:00–1:45 — Publish

Execute via relayer.

Open explorer.

Highlight:

- distribution commitment;
- exactly 8 encrypted envelopes;
- no employee EOA;
- no salary;
- no token transfers to recipients.

## 1:45–2:35 — Recipient

Separate Alice profile:

- Graph scan;
- local view-tag filter;
- decrypt;
- private entitlement;
- claim proof;
- relayed claim;
- private balance.

## 2:35–3:10 — Explorer Money Shot

Show claim tx.

Ask:

- Which employee?
- How much?
- Which payroll distribution?
- What receiving address?

Public only:

- global root;
- nullifier;
- proof;
- note commitment.

## 3:10–3:35 — Resilience

Disable Graph or switch to RPC fallback.

> "Graph makes discovery fast but never receives the viewing key and is not required for recovery."

## 3:35–3:55 — Close

> "Payroll is the first app. NULL is reusable private distribution infrastructure for grants, contributor payouts, airdrops, revenue sharing, and any batch payment where Ethereum should verify value without publishing the recipient graph."

---

# 88. Partner Evidence Checklist

## Privy

- organization wallet visible;
- policy/quorum;
- real approval;
- signature/authorization feeds ZK proof;
- resulting state change.

## Chainlink

- confidential workflow code;
- TEE handler;
- protected credential/input;
- successful simulation/deploy;
- confidential batch result.

## The Graph

- reusable Substreams module;
- standardized schema;
- live endpoint;
- app query;
- live inbox discovery;
- RPC fallback.

---

# 89. Finalist Rubric Mapping

## Technicality

- hidden-value conservation;
- hidden secp auth;
- two Merkle layers;
- nullifiers;
- encrypted delivery;
- local proof generation;
- standardized indexing;
- private business authorization.

## Originality

Not "private payroll."

New primitive:

- private distribution commitments;
- hidden entitlement claim;
- claim-to-distribution anonymity set;
- hidden stealth recipient authorization.

## Practicality

- business UI;
- recipient UI;
- public testnet;
- real sponsor services;
- fallback;
- deployment runbook.

## Usability

Users see:

- salary;
- approval;
- inbox;
- claim.

They do not manage addresses or Merkle proofs.

## WOW

The explorer visibly lacks the exact information a normal payroll transaction would expose.

---

# 90. README Positioning

Opening:

> **NULL is a private distribution protocol for Ethereum.**
>
> A payer converts shielded treasury notes into a fixed-size committed distribution. Recipients discover encrypted entitlements using stealth-compatible viewing keys and privately prove ownership of one allocation. Claims create shielded notes while hiding the recipient, individual amount, allocation index, and source distribution from public chain data.
>
> Payroll is the reference application; the primitive generalizes to grants, contributor payouts, revenue sharing, airdrops, and other private batch settlement.

Immediately add:

> **Security:** Hackathon prototype. Not audited. Do not use with real funds.

---

# 91. Allowed Public Claims

Only if tests pass:

- individual amounts are private proof inputs;
- recipient stealth public keys are not emitted plaintext;
- claims expose no specific distribution identifier;
- scan/decrypt is local;
- Graph receives public ciphertext only;
- relayer cannot alter committed private output;
- CRE does not custody funds;
- existing claims do not depend on CRE;
- RPC fallback exists.

---

# 92. Forbidden Marketing Claims

Do not say:

- untraceable;
- perfectly anonymous;
- zero metadata;
- hides all sender activity;
- prevents all timing analysis;
- cannot be censored;
- production secure;
- audited;
- implements EIP-8182 unless actually conformant;
- fully ERC-5564 compliant if not using standard announcement behavior.

---

# 93. EIP-8182 Relationship

As of this document date, EIP-8182 is in **Review** and proposes private ETH/ERC-20 transfers using shielded notes, commitments, nullifiers, private auth concepts, fixed phantom/dummy slots, and output-note data.

It explicitly states end-to-end privacy still needs complementary infrastructure such as:

- note delivery;
- wallet integration;
- mempool encryption;
- network anonymity.

NULL is **inspired by**:

- hidden note ownership;
- commitments/nullifiers;
- private transfer fields;
- fixed dummy/phantom slots;
- private auth;
- companion note delivery.

NULL v0.1 is **not** EIP-8182.

Long-term:

> NULL can become a private distribution and note-delivery layer targeting a canonical shielded pool if a standard such as EIP-8182 matures.

---

# 94. Standardization Opportunity

After P0, draft:

```text
NULL Private Envelope Format v1
```

Goals:

- fixed-size encrypted allocation/note delivery;
- stealth key separation;
- public indexability without view key;
- compatibility with multiple private-note systems.

The Graph schema is the first implementation.

No formal ERC work before core hackathon release gates.

---

# 95. Query Privacy

Even local view keys can be undermined by recipient-specific queries.

Wallet SHOULD:

- query broad block ranges;
- fetch multiple envelopes;
- cache locally;
- optionally pad ranges;
- support multiple providers;
- never query server "viewTag=X".

View-tag filtering remains client-side.

---

# 96. Front-Running Analysis

An attacker can copy a claim transaction.

Expected:

- first valid identical submission may land;
- copied replay fails due to nullifier;
- output note still belongs to intended recipient;
- attacker cannot substitute own output.

Transaction copying must never steal value.

---

# 97. Recipient Correlation Analysis

### Amount

Hidden in claim.

### Address

No recipient EOA used.

### Stealth key

Hidden inside allocation/envelope plaintext.

### Distribution source

Hidden by global accumulator.

### Timing

Not fully hidden.

Mitigate with delay + relayer + accumulator.

### Withdrawal

Can reintroduce correlation.

Explicit boundary.

---

# 98. Sender Correlation Analysis

Distribution should be relayed.

Organization authorization is private proof witness.

Remaining correlations:

- earlier pool deposit;
- timing;
- unique deposit size;
- small anonymity set.

Strong mode uses pre-funded rolling treasury.

---

# 99. Batch Count Leakage

One distribution reveals:

```text
0 <= real recipients <= 8
```

Exact count hidden by dummies.

Multiple batches reveal a rough range.

Accepted P0 tradeoff.

---

# 100. Amount Correlation Guidance

Do not:

- shield exact payroll sum immediately before distribution;
- publicly withdraw exact salary immediately after claim;
- expose payroll total via unauthenticated app endpoint.

Recommended:

- rolling treasury;
- delayed exit;
- future private split/merge.

---

# 101. Privacy Profile Delivery

P0:

- employee provides stealth meta-address through private HR channel.

No public onchain identity/profile registry required.

Future:

- ENSv2 permissioned profile;
- dedicated registry.

This keeps public identity linkage minimal.

---

# 102. Canonical Payroll Input

```ts
type PayrollRecipientV1 = {
  employeeRef: string;        // confidential
  amountAtomic: bigint;       // uint64
  stealthMetaAddress: string; // confidential business data
};
```

`employeeRef` never enters public cryptographic state.

---

# 103. Canonical Ordering

Before padding:

- normalize;
- deterministically sort by confidential salted key;
- do not sort by salary;
- do not preserve HR order if it leaks hierarchy.

Then shuffle slots using batch entropy.

Exact algorithm in wire/compiler spec so CRE/local compiler match.

---

# 104. Randomness

CSPRNG required for:

- stealth ephemeral scalar;
- leaf salt;
- transport tag;
- treasury note secret;
- auth blinding;
- shuffle seed;
- intent nonce.

Never:

- `Math.random()`;
- timestamp-only;
- block-number-only;
- employee ID as salt.

Fixture-only deterministic RNG must be explicit and impossible to confuse with release mode.

---

# 105. Secret Handling

JavaScript cannot guarantee memory zeroization.

Still:

- use `Uint8Array`;
- overwrite when practical;
- keep scope short;
- use worker;
- never stringify/log keys.

Do not claim guaranteed zeroization.

---

# 106. Frontend Supply Chain

Hosted app SHOULD:

- strict CSP;
- no third-party scripts;
- no analytics;
- pinned lockfile;
- source commit hash visible;
- build/version page.

Future: reproducible builds.

---

# 107. Relayer Service

Stateless endpoint:

```text
POST /api/relay
```

Validate:

- chain/pool allowlist;
- method;
- payload size;
- rate limit.

No recipient login required.

---

# 108. Graph Privacy Review

Every field classified:

- public required;
- public convenience;
- forbidden private.

Questions:

- does field create extra correlation?
- is recipient-specific query unnecessary?
- is anything decrypted server-side?
- are transaction sender correlations being unnecessarily surfaced?

---

# 109. CRE Privacy Review

Before submission inspect:

- workflow logs;
- CLI output;
- errors;
- serialized output.

No plaintext salary in logs.

---

# 110. Error Model

Stable codes:

```text
NULL_ROOT_STALE
NULL_PROOF_INVALID
NULL_NULLIFIER_SPENT
NULL_ENVELOPE_DECRYPT_FAILED
NULL_CONTEXT_MISMATCH
NULL_PROFILE_INVALID
NULL_PRIVY_AUTH_FAILED
NULL_CRE_COMPILE_MISMATCH
NULL_GRAPH_UNAVAILABLE
NULL_RPC_UNAVAILABLE
NULL_PRIVACY_AUDIT_FAILED
```

Never include hidden values in error strings.

---

# 111. Fail-Closed Rules

Stop distribution if:

- CRE root != local root;
- envelope count != 8;
- envelope lengths differ;
- profile invalid;
- amount out of range;
- Privy intent != compiled commitment;
- chain root changed and proof stale;
- verifier/manifest mismatch.

No "continue anyway" for privacy mismatches.

---

# 112. Concurrency

Distribution:

- note root changed -> rebuild path -> reprove.

Claim:

- distribution root changed -> refresh path -> prove latest accepted root.

New distributions must not invalidate old allocations.

---

# 113. Finality

Scanner shows:

- seen;
- confirmed.

Confirmation threshold configurable.

Do not mark final before threshold.

---

# 114. Proof Artifacts

Version/checksum:

- circuit source;
- proving artifacts;
- verification key;
- Solidity verifier;
- circuit hash.

If large artifacts are external, provide deterministic build instructions and checksums.

---

# 115. Circuit Versioning

Proof target includes:

```text
protocolVersion = 1
circuitId = CREATE_DISTRIBUTION_V1 / CLAIM_V1
```

Never silently change semantics at same version.

---

# 116. Replay Protection

Intent includes:

- chain;
- pool;
- purpose/domain;
- nonce;
- expiry;
- finalized output commitment.

Authorization must not work cross-chain or cross-contract.

---

# 117. Private Note Roadmap

P0 ends with private note.

Future:

### Re-randomize

1 input -> 1 new self note.

### Split

1 input -> 2 private notes.

### Merge

2 inputs -> 1 private note.

### Private Pay

private notes -> another recipient's private note.

Deferred to protect scope.

---

# 118. Explorer Expectations

Distribution:

```text
from: relayer
to: NullPool
method: createDistribution

public:
- proof
- input nullifiers
- distribution commitment
- encrypted envelopes
- root transition

absent:
- employee
- salary
- employee wallet
- stealth public key
```

Claim:

```text
from: relayer
to: NullPool
method: claim

public:
- global distribution root
- proof
- claim nullifier
- private note commitment

absent:
- distribution ID
- allocation root
- employee
- salary
- stealth key
```

---

# 119. Judge Q&A

## "Is this a mixer?"

NULL is a private distribution primitive with recipient-specific entitlements and business authorization, not arbitrary anonymous deposit/withdraw UX.

## "Why stealth + ZK?"

Stealth derivation solves non-interactive one-time recipient authorization/delivery. ZK hides entitlement membership, amount, source distribution, and enforces value conservation.

## "Why not ERC-5564 direct payment?"

A normal token transfer still exposes amount and public one-time destination. NULL commits both privately and creates a shielded note.

## "Can employer steal?"

Employer knows one-time public key but not one-time stealth private key or recipient internal note secret.

## "Can relayer steal?"

No. Output commitment is proof/signature-bound.

## "Does Graph know Alice?"

No. It sees public ciphertext. View key stays local.

## "What if Graph is down?"

Raw RPC scan.

## "What if CRE is down?"

Use local compiler; old claims unaffected.

## "What remains public?"

Pool entry, distribution existence/timing, fixed ciphertext, proof/nullifier/note commitments, and public exit.

---

# 120. Metrics

Technical:

- proof time;
- verification gas;
- envelope scan throughput;
- Graph lag;
- RPC fallback time;
- circuit tests;
- fuzz iterations;
- privacy audit leaks = zero.

Product:

- import-to-approved-distribution time;
- inbox-to-discovery time;
- clicks to claim;
- manual cryptographic fields exposed to normal user = zero.

---

# 121. Post-Hackathon Security Work

Before real assets:

- circuit review;
- Solidity audit;
- cryptography review;
- proof setup review;
- key-management audit;
- browser threat review;
- invariant/formal analysis;
- public testnet period;
- bug bounty;
- compliance/legal review.

---

# 122. Open Technical Decisions / ADRs

Resolve:

1. exact Noir/Barretenberg versions;
2. exact ZK hash;
3. incremental Merkle implementation;
4. envelope AEAD library;
5. browser proving integration;
6. exact Privy control/signing primitive;
7. Graph deployment topology;
8. body/final note commitment finalization;
9. accepted root history;
10. expiry/reclaim activation.

No unresolved decision may silently alter privacy invariants.

---

# 123. Kill Criteria

Pivot/scope down if early:

- hidden secp verification is impractical;
- verifier integration unstable;
- claim cannot hide specific distribution;
- local proving unreliable.

Fallback priority:

1. preserve hidden amount;
2. preserve hidden recipient;
3. preserve global distribution membership;
4. reduce batch from 8 to 4 only if required;
5. native local employer prover acceptable;
6. do **not** fall back to direct ERC-20 stealth transfers while claiming equivalent privacy.

---

# 124. ETHGlobal Submission Checklist

- [ ] public repo
- [ ] fresh-build rules respected
- [ ] healthy commit history
- [ ] AI use documented
- [ ] 2–4 min video
- [ ] live demo
- [ ] finalist + partner prize mode
- [ ] no localhost dependencies
- [ ] source available

Partner selections:

- [ ] Privy
- [ ] Chainlink
- [ ] The Graph

Security:

- [ ] SECURITY.md
- [ ] not-audited warning
- [ ] no real funds
- [ ] privacy audit passes

---

# 125. Partner Qualification Checklist

## Privy — Best B2B Financial Product

- [ ] Privy core
- [ ] Privy wallet
- [ ] business use case
- [ ] functional payment/approval/treasury flow
- [ ] policy/signer/quorum/intent control
- [ ] working demo
- [ ] source
- [ ] clear value explanation

## Chainlink — Best Confidential Workflow

- [ ] CRE workflow
- [ ] actual confidential TEE handler
- [ ] sensitive input inside enclave
- [ ] core integration
- [ ] successful simulation/deployment
- [ ] evidence captured

## The Graph — Best Use of Composable or Standardized Graph Products

- [ ] reusable standardized/composable module
- [ ] live provider data
- [ ] non-trivial composition/standardization
- [ ] standards leverage demonstrated
- [ ] public repo
- [ ] demo
- [ ] live scanner uses Graph

---

# 126. Definition of Done

A fresh judge can:

1. open public app;
2. understand problem in <30 seconds;
3. see real business-controlled private distribution;
4. inspect explorer and fail to find employee address/amount;
5. open separate recipient;
6. discover entitlement from encrypted public data;
7. create local proof;
8. relay claim;
9. see private note balance;
10. inspect claim and fail to identify source distribution;
11. inspect repo and find:
    - protocol spec;
    - circuits;
    - contracts;
    - Graph module;
    - CRE workflow;
    - Privy integration;
    - tests;
    - vectors;
    - release verifier.

---

# 127. Future Vision

```text
NULL Core
├── private distributions
├── hidden entitlement claims
├── recovery/reclaim
└── versioned verifier deployments

NULL Envelope
├── stealth-compatible encrypted delivery
├── fixed-size wire format
└── local scanning

NULL Index
├── reusable Substreams
├── standardized privacy schema
└── multi-chain scanning

NULL SDK
├── profiles
├── compile
├── scan
├── decrypt
├── prove
└── relay

Apps
├── Payroll
├── Grants
├── Airdrops
├── Revenue Share
├── Contributors
└── Private B2B Payouts
```

Long-term, NULL should become a distribution/delivery primitive that can sit on top of a canonical Ethereum private-transfer layer rather than requiring every app to bootstrap its own privacy ecosystem.

---

# 128. References and Current External Constraints

Checked on 2026-09-05.

## ETHOnline 2026

Event details, submission deadline, demo length, judging criteria, 3-partner selection limit:

https://ethglobal.com/events/ethonline2026/info/details

Prizes:

https://ethglobal.com/events/ethonline2026/prizes

Current relevant sponsor facts:

- The Graph's standardized/composable track rewards reusable standardized schemas/composable Substreams and requires live Graph-provider data.
- Privy's B2B financial-product track explicitly includes payroll/treasury and requires a real Privy wallet, business workflow, and control.
- Chainlink's Confidential Workflow track requires a meaningful CRE Confidential Workflow with a TEE handler and sensitive data processed inside it.

## ArcBook Quality Reference

Showcase:

https://ethglobal.com/showcase/arcbook-twp2a

Source:

https://github.com/Ryad2/liquid_OB

Used only as an engineering-quality reference: protocol primitive, live stack, testing, indexing, reference model, docs, release verification.

## ERC-5564

https://eips.ethereum.org/EIPS/eip-5564

Important:

- spending/viewing key separation;
- secp256k1 scheme 1;
- view tags;
- standard announcer publicly emits stealth address/caller/ephemeral key/metadata.

## EIP-8182

https://eips.ethereum.org/EIPS/eip-8182

Status at time of writing: Review.

Important inspiration:

- shielded UTXO-like notes;
- note commitments;
- nullifiers;
- private transfer values/recipients;
- auth-policy separation;
- fixed dummy/phantom slots;
- output note data;
- note delivery/wallet/network privacy explicitly left as complementary infrastructure.

## Noir secp256k1 ECDSA

https://noir-lang.org/docs/noir/standard_library/cryptographic_primitives/ecdsa_sig_verification/

Exact library/tool versions must be pinned and benchmarked.

---

# Appendix A — Core State Machine

```text
PUBLIC SHIELD
============
Privy treasury
    |
    | public deposit
    v
NullPool
    |
    +--> hidden treasury note


PRIVATE DISTRIBUTION
====================
treasury note(s)
    |
    | ZK:
    | - membership
    | - owner secret
    | - Privy auth
    | - allocations
    | - value conservation
    v
input nullifiers ---------------------- public
distribution commitment ------------- public
private change note ----------------- public commitment
8 encrypted envelopes --------------- public ciphertext

employee identities ----------------- private
individual amounts ------------------ private
stealth keys ------------------------ private


PRIVATE CLAIM
=============
encrypted envelope
    |
    | local decrypt
    v
allocation witness + stealth key
    |
    | ZK:
    | - distribution in global tree
    | - allocation in distribution
    | - hidden ECDSA ownership
    | - exact hidden amount to note
    v
claim nullifier ---------------------- public
private note commitment ------------- public

employee ---------------------------- hidden
amount ------------------------------ hidden
source distribution ----------------- hidden
stealth public key ------------------ hidden
```

---

# Appendix B — CreateDistribution Pseudocode

```text
proveCreateDistribution(w):

    assert w.chainId == EXPECTED_CHAIN
    assert w.poolAddress == EXPECTED_POOL

    totalIn = 0

    for input in treasuryInputs[0..1]:
        if input.isReal:
            assert MerkleMember(
                input.noteCommitment,
                input.path,
                public.noteRoot
            )

            expectedNullifier =
                H(
                    NOTE_NULLIFIER_DOMAIN,
                    input.noteCommitment,
                    input.ownerNullifierKey
                )

            assert expectedNullifier
                == public.inputNullifier[input.index]

            totalIn += input.amount

        else:
            assert input.amount == 0
            assert PhantomConstraints(input)

    assert PrivateOrgAuth(
        w.authPolicy,
        w.privyPublicKey,
        w.privySignature,
        w.distributionIntent
    )

    totalAllocated = 0

    for slot in allocation[0..7]:
        assert slot.isReal in {0,1}

        if slot.isReal:
            assert slot.amount > 0
        else:
            assert slot.amount == 0

        leaf[slot] = AllocationLeaf(slot)
        totalAllocated += slot.amount

    allocationRoot = MerkleRoot8(leaf)

    assert totalIn
        == totalAllocated + w.changeAmount

    computedDistribution =
        H(
            DISTRIBUTION_DOMAIN,
            VERSION,
            allocationRoot,
            public.envelopeRoot,
            w.expiry,
            w.transportTag
        )

    assert computedDistribution
        == public.distributionCommitment

    computedChange =
        PrivateNoteBody(
            w.changeOwner,
            w.changeAmount,
            w.changeSecret
        )

    assert computedChange
        == public.changeBodyCommitment
```

---

# Appendix C — Claim Pseudocode

```text
proveClaim(w):

    distributionCommitment =
        H(
            DISTRIBUTION_DOMAIN,
            w.version,
            w.allocationRoot,
            w.envelopeRoot,
            w.expiry,
            w.transportTag
        )

    assert MerkleMember(
        distributionCommitment,
        w.distributionPath,
        public.globalDistributionRoot
    )

    allocationLeaf =
        H(
            ALLOCATION_DOMAIN,
            CommitStealthPubKey(w.stealthPubKey),
            w.amount,
            w.leafSalt,
            w.flags
        )

    assert w.flags.isReal == 1
    assert w.amount > 0

    assert MerkleMember(
        allocationLeaf,
        w.allocationPath,
        w.allocationRoot
    )

    claimNullifier =
        H(
            CLAIM_NULLIFIER_DOMAIN,
            distributionCommitment,
            allocationLeaf
        )

    assert claimNullifier
        == public.claimNullifier

    privateNoteBody =
        H(
            PRIVATE_NOTE_DOMAIN,
            H(OWNER_KEY_DOMAIN, w.ownerNullifierKey),
            w.amount,
            w.noteSecret
        )

    assert privateNoteBody
        == public.privateNoteBodyCommitment

    intent =
        CanonicalClaimIntent(
            public.globalDistributionRoot,
            public.claimNullifier,
            public.privateNoteBodyCommitment,
            w.nonce,
            w.validUntil
        )

    assert ECDSA_secp256k1_verify(
        w.stealthPubKey,
        w.signature,
        intent
    )
```

---

# Appendix D — Privacy Regression Fixture

Use distinctive values:

```text
employeeRef: alice-null-test
employeeEOA: 0x111111111111111111111111111111111111A11C
amountAtomic: 4201123456

employeeRef: bob-null-test
employeeEOA: 0x222222222222222222222222222222222222B0B0
amountAtomic: 7503654321
```

Audit searches:

- hex/lower/checksum address;
- 8-byte BE/LE amount;
- 32-byte ABI amount;
- decimal amount string;
- employeeRef;
- raw test stealth keys.

Absence is a regression check, not a formal anonymity proof.

---

# Appendix E — Demo Seed Strategy

Use clearly labeled deterministic **test-only** profiles.

Never reuse test seeds on mainnet.

Seeded public demo SHOULD contain:

- pre-funded shielded treasury;
- one prior unrelated distribution;
- one already-claimed unrelated allocation;
- new payroll distribution;
- enough history for the global accumulator to be visually meaningful.

---

# Appendix F — Product Copy

## Landing

> **Distribute value, reveal nothing.**
>
> NULL lets organizations create verifiable private distributions on Ethereum. Recipients discover encrypted entitlements with stealth keys and claim shielded notes without publishing their address, amount, or source distribution.

## Employer

> **Your payroll records belong in payroll — not in block explorers.**

## Recipient

> **Your compensation is yours to see.**

## Developer

> **One commitment. Private entitlements. Permissionless claims.**

---

# Appendix G — Final Engineering Rule

When a design choice conflicts with:

1. privacy invariant;
2. correctness invariant;
3. testability;
4. sponsor eligibility;
5. UI polish;

use that priority order.

A smaller demo with defensible privacy is better than a broad demo whose explorer leaks one supposedly hidden field.
