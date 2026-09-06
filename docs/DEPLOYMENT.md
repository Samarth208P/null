# Deployment and service setup

The repository currently contains development sources and compiled artifacts, **not a deployed NULL environment**. These instructions describe the existing scripts and configuration boundaries. No deployment, token approval, confidential simulation, or service publication was performed during development. Tests were skipped at the user's request; deployment readiness has not been established by compilation alone.

## 1. Install and preserve a matching artifact set

Use Node 22.16.0 or newer and pnpm 11.9.0 from the repository root:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm circuits:build
pnpm build:contracts
```

The circuit command runs `node tools/build-circuits.mjs --verifiers`. It compiles all three Noir circuits and generates their actual ZK-enabled EVM verification keys and Solidity verifiers. Verifier generation can require substantial memory and download public SRS data. The Solidity command runs `node contracts/scripts/build.mjs` and regenerates ABIs and `@null-protocol/contracts` exports.

Preserve these outputs as one reviewed set:

- `circuits/target/{shield,create_distribution,claim}.json`, their `.vk` files, and `circuits/target/manifest.json`.
- `contracts/src/generated/{ShieldVerifier,CreateDistributionVerifier,ClaimVerifier}.sol`.
- `contracts/artifacts/`, including `build-integrity.json`, and `contracts/abi/`.

A plain circuit compile without `--verifiers` does not produce a deployable verifier set and replaces the circuit manifest with a compile-only status. Regenerate with `--verifiers` and rebuild Solidity after any relevant source change. Do not substitute an accepting verifier or edit hashes to bypass integrity checks. Details are in [circuit development](../circuits/README.md) and [contract development](../contracts/README.md).

## 2. Review the actual deployment plan

The [deployment script](../contracts/scripts/deploy.mjs) requires secret-managed process environment values:

| Variable | Purpose |
| --- | --- |
| `NULL_RPC_URL` | RPC for the intended chain |
| `NULL_ASSET_ADDRESS` | Existing six-decimal ERC-20 asset contract |
| `NULL_DEPLOYER_PRIVATE_KEY` | Funded deployer key; never a browser environment value or committed file |
| `NULL_CHAIN_ID` | Optional; defaults to Sepolia `11155111`. The script also permits local development chain `31337` |
| `NULL_GIT_COMMIT` | Optional source revision recorded in deployment provenance |

The default invocation reads the RPC, checks chain/asset configuration and artifact integrity, and prints a concrete plan without broadcasting:

```sh
node contracts/scripts/deploy.mjs
```

It still requires the deployer key to identify the sender. When a deployment is deliberately authorized, the explicit sending command is:

```sh
node contracts/scripts/deploy.mjs --broadcast
```

That command deploys Poseidon, the authorization registry, the three generated verifiers, and the pool, waits for their receipts, records runtime bytecode hashes, and writes **`deployments/11155111.json`** for Sepolia (or `deployments/31337.json` locally). It refuses to overwrite an existing manifest at that path. It does not approve tokens, shield funds, fund the deployer, or deploy a faucet asset onto a public chain.

Keep [sepolia.template.json](../deployments/sepolia.template.json) as an unconfigured example. Use the numeric-chain manifest actually produced by the script for downstream configuration. Some component examples use `sepolia.json` as a chosen filename; update those values to the real file path rather than assuming that file was generated. The manifest's deployment block starts early enough to replay the authorization registry history as well as the pool.

## 3. Publish reviewed public browser artifacts

Serve the exact circuit JSONs at the URLs recorded in the reviewed deployment manifest. The web application currently includes `apps/web/public/circuits/` for `/circuits/` assets; synchronize it with the reviewed build when artifacts change. Public proving artifacts do not contain recipient secrets.

Serve the actual reviewed deployment manifest at a public URL such as `/deployment.json`, then configure [the browser environment example](../apps/web/.env.example):

| Browser value | Meaning |
| --- | --- |
| `VITE_DEPLOYMENT_MANIFEST_URL` | Reviewed deployed manifest URL; defaults to `/deployment.json` |
| `VITE_RPC_URL` | Public RPC URL without private server credentials |
| `VITE_POOL_ADDRESS`, `VITE_DEPLOYMENT_BLOCK` | Public discovery context matching the actual manifest |
| `VITE_CONFIRMATIONS` | Confirmation threshold; never represent unconfirmed events as final |
| `VITE_GRAPH_URL` | Optional public Graph query endpoint |
| `VITE_RELAYER_URL` | Optional configured relay base URL |
| `VITE_PRIVY_APP_ID` | Public Privy app ID |
| `VITE_ORGANIZATION_URL` | Authenticated organization API base URL |

Use `apps/web/.env.local` for local Vite configuration and restart Vite after changes. Build and serve the application with the existing commands:

```sh
pnpm build
pnpm preview
```

The final production web build, including the live-operation and balance-recovery interfaces, passed; evidence is tracked in [implementation status](IMPLEMENTATION_STATUS.md). A frontend bundle alone does not create a deployment or establish a working proof path. The live client must match runtime bytecode, immutable verifier addresses, artifact hashes, chain, asset, and pool to the reviewed manifest before preparation. See [live client configuration and recovery](LIVE_CLIENT.md).

**Everything prefixed `VITE_` is public.** Never put app secrets, wallet keys, recipient view/spend keys, payroll, entropy, or private witnesses there. Hosting must preserve worker/WASM availability and circuit URLs; publishing a folder does not complete organization or confidential-execution setup.

## 4. Configure organization authorization and the optional relayer

The Node services read process environment variables; they do not automatically load `.env` files. The `.env.example` files are configuration references for your secret manager or process runner. Both hosts bind loopback and need an HTTPS reverse proxy for remote browser use, explicit allowed origins, and an appropriate edge rate limiter.

Start only configured services with the existing scripts:

```sh
pnpm --filter @null-protocol/organization dev
pnpm --filter @null-protocol/relayer dev
```

Follow [organization service setup](../services/organization/README.md) for the real Privy app credentials, organization wallet, owner quorum, required policies, threshold, exact allowed member DIDs, and deployed chain/pool context. Membership grants access to request approval; actual Privy quorum and policy enforcement determine whether an intent can be signed. The service accepts public intent fields and session-bound approval tickets, not payroll or recipient keys. The [browser authorization adapter](../packages/auth/README.md) verifies the exact canonical intent and returned signature locally.

For the relayer, configure `NULL_MANIFEST_PATH` to the actual numeric-chain manifest, `RELAYER_RPC_URL`, `RELAYER_PRIVATE_KEY`, and allowed origins. Resolve relative manifest paths from the service process working directory; through a pnpm filter, `../../deployments/11155111.json` points to the Sepolia manifest. Read [relayer setup and calldata export](../services/relayer/README.md). Relay health can report missing configuration; it does not claim a successful transaction. The browser's explicit self-broadcast path remains available when configured and authorized, subject to the same proof and deployment checks.

## 5. Configure public discovery

RPC discovery works independently of Graph. For a Graph deployment, first generate the actual manifest from the deployed contract record:

```sh
pnpm --filter @null-protocol/subgraph prepare:manifest --manifest ../deployments/11155111.json
pnpm --filter @null-protocol/subgraph codegen
pnpm --filter @null-protocol/subgraph build
```

These relative paths resolve from `subgraph/` when invoked through the filter. Optional ERC-5564 support requires an independently verified announcer address and deployment block. Authentication, project selection, and publication in Graph Studio are external setup steps described in [the subgraph guide](../subgraph/README.md); no project or endpoint has been created. `pnpm build:graph` compiles both mapping sources with inert addresses and is not a deployment command.

The browser issues broad public queries, verifies canonical checkpoints, and falls back to RPC on Graph errors or lag. Apply `replaceFromBlock` before merging scans and reconstruct note leaves only from `NoteInserted`, avoiding duplicate insertion from accompanying action events. See [service/indexing configuration](SERVICE_CONFIGURATION.md).

The [Substreams source](../substreams/private-payments/README.md) is a separate, uncompiled integration. Cargo was unavailable, and no package or provider sink exists. Do not describe the event subgraph as a deployed Substreams-powered subgraph.

## 6. Configure confidential compilation separately

Follow [the CRE workflow guide](../services/cre-workflow/README.md) to replace its staging example, configure the signed trigger and HTTPS payroll endpoint, and bind the payroll credential in CRE's secret manager. Its build command is:

```sh
pnpm --filter @null-protocol/cre-workflow build
```

This requires Bun and generates WASM; the build has completed successfully during development. It does not simulate or deploy the enclave workflow. Use the configured CRE CLI/account workflow for a deliberate confidential simulation and deployment, and retain their actual execution evidence before claiming a live integration.

The separate local compiler command in that guide is explicitly labeled `local-fallback` with `confidentialExecution: false`. It must not be published as a plaintext-payroll HTTP fallback. Compare confidential output to locally expected roots and keep batch entropy private and unique.

## Evidence to retain

Record actual deployment manifests, build/source checksums, transaction receipts, hosted artifact URLs, Graph endpoint/deployment identity, organization policy/quorum configuration, and CRE execution/attestation evidence when those actions eventually occur. Avoid inserting credentials or private witnesses into evidence files. Current absence of these external results is recorded in [implementation status](IMPLEMENTATION_STATUS.md) and [sponsor compliance](SPONSOR_COMPLIANCE.md).

The MVP has no withdrawal implementation, no security audit, and no executed test suite. Deployment should not be interpreted as permission to use real-value assets or as proof that the privacy and recovery guarantees are validated.

