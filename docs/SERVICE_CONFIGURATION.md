# Service and indexing configuration

All onchain adapters use the generated ABI and a single deployed manifest. Copy `deployments/sepolia.template.json` only after deploying actual immutable contracts and recording their addresses, deployment block and runtime code hashes. Leave absent resources null/unavailable. A circuit source file without its matching generated verifier/proving artifacts does not make a live proof path available.

| Component | Required configuration | Failure behavior |
| --- | --- | --- |
| Browser discovery | chain ID, pool address, deployment block, at least one RPC URL; optional public Graph endpoint | Graph missing/stale/error causes RPC scan; RPC wrong-chain/error stops discovery |
| Relayer | `NULL_MANIFEST_PATH`, `RELAYER_RPC_URL`, `RELAYER_PRIVATE_KEY`, explicit CORS origins | health 503 and no send if deployment/credentials missing; checks live code/hash before each send |
| Privy organization adapter | server app ID/secret, wallet ID/address, owner quorum ID, organization entity ID, required policy IDs, minimum threshold, chain/pool | rejects control drift, missing quorum signatures and any context/signature mismatch |
| Organization API host | the adapter values plus exact allowed member Privy DIDs and CORS origins; public browser `VITE_ORGANIZATION_URL` | verifies Privy session tokens and server membership before preparing/signing; session-bound tickets prevent intent substitution |
| CRE TEE compiler | actual workflow config, signed trigger key, HTTPS payroll endpoint, CRE-bound credential secret | no ordinary server/plaintext fallback; local fallback is an explicit separate command |
| Graph | generated ABI, deployed manifest, Graph Studio project and credentials | manifest generation rejects placeholders; client can always use RPC |
| Substreams | Rust 1.88.0, pinned crates, generated ABI, actual provider/network and public emitter parameters | invalid/zero emitter context rejected; no packaged/live stream currently claimed |

`createDiscoveryClient` defaults to the configured confirmation window (12 blocks). Pass an explicit latest `toBlock` for a seen-only scan; `confirmed` stays false until the threshold is met. Persist checkpoint block number/hash with public events. Before merging a scan, discard records whose block number is at or above `replaceFromBlock`. A changed checkpoint hash triggers full replay from the deployment block so a deep reorganization does not silently keep orphaned records. Graph pages pin a specific chain block and use bounded ID pagination. Multiple RPC URLs provide provider failover; they do not establish independent consensus against a malicious provider.

Replay the `NoteInserted` event only once per note. `Shielded` and `AllocationConsumed` describe actions that also insert notes; counting both would corrupt the local Merkle tree. Feed distribution insertions in leaf-index order into the distribution accumulator; a claim uses its global root, never a chosen distribution root. Fetch the current accepted root before proving and refresh/reprove on `NULL_ROOT_STALE`.

Private employer imports, recovery bundles, TEE batch entropy and secret environment values must remain out of committed source and public hosting. Vite environment values are bundled into the browser: only publish public configuration there. None of these services requires a recipient private key.
