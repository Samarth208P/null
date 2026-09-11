# 📜 NULL Smart Contracts

> **Solidity v0.8.28 Pool, Poseidon Merkle Accumulators, and UltraHonk Verifier Bindings**

The smart contract layer governs the onchain state of the NULL protocol. It enforces zero-knowledge proof verification, tracks accumulator trees, registers nullifiers to prevent double-spending, and handles ERC-20 asset deposits and withdrawals.

---

## 🏗️ Architecture Overview

```
                          ┌──────────────────────────┐
                          │       NullPool.sol       │
                          │ (Main Settlement Engine) │
                          └─────────────┬────────────┘
                                        │
      ┌──────────────────┬──────────────┼────────────────┬──────────────────┐
      ▼                  ▼              ▼                ▼                  ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────────┐
│ ShieldVerifier│ │DistrVerifier  │ │ ClaimVerifier │ │WithdrawVerifier│ │NullAuthRegistry.sol │
└───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘ └───────────────────┘
```

### Core Components
1. **`NullPool.sol`:**
   * **Tree Accumulators:** Maintains append-only Poseidon Merkle trees for Shielded Notes and 8-Slot Distributions.
   * **Nullifier Registry:** Deterministically records consumed note nullifiers and claim nullifiers to prevent double-spends.
   * **Asset Custody:** Manages ERC-20 token reserves (USDC) with strict balance conservation checks.
2. **`NullAuthRegistry.sol`:**
   * Accumulator tree storing organization policy commitments; signer data remains in private policy openings.
3. **EVM Verifiers (`contracts/src/generated/`):**
   * Immutable UltraHonk verifier contracts generated directly from compiled Noir circuits.

---

## ⚡ Canonical Event Streams

| Event | Purpose | Consumed By |
| :--- | :--- | :--- |
| `NoteInserted` | Emitted on note creation (Shield or Claim). | Subgraph / Browser Tree Builder |
| `DistributionInserted` and `EnvelopePublished` | Emitted on private batch execution with 8 encrypted envelopes. | Recipient Scanner / Indexer |
| `AllocationConsumed` and spent-nullifier mappings | Claim events plus onchain spent-state checks; consult the generated ABI for exact fields. | Client Wallet / Relayer |
| `Withdrawn(uint256 noteNullifier, address recipient, uint64 amount)` | Emitted on note exit or treasury refund. | Public Ledger |

---

## 🛠️ Build & Development

### 1. Compile Contracts & Generate ABIs
```sh
# Build Solidity and regenerate @null-protocol/contracts TypeScript exports
pnpm build:contracts

# Optional: Run Foundry tests (if Foundry installed)
cd contracts && forge test
```

### 2. Sepolia Deployment Pipeline
```sh
# 1. Prepare root .env configuration
pnpm setup:sepolia

# 2. Review gas allowance and deployment plan
pnpm deploy:plan

# 3. Deploy full suite (Poseidon libs, 4 verifiers, policy registry, pool)
pnpm deploy:sepolia

# 4. Initialize & register organization treasury policy
pnpm treasury:init
pnpm treasury:register --broadcast
```

---

## 🌐 Deployed Addresses (Ethereum Sepolia - v0.2)

* **Pool Contract:** [`0x734da58C285D211e7C0ad904f522c221c982447E`](https://sepolia.etherscan.io/address/0x734da58C285D211e7C0ad904f522c221c982447E)
* **Shield Verifier:** [`0xE66cf296c09b2EBE9c3Efa8786938d21c322765A`](https://sepolia.etherscan.io/address/0xE66cf296c09b2EBE9c3Efa8786938d21c322765A)
* **Distribution Verifier:** [`0xDaeF155160875C96f30d075D1cbD6C6415a7702f`](https://sepolia.etherscan.io/address/0xDaeF155160875C96f30d075D1cbD6C6415a7702f)
* **Claim Verifier:** [`0xc80436dFf8541e2A8d03541A13C07914436573c5`](https://sepolia.etherscan.io/address/0xc80436dFf8541e2A8d03541A13C07914436573c5)
* **Withdraw Verifier:** [`0x9599553f1B981C53faC9cEc7538c823A4A3eB4C1`](https://sepolia.etherscan.io/address/0x9599553f1B981C53faC9cEc7538c823A4A3eB4C1)
* **Policy Registry:** [`0x5f9Fe77D3222eE2A346C005F999D39031c519c2C`](https://sepolia.etherscan.io/address/0x5f9Fe77D3222eE2A346C005F999D39031c519c2C)
