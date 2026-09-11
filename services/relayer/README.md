# ⛽ Gasless Transaction Relayer

> **Privacy-Preserving Onchain Broadcaster & Bounded Gas Submitter**

The NULL relayer is a reference broadcaster using a separate server-side wallet to pay gas. It accepts distributions, claims, full withdrawals and, with a matching v0.3 manifest, partial withdrawals. v0.3 was verified locally and is not deployed publicly. A funded sponsor lets recipients submit without ETH; withdrawal addresses, public amounts and network metadata remain visible.

Route the SDK's `{ mode: 'sponsored', send }` callback through your authenticated endpoint and `createRelayer`. CORS/IP limits do not authenticate customers or enforce sponsor budgets. Add customer authorization and spending limits before exposing a funded service.

Optional server-only `RELAYER_MAX_GAS` sets the per-transaction ceiling including 20% estimated-gas padding. The unchanged default of 3,000,000 is below several genuine-proof transactions. The local v0.3 test used 10,000,000. Set a budget from actual verified transactions; this is not a monetary fee quote. Keep the gas key out of browser configuration. Deposits still require the funding wallet.

---

## 🛡️ Privacy & Security Features

```
                      ┌────────────────────────────┐
                      │    Client Prover Worker    │
                      │  (Generates ZK Claim/Exit) │
                      └─────────────┬──────────────┘
                                    │ POST /api/relay (Proof + Public Inputs)
                                    ▼
                      ┌────────────────────────────┐
                      │    NULL Relayer Service    │
                      │  (127.0.0.1:8787 / Hosted) │
                      └─────────────┬──────────────┘
                                    │ 1. Validate Schema & Bounded Gas
                                    │ 2. Check Unspent Nullifiers
                                    │ 3. eth_call Simulation Preflight
                                    │ 4. Broadcast with Relayer Gas Key
                                    ▼
                      ┌────────────────────────────┐
                      │  Sepolia NullPool Contract │
                      └────────────────────────────┘
```

* **Strict Input Validation:** Accepts only proof bytes and exact canonical public input arrays. Rejects private keys, signatures, salaries, or arbitrary calldata.
* **Preflight Simulation:** Executes `eth_call` simulation against the live pool contract before broadcasting to prevent failed transactions and gas waste.
* **Double-Spend Protection:** Checks nullifiers against the live contract state prior to submission.
* **Rate-Limiting:** Enforces bounded request queues and socket-level rate limiting.

---

## 📡 API Reference

### `POST /api/relay`
Accepts relay payloads for `createDistribution`, `claim`, or `withdraw`:

```json
{
  "chainId": 11155111,
  "pool": "0x734da58C285D211e7C0ad904f522c221c982447E",
  "method": "claim",
  "proof": "0x...",
  "publicInputs": [
    "0x0000000000000000000000000000000000000000000000000000000000000001",
    "0x0000000000000000000000000000000000000000000000000000000000aa36a7",
    "..."
  ]
}
```

---

## 🛠️ Setup & Running

```sh
# 1. Initialize and fund the local relay wallet with Sepolia ETH
pnpm setup:relayer --fund

# 2. Run the relayer service (binds 127.0.0.1:8787)
pnpm relayer

# 3. Export raw transaction calldata for manual self-broadcasting
pnpm --filter @null-protocol/relayer broadcast --proof claim.json
```
