# Deployment and service setup

**September 11 toolkit update:** no new browser/Netlify variable is required for the SDK homepage or ENS preparation. The standalone relayer gained optional server-only `RELAYER_MAX_GAS`; its unchanged 3,000,000 default is too low for several proof transactions. The local v0.3 rehearsal used 10,000,000.

The public deployment remains v0.2. Partial withdrawals require a new v0.3 pool/fifth verifier, matching artifacts, manifest/address configuration, indexer/relayer updates and a fresh rehearsal. Existing commands below still target v0.2. Do not change its manifest to imply an upgrade. Commit/review the demonstrated source before releasing the web build. See [v0.3 verification](PAYOUT_V3_VERIFICATION.md).

This setup deploys the contracts to Ethereum Sepolia and runs the web app and relayer on your own computer. All local configuration is in one private root `.env`; no website hosting is required. Confirmed transactions and current execution evidence belong in [implementation status](IMPLEMENTATION_STATUS.md). Contract deployment and local service configuration do not establish a working proof/payment flow or a live Privy/CRE integration. See [free defaults and optional integration limits](FREE_SEPOLIA.md).

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

The Solidity integrity record includes source-qualified artifacts and library link references. This preserves distinct generated libraries with the same name; deployment resolves those references and deduplicates only matching library instructions and ABIs.

A plain circuit compile without `--verifiers` does not produce a deployable verifier set and replaces the circuit manifest with a compile-only status. Regenerate with `--verifiers` and rebuild Solidity after any relevant source change. Do not substitute an accepting verifier or edit hashes to bypass integrity checks. Details are in [circuit development](../circuits/README.md) and [contract development](../contracts/README.md).

## 2. Review the actual deployment plan

Prepare local configuration first:

```sh
pnpm setup:sepolia
```

This creates the single Git-ignored root `.env` from [the canonical template](../.env.example), restricts file access, and prints the deployer's public address. Existing wallets and nonempty settings are preserved. The same file holds deployment, local service, treasury signer, and public browser values. Optional service credentials remain empty until configured.

The deployment commands load root `.env` automatically. Existing shell variables take precedence. The [deployment script](../contracts/scripts/deploy.mjs) uses:

| Variable | Purpose |
| --- | --- |
| `NULL_RPC_URL` | RPC for the intended chain |
| `NULL_ASSET_ADDRESS` | Existing six-decimal ERC-20 asset contract |
| `NULL_DEPLOYER_PRIVATE_KEY` | Funded deployer key; never a browser environment value or committed file |
| `NULL_CHAIN_ID` | Optional; defaults to Sepolia `11155111`. The script also permits local development chain `31337` |
| `NULL_GIT_COMMIT` | Optional source revision recorded in deployment provenance |
| `NULL_MAX_FEE_GWEI` | Maximum per-gas fee; setup defaults to `10` |
| `NULL_MAX_DEPLOYMENT_ETH` | Total deployment budget in testnet ETH; setup defaults to `0.05` |

The plan reads the RPC, checks chain/asset configuration, artifact integrity and library links, and prints a conservative funding allowance based on the current RPC fee quote without broadcasting:

```sh
pnpm deploy:plan
```

The allowance is not an exact cost; every send gets a fresh RPC gas estimate and fee check. The plan is saved to `.artifacts/deployment-plan-11155111.json`. Fund the displayed public address with the indicated amount of Sepolia ETH, then run:

```sh
pnpm deploy:sepolia
```

The current build needs eight deployments: Poseidon, two deduplicated verifier libraries, the authorization registry, three generated verifiers, and the pool. The command records signed transactions and receipts in `.artifacts/deployment-11155111.json` so the same command can resume an interrupted deployment with the same wallet/build. Preserve this journal. It waits for confirmations, records runtime hashes, checks pool bindings, and writes **`deployments/11155111.json`** for Sepolia (or `deployments/31337.json` locally). It refuses to overwrite an existing manifest. It does not approve tokens, shield funds, fund the deployer, or deploy a faucet asset onto a public chain.

Keep [sepolia.template.json](../deployments/sepolia.template.json) as an unconfigured example. Use the numeric-chain manifest produced by the script for downstream configuration. Its deployment block starts early enough to replay the authorization registry history as well as the pool.

## 3. Synchronize the local browser artifacts

Before any broadcast, the deployment script simulates all eight constructors using RPC state overrides and computes a gas allowance with a 20% margin. It requires an RPC that supports state overrides for `eth_call` and `eth_estimateGas`; the default PublicNode endpoint was verified. Actual deployed runtime must match both constructor simulation and linked compiler output. Repeating the deployment command with a matching completed journal and manifest can finish an interrupted browser synchronization without redeploying contracts.

After successful deployment, the command copies the actual manifest to `apps/web/public/deployment.json`, synchronizes matching circuit JSONs and artifact manifest into `apps/web/public/circuits/`, and updates the pool and manifest settings in root `.env`. The deployment block comes from the manifest. The app defaults to Sepolia in code. The script preserves the browser's public RPC instead of copying a deployment RPC that might contain credentials. Restart Vite. Public proving artifacts do not contain recipient secrets.

Vite reads the root `.env` and exposes only the `VITE_` values listed in [the canonical example](../.env.example):

| Browser value | Meaning |
| --- | --- |
| `VITE_DEPLOYMENT_MANIFEST_URL` | Reviewed deployed manifest URL; defaults to `/deployment.json` |
| `VITE_RPC_URL` | Public RPC URL without private server credentials |
| `VITE_POOL_ADDRESS` | Pool address matching the actual manifest; discovery reads the deployment block from that manifest |
| `VITE_CONFIRMATIONS` | Confirmation threshold; never represent unconfirmed events as final |
| `VITE_GRAPH_URL` | Optional public Graph query endpoint |
| `VITE_RELAYER_URL` | Optional configured relay base URL |
| `VITE_PRIVY_APP_ID` | Public Privy app ID |
| `VITE_ORGANIZATION_URL` | Authenticated organization API base URL |

Keep the web app local at **http://127.0.0.1:5173**. Restart it after root `.env` changes:

```sh
pnpm dev
```

The final production web build, including the live-operation and balance-recovery interfaces, passed; evidence is tracked in [implementation status](IMPLEMENTATION_STATUS.md). A frontend bundle alone does not create a deployment or establish a working proof path. The live client must match runtime bytecode, immutable verifier addresses, artifact hashes, chain, asset, and pool to the reviewed manifest before preparation. See [live client configuration and recovery](LIVE_CLIENT.md).

**Everything prefixed `VITE_` is public.** Never put app secrets, wallet keys, recipient view/spend keys, payroll, entropy, or private witnesses there. Vite uses strict file serving and denies environment files, private `.artifacts` outputs, research files, certificates, and Git metadata. A local browser build does not complete organization or confidential-execution setup.

## 4. Configure local authorization and the relayer

The service scripts automatically load the same root `.env`, with shell variables taking precedence. Relative manifest paths also resolve from the repository root. The local treasury CLI provides authorization without a Privy account:

Start only configured services with the existing scripts:

```sh
pnpm treasury:init
pnpm treasury:register       # Review and simulate the public policy registration
pnpm treasury:register --broadcast
pnpm setup:relayer           # Create or reuse a separate gas wallet; show funding plan
pnpm setup:relayer --fund    # Bring it to 0.05 Sepolia ETH once, using the deployer
pnpm dev:all                # Start the local web app and relayer together
```

Follow [the treasury guide](../tools/TREASURY.md) to import the private policy file and use `pnpm treasury:sign` for an exact reviewed distribution intent. The signer key and recovery values remain in root `.env`; private policy/signature files remain under `.artifacts`. Registration and relay funding do not shield or distribute tokens.

Relayer setup writes its separate key, RPC, local endpoint, and allowed origins into root `.env`. Use `NULL_MANIFEST_PATH=deployments/11155111.json`. `pnpm relayer` starts only the service at `127.0.0.1:8787`; read [relay configuration and calldata export](../services/relayer/README.md). Its health endpoint checks configuration and deployment readiness, not a completed payment. Wallet submission remains available with the same proof and deployment checks.

Privy remains optional. If enabling it, follow [organization service setup](../services/organization/README.md) for app credentials, wallet, owner quorum, policies, threshold, and member DIDs, then run `pnpm organization`. Membership grants access to request approval; the actual quorum and policies decide whether an intent can be signed. Empty credentials do not enable this integration.

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

Retain actual deployment manifests, build/source checksums, transaction receipts, and local service configuration status. Record Graph, Privy, or CRE execution evidence separately if those integrations are later enabled. Avoid inserting credentials or private witnesses into public evidence files. [Implementation status](IMPLEMENTATION_STATUS.md) and [sponsor compliance](SPONSOR_COMPLIANCE.md) distinguish recorded results from remaining work.

The v0.2 deployment includes a withdrawal verifier. Full local flow and withdrawal tests have executed; see WITHDRAWAL_VERIFICATION.md. There is no independent security audit. Deployment should not be interpreted as permission to use real-value assets or as proof that the privacy and recovery guarantees are validated.

