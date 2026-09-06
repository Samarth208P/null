# NULL contracts

The Solidity source implements the immutable single-asset pool, a permissionless organization-policy accumulator, and append-only Poseidon trees. The three required verifier contracts are generated from the Noir sources; an accept-all proof implementation is not provided.

From the repository root:

```sh
pnpm install
node tools/build-circuits.mjs --verifiers
node contracts/scripts/build.mjs
```

These are development builds and do not execute behavioral tests. The second command generates actual ZK-enabled EVM verifiers and verification keys through pinned Barretenberg WASM. It can need substantial memory and download public SRS data. The third command compiles Solidity and regenerates `@null-protocol/contracts` ABI exports from source. Foundry can also compile the source using `contracts/foundry.toml`.

The build outputs are under `circuits/target` and `contracts/artifacts`. Preserve the generated manifest and checksums together. Copy the exact circuit JSON files to the web server's `/circuits/` path; copy their artifact references into the reviewed deployment manifest.

Deployment configuration uses `NULL_RPC_URL`, `NULL_ASSET_ADDRESS`, `NULL_DEPLOYER_PRIVATE_KEY`, optional `NULL_CHAIN_ID` (Sepolia by default), and `NULL_GIT_COMMIT`. Run `node contracts/scripts/deploy.mjs` to produce a concrete deployment plan. The script broadcasts only when explicitly invoked with `--broadcast`. It does not approve tokens, shield funds, or use the local faucet asset on a public network. Never commit a deployer key.

`deployments/sepolia.template.json` describes an unconfigured environment. Address and checksum placeholders are null, so dependent services cannot mistake source readiness for a deployment. Generated deployment manifests record actual runtime code hashes.

`NoteInserted` is the canonical event for rebuilding note-tree leaves. It occurs alongside `Shielded` or `AllocationConsumed` where applicable; inserting all three events would duplicate leaves. Distribution trees use `DistributionInserted`. Policy trees use `PolicyRegistered`.

See [ADR 0002](../docs/ADR/0002-contract-and-circuit-boundaries.md) for proof/public-input ordering, root windows, zero-value change, shield amount binding, and the absence of withdrawals.

