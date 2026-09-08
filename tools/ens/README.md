# 🏷️ ENSv2 Sepolia Setup & Permissioned Resolvers

> **ENSv2 Subregistry Delegation & Scoped Payment Profile Management**

This directory contains the contract artifacts and setup tooling for NULL's **ENSv2** integration on Ethereum Sepolia.

---

## 🌟 How NULL Uses ENSv2

```
                       ┌────────────────────────────┐
                       │    Parent Organization     │
                       │     (nullpay2026.eth)      │
                       └─────────────┬──────────────┘
                                     │ 1. Subregistry Delegation
                                     ▼
                       ┌────────────────────────────┐
                       │   Recipient Subname Node   │
                       │  (inbox.nullpay2026.eth)   │
                       └─────────────┬──────────────┘
                                     │ 2. authorizeTextRoles(recipientWallet)
                                     ▼
                       ┌────────────────────────────┐
                       │    Permissioned Resolver   │
                       │ (Scoped Stealth Record Set)│
                       └────────────────────────────┘
```

1. **Subregistry Creation:** Organizations manage a primary root name (e.g., `nullpay2026.eth`) and assign child subnames to employees and contributors.
2. **Scoped Role Delegation (`authorizeTextRoles`):** Grants the recipient's embedded Privy wallet permissions to update **only** its own stealth payment metadata (`null.payment.v1`) without granting broader control of the domain.
3. **Changed-Destination Verification:** The NULL client resolves payment names via Universal Resolver before encryption, verifying that records match the expected identity and alerting the payer if a recipient's keys have rotated.

---

## 🛠️ Tooling & Status Checks

```sh
# Check current Sepolia ENS registration status, resolvers, and delegated subnames
pnpm ens:status
```

* **Live Verified Test Domain:** `inbox.nullpay2026.eth`
* **Artifact Source:** Built from official ENS [contracts-v2 deployment artifacts](https://github.com/ensdomains/contracts-v2) on Sepolia.
