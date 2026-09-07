# NULL public privacy index

The schema normalizes public ciphertext transports, distributions, note insertions and consumptions. NULL and optionally ERC-5564 announcements share a protocol-discriminated transport model. ERC-5564 `ciphertext` stores the event's public metadata and must not be assumed encrypted; its public destination and caller are deliberately omitted. No claim entity has a relation to its hidden source distribution.

Generate the contract ABI first using the contracts package. After a real deployment manifest records `status: deployed`, `contracts.nullPool`, `deploymentBlock` and `chainId`, run:

```sh
pnpm --filter @null-protocol/subgraph prepare:manifest --manifest ../deployments/11155111.json
pnpm --filter @null-protocol/subgraph codegen
pnpm --filter @null-protocol/subgraph build
```

Without `--manifest`, the command reads `NULL_MANIFEST_PATH` from the single root `.env`, resolving that value from the repository root and defaulting to `deployments/11155111.json`. Explicit `--manifest` paths resolve from the command's current working directory (the subgraph directory when invoked through pnpm filter). To compose ERC-5564, also pass `--announcer <verified-address> --announcer-start <deployment-block>`; the address is never guessed. Generated files and a successful build do not create a Graph endpoint.

## Optional Studio development endpoint

The deployed Sepolia manifest has been generated locally, and code generation and the WASM build completed. No Graph credentials or existing CLI authentication were available during setup. RPC discovery remains the configured path.

To enable a Studio development endpoint, create or select a project in your own Graph Studio account and place these values in the single root `.env`:

| Variable | Value |
| --- | --- |
| `GRAPH_STUDIO_SLUG` | Existing Studio project slug |
| `GRAPH_STUDIO_DEPLOY_KEY` | Private Studio deploy key; never a `VITE_` value |
| `GRAPH_VERSION_LABEL` | A version label such as `v0.1.0`; change it for later releases |

```sh
pnpm graph:deploy           # Local plan only; reports missing configuration
pnpm graph:deploy --deploy  # Deploy a Studio development version after account setup
```

The helper refreshes the manifest and generated types, then uses the pinned Graph CLI to upload the public build and deploy only to the fixed Studio development endpoint. It passes the key within the process rather than an operating-system command line, and it creates no additional credential file. It does not publish to the decentralized network or enable billing. The Studio account/project and deploy key must already exist; this command does not create them.

After deployment, put the returned development query URL in `VITE_GRAPH_URL` in root `.env` and restart the local app. This query URL is public browser configuration. Check the provider's [development endpoint limits](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/using-subgraph-studio/); no unlimited free capacity is promised. Contract deployment and a local subgraph build do not establish indexing or successful Graph queries.

The manifest imports `contracts/abi/NullPool.json` generated from Solidity. It retains history for block-pinned pagination. Entities use transaction-hash/log-index IDs; chain and emitter are part of every record and every client query. Graph Node handles canonical-chain rollback; the client additionally verifies its checkpoint hash against RPC, rewinds on mismatch, and resubmits the unconfirmed tail.

The browser package `@null-protocol/graph-client` queries all four entity sets over broad public block ranges. It never receives keys or salaries. It falls back to chunked `eth_getLogs` if Graph is missing, lagging, inconsistent or unavailable. Callers must apply `replaceFromBlock` before merging results and must not treat `confirmed: false` as final.

Sources: [Graph manifest and mappings](https://thegraph.com/docs/en/subgraphs/developing/creating/subgraph-manifest/), [ERC-5564 event standard](https://eips.ethereum.org/EIPS/eip-5564).
