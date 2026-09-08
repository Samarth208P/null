# 🔐 @null-protocol/auth

> **Privy Multi-Signer Organization Governance & Poseidon Intent Authorizer**

`@null-protocol/auth` provides browser and server-side utilities to coordinate **Privy multi-signer quorum authorizations** over zero-knowledge distribution intents.

---

## 🎯 Key Design Principles

* **Native Poseidon Digest Signing:** Builds structured raw secp256k1 signing requests over the circuit's exact Poseidon intent digest. Avoids `personal_sign` and Ethereum message prefixes so the signature is directly verifiable inside the Noir distribution circuit.
* **Bounded Input Binding:** Public inputs (envelope root, output commitment, nullifiers, nonce, deadline, chainId, pool address) are cryptographically committed to the intent.
* **Multi-Signer Quorum:** Supports collecting signatures across multiple corporate approvers before generating the final ZK proof witness.

---

## 📦 Usage

### 1. Browser Client (`@null-protocol/auth`)
```typescript
import { authorizeOrganizationDistribution } from '@null-protocol/auth';

const result = await authorizeOrganizationDistribution({
  endpoint: '/api/organization',
  appId: import.meta.env.VITE_PRIVY_APP_ID,
  expectedSigner: '0x6567226D425c423b1A5765384Ae343aE5FDeB1d1',
  publicInputs: compiledInputs,
  getAccessToken: () => privy.getAccessToken(),
  generateAuthorizationSignature: (req) => privy.generateAuthorizationSignature(req),
});

// Pass result.compactSignature into Noir distribution proof witness
```

### 2. Server Adapter (`@null-protocol/auth/server`)
```typescript
import { createPrivyOrganizationAuthorizer } from '@null-protocol/auth/server';

const authorizer = createPrivyOrganizationAuthorizer({
  appId: process.env.PRIVY_APP_ID!,
  appSecret: process.env.PRIVY_APP_SECRET!,
  walletAddress: process.env.PRIVY_ORGANIZATION_WALLET_ADDRESS!,
  walletId: process.env.PRIVY_ORGANIZATION_WALLET_ID!,
  ownerQuorumId: process.env.PRIVY_ORGANIZATION_OWNER_QUORUM_ID!,
});

const prepared = await authorizer.prepare(publicInputs, expectedContext);
const authorized = await authorizer.authorize({ ticket: prepared.ticket, signatures });
```
