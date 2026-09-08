# 🏢 Privy Authenticated Organization Gateway

> **B2B Treasury Governance & Multi-Signer Quorum Authorization**

The organization service acts as an authenticated bridge between corporate decision-makers and the NULL smart contracts. It enforces **Privy multi-signer quorum policies** over distribution intents before generating zero-knowledge proofs.

---

## 🔒 Security Architecture

```
                       ┌────────────────────────────┐
                       │   Privy-Authenticated Org   │
                       │    Dashboard / Approvers   │
                       └─────────────┬──────────────┘
                                     │ 1. ES256 Access Token + Prepared Intent
                                     ▼
                       ┌────────────────────────────┐
                       │    Organization Gateway    │
                       │  (Local Node / Netlify Fn) │
                       └─────────────┬──────────────┘
                                     │ 2. Enforce Quorum Threshold
                                     ▼
                       ┌────────────────────────────┐
                       │  Privy REST Wallet Signing │
                       │ (Generates Compact Witness)│
                       └─────────────┬──────────────┘
                                     │ 3. Return ZK Circuit Witness
                                     ▼
                       ┌────────────────────────────┐
                       │   Noir Distribution Proof  │
                       └────────────────────────────┘
```

* **No Plaintext Ingestion:** The service never receives employee salaries, names, or private recipient keys. It operates exclusively on public circuit inputs, root digests, and authorization signatures.
* **Strict Quorum Enforcement:** Multi-owner quorum rules ensure that no single rogue administrator can broadcast unauthorized payroll distributions.
* **Token Verification:** Every request requires a valid Privy ES256 access token verified via `@privy-io/node` against the official Privy JWKS.

---

## 📡 API Endpoints

| Route | Method | Purpose |
| :--- | :--- | :--- |
| `/health` | `GET` | Service readiness and configuration check. |
| `/api/organization/config` | `GET` | Authenticated query for wallet controls and quorum metadata. |
| `/api/organization/prepare` | `POST` | Validates distribution parameters and returns a short-lived approval ticket. |
| `/api/organization/authorize` | `POST` | Submits collected quorum signatures to Privy and returns the authorized circuit witness. |

---

## 🛠️ Running the Service

### 1. Local Development
```sh
# Run the standalone organization gateway (binds to 127.0.0.1:8788)
pnpm organization

# Or launch along with the web app and relayer
pnpm dev:all
```

### 2. Netlify Serverless Deployment
The repository includes a production-ready Netlify serverless Function route (`netlify/functions/organization.ts`). Shared intent storage ensures strongly consistent ticket validation across serverless worker instances.
