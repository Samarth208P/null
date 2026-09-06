# NULL public privacy index

The schema normalizes public ciphertext transports, distributions, note insertions and consumptions. NULL and optionally ERC-5564 announcements share a protocol-discriminated transport model. ERC-5564 `ciphertext` stores the event's public metadata and must not be assumed encrypted; its public destination and caller are deliberately omitted. No claim entity has a relation to its hidden source distribution.

Generate the contract ABI first using the contracts package. After a real deployment manifest records `status: deployed`, `contracts.nullPool`, `deploymentBlock` and `chainId`, run:

```sh
pnpm --filter @null-protocol/subgraph prepare:manifest --manifest ../deployments/sepolia.json
pnpm --filter @null-protocol/subgraph codegen
pnpm --filter @null-protocol/subgraph build
```

Paths passed to `--manifest` resolve from the command's current working directory (the subgraph directory when invoked through pnpm filter). To compose ERC-5564, also pass `--announcer <verified-address> --announcer-start <deployment-block>`; the address is never guessed. Use Graph Studio to authenticate and deploy only after configuring the actual project. No live endpoint is shipped or implied.

The manifest imports `contracts/abi/NullPool.json` generated from Solidity. It retains history for block-pinned pagination. Entities use transaction-hash/log-index IDs; chain and emitter are part of every record and every client query. Graph Node handles canonical-chain rollback; the client additionally verifies its checkpoint hash against RPC, rewinds on mismatch, and resubmits the unconfirmed tail.

The browser package `@null-protocol/graph-client` queries all four entity sets over broad public block ranges. It never receives keys or salaries. It falls back to chunked `eth_getLogs` if Graph is missing, lagging, inconsistent or unavailable. Callers must apply `replaceFromBlock` before merging results and must not treat `confirmed: false` as final.

Sources: [Graph manifest and mappings](https://thegraph.com/docs/en/subgraphs/developing/creating/subgraph-manifest/), [ERC-5564 event standard](https://eips.ethereum.org/EIPS/eip-5564).
