# NULL contracts

The Solidity source implements the immutable single-asset pool, a permissionless organization-policy accumulator, and append-only Poseidon trees. The three required verifier contracts are generated from the Noir sources; an accept-all proof implementation is not provided.

From the repository root:

```sh
pnpm install
node tools/build-circuits.mjs --verifiers
node contracts/scripts/build.mjs
```

These are development builds and do not execute behavioral tests. The second command generates actual ZK-enabled EVM verifiers and verification keys through pinned Barretenberg WASM. It can need substantial memory and download public SRS data. The third command compiles Solidity and regenerates `@null-protocol/contracts` ABI exports from source. Foundry can also compile the source using `contracts/foundry.toml`.

The build outputs are under `circuits/target` and `contracts/artifacts`. Preserve the generated manifest and checksums together. Solidity artifacts retain source-qualified identities and link references, so libraries with the same name from different generated verifier sources cannot overwrite one another. The deployment command synchronizes the matching public circuit files and manifest for the web app.

Run `pnpm setup:sepolia` to create the single access-restricted, Git-ignored root `.env` from [the root template](../.env.example). It creates a deployer key only when one is absent and preserves existing nonempty configuration. `pnpm deploy:plan` loads this file, checks the chain, asset, artifact integrity, and library links, and prints a funding allowance at the current RPC fee quote. This is an allowance, not an exact deployment cost. Configuration also supports `NULL_MAX_FEE_GWEI`, `NULL_MAX_DEPLOYMENT_ETH`, and optional `NULL_GIT_COMMIT`; see [deployment setup](../docs/DEPLOYMENT.md).

After funding the displayed public address with Sepolia ETH, `pnpm deploy:sepolia` broadcasts or resumes the current eight-contract sequence: Poseidon, two deduplicated verifier libraries, the authorization registry, three genuine verifiers, and the pool. It saves transaction progress, checks runtime code and pool bindings, and writes `deployments/11155111.json` plus matching browser artifacts and root `.env` values. Preserve `.env` and the deployment journal when resuming. It does not approve tokens, shield funds, or deploy a faucet asset onto a public chain. Never commit a deployer key. See [implementation status](../docs/IMPLEMENTATION_STATUS.md) for actual execution evidence and [free defaults](../docs/FREE_SEPOLIA.md) for optional integration limits.

The browser and relay stay local. `pnpm treasury:init` creates a separate signer and policy opening, and `pnpm treasury:register --broadcast` registers its public commitment after deployment. The [treasury guide](../tools/TREASURY.md) explains approving an exact distribution intent without Privy. None of these setup commands generates a payment proof or deposits funds.

`deployments/sepolia.template.json` describes an unconfigured environment. Address and checksum placeholders are null, so dependent services cannot mistake source readiness for a deployment. Generated deployment manifests record actual runtime code hashes.

`NoteInserted` is the canonical event for rebuilding note-tree leaves. It occurs alongside `Shielded` or `AllocationConsumed` where applicable; inserting all three events would duplicate leaves. Distribution trees use `DistributionInserted`. Policy trees use `PolicyRegistered`.

See [ADR 0002](../docs/ADR/0002-contract-and-circuit-boundaries.md) for proof/public-input ordering, root windows, zero-value change, shield amount binding, and the absence of withdrawals.
