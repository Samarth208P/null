# 🔐 Chainlink CRE Confidential Distribution Compiler

> **Confidential Workflows powered by Chainlink Runtime Environment (CRE) & Hardware Enclaves (TEE)**

The NULL CRE workflow executes sensitive payroll computation and encrypted envelope generation inside a **Hardware-Enforced Trusted Execution Environment (TEE)** using `@chainlink/cre-sdk` `handlerInTee`. Node operators and public observers never see raw employee salaries, names, or addresses.

---

## 🏗️ How the TEE Compiler Works

```
                     ┌────────────────────────────────────────┐
                     │          Chainlink TEE Enclave         │
                     │          (handlerInTee WASM)           │
                     └───────────────────┬────────────────────┘
                                         │
    1. Authenticated HTTPS Request       │ 2. Compute Stealth Envelopes
       with TEE Secret (Bearer Token)    │    & Poseidon Roots
                                         │
    ┌──────────────────────────────┐     │     ┌──────────────────────────────┐
    │ Private Payroll API / Server │ ◄───┴───► │ Public Commitment & Envelopes│
    │ (Protected JSON Dataset)     │           │ (Safe for Public Onchain TX) │
    └──────────────────────────────┘           └──────────────────────────────┘
```

1. **Confidential Retrieval:** The TEE retrieves the employer's secret API token via `TeeRuntime.getSecret` and requests the payroll batch over HTTPS (`GET ${NULL_PAYROLL_BASE_URL}/${batchId}`).
2. **Encrypted Slot Generation:** The enclave validates the dataset, generates 8 constant-size (608-byte) AES-256-GCM encrypted envelopes, and computes the Poseidon commitment tree.
3. **Public Output Only:** The TEE outputs only the public commitment roots and ciphertexts. Raw identities, amounts, and spending keys never leave the secure enclave.

---

## 🛠️ Local Simulation & Development

### 1. Run End-to-End Simulation (Fastest Demo Flow)
```sh
# Run the local CRE simulation runner
pnpm cre:simulate
```

### 2. Standalone Service Commands
```sh
# Check CRE environment status
pnpm --filter @null-protocol/cre-workflow status:cre

# Initialize local credentials (generates trigger keys & API tokens in root .env)
pnpm --filter @null-protocol/cre-workflow setup:env --init-credentials

# Compile workflow WASM via Javy / Bun
pnpm --filter @null-protocol/cre-workflow build:cli

# Run the local authenticated mock payroll server (binds 127.0.0.1:8789)
pnpm --filter @null-protocol/cre-workflow payroll:serve
```

---

## 📡 API Data Contract & Endpoint Format

The payroll endpoint (`NULL_PAYROLL_BASE_URL`) must point to a collection route (e.g., `https://payroll.example.com/batches`). The workflow handler appends `/${batchId}` and expects:

```json
{
  "batchId": "batch-2026-09-01",
  "batchEntropyHex": "0x4f...32_bytes...",
  "recipients": [
    {
      "employeeRef": "emp-001",
      "amountAtomic": "2500000000",
      "stealthMetaAddress": "0x04...65_bytes..."
    }
  ]
}
```

*Note: Enclave WASM uses `@noble/ciphers` AES-256-GCM for deterministic encryption without requiring browser WebCrypto APIs.*
