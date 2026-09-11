# ⚡ NULL Zero-Knowledge Circuits

> **Private Entitlements & Value Conservation powered by Noir & Barretenberg UltraHonk**

NULL's deployed v0.2 uses four custom Zero-Knowledge circuits written in [Noir](https://noir-lang.org/). The new locally verified v0.3 adds a fifth, `withdraw_partial`, to prove a recipient's chosen public exit amount and exact private change. No public v0.3 deployment is claimed. See [verification](../docs/PAYOUT_V3_VERIFICATION.md).

---

## 🧩 The 4 Core Circuits

```
  ┌───────────┐      ┌─────────────────────────┐      ┌───────────┐      ┌────────────┐
  │  1. SHIELD│ ───► │ 2. CREATE_DISTRIBUTION  │ ───► │  3. CLAIM │ ───► │ 4. WITHDRAW│
  └───────────┘      └─────────────────────────┘      └───────────┘      └────────────┘
   Deposit ERC-20     8-Slot Private Payout            Privately Claim    Clean Exit to
   into Treasury      with Policy Auth                 into Shielded Note Target Wallet
```

### 1. `shield`
* **Purpose:** Binds a public ERC-20 token deposit to a hidden treasury note.
* **Constraints:** Enforces positive amount, valid note body commitment, and registers initial policy bounds.

### 2. `create_distribution`
* **Purpose:** Converts shielded treasury notes into an 8-slot private entitlement commitment.
* **Constraints:**
  * Enforces **value conservation** ($\sum \text{inputs} = \sum \text{outputs} + \text{change}$).
  * Verifies **organization authorization policy** membership and checks hidden ECDSA signature over the batch intent.
  * Nullifies input treasury notes to prevent double-spending.
  * Computes the 8-slot allocation root and encrypted envelope root.

### 3. `claim`
* **Purpose:** Allows a recipient to prove entitlement to an allocation and materialize a shielded note.
* **Constraints:**
  * Proves membership of the distribution in the global accumulator Merkle tree.
  * Verifies ownership of the hidden one-time **secp256k1 stealth key**.
  * Checks the recipient's signature over the claim digest and public relay context.
  * Generates a deterministic claim nullifier to prevent double-claiming.

### 4. `withdraw`
* **Purpose:** Allows a note owner (recipient or refunded treasury) to exit funds to a public Ethereum address.
* **Constraints:**
  * Proves membership of the note in the note commitment tree.
  * Verifies knowledge of note secret, value, asset, and nullifier secret.
  * Computes note nullifier and binds target exit address into the public withdrawal intent digest.

---

## 📋 Public Input Specification

Each circuit receives an exact sequence of public inputs verified onchain by Solidity verifiers:

| Circuit | Public Inputs (Canonical Order) |
| :--- | :--- |
| **`shield`** | `[version, chainId, pool, amount, treasuryBody, authPolicy]` |
| **`create_distribution`** | `[version, chainId, pool, noteRoot, authRoot, nullifier0, nullifier1, distributionCommitment, envelopeRootHi128, envelopeRootLo128, changeBody, transportTagHi128, transportTagLo128, nonce, validUntil]` |
| **`claim`** | `[version, chainId, pool, globalDistributionRoot, claimNullifier, privateBody, nonce, validUntil]` |
| **`withdraw`** | `[version, chainId, pool, noteRoot, authRoot, noteNullifier, recipient, amount, nonce, validUntil]` |
| **`withdraw_partial`** | `[version, chainId, pool, noteRoot, authRoot, noteNullifier, recipient, amount, changeBody, nonce, validUntil]` |

`withdraw_partial` accepts only recipient notes. The original amount, membership path, note opening and change opening remain private witnesses. It constrains `0 < withdrawn < original` and commits to `original - withdrawn`. Full exits use `withdraw`. The asset is fixed by the pool. Partial change requires a new encrypted recovery checkpoint.

---

## 🛠️ Compilation & Verifier Generation

Compile all circuits and generate Solidity EVM verifiers using pinned Noir/Barretenberg WASM (no native toolchain installation required):

```sh
# From workspace root
pnpm circuits:build

# Or directly with script options
node tools/build-circuits.mjs --verifiers
```

* **Compilation Artifacts:** Stored in `circuits/target/*.json`.
* **Solidity Verifiers:** Generated into `contracts/src/verifiers/*Verifier.sol`.
* **Domain Separation:** Domain tags are strictly checked against `circuits/domains.json` and synchronized via `pnpm test:domains`.
