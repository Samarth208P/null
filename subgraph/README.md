# 📊 The Graph — Public Privacy Event Indexer

> **High-Performance Event Indexing & Standardized Privacy Schema**

The NULL Subgraph normalizes public onchain ciphertext transports, batch distributions, note insertions, and nullifier consumptions. It provides a fast, indexed query layer for recipient wallet discovery while preserving zero-knowledge guarantees.

---

## 🏗️ Indexing Architecture

```
   Sepolia NullPool Contract                    The Graph Node / Studio
 ┌───────────────────────────┐                ┌───────────────────────────┐
 │ • NoteInserted            │ ─────────────► │ • NoteEntity              │
 │ • DistributionInserted    │   Log Stream   │ • DistributionEntity      │
 │ • NullifierSpent          │                │ • NullifierEntity         │
 └───────────────────────────┘                └─────────────┬─────────────┘
                                                            │ GraphQL Queries
                                                            ▼
                                              ┌───────────────────────────┐
                                              │ Web Browser Inbox Scanner │
                                              │   (+ Direct RPC Fallback) │
                                              └───────────────────────────┘
```

* **No Privacy Leakage:** The subgraph never indexes recipient addresses or links claims to their source distributions. All queryable fields consist solely of public ciphertext envelopes, commitments, and nullifiers.
* **Resilient Client Scanning:** The browser client (`@null-protocol/graph-client`) queries the Studio endpoint and automatically falls back to chunked RPC `eth_getLogs` if the indexer is lagging or offline.

---

## 🛠️ Build & Deploy

### 1. Codegen & WASM Build
```sh
# Prepare manifest against the deployed Sepolia pool
pnpm --filter @null-protocol/subgraph prepare:manifest --manifest ../deployments/11155111.json

# Generate TypeScript types & compile mapping WASM
pnpm --filter @null-protocol/subgraph codegen
pnpm --filter @null-protocol/subgraph build
```

### 2. Deploy to Graph Studio
```sh
# Review configuration plan
pnpm graph:deploy

# Deploy Studio release (requires GRAPH_STUDIO_DEPLOY_KEY in root .env)
pnpm graph:deploy --deploy
```

* **Live Studio Endpoint (v0.2.0):** [https://api.studio.thegraph.com/query/1758859/null-protocol/v0.2.0](https://api.studio.thegraph.com/query/1758859/null-protocol/v0.2.0)
