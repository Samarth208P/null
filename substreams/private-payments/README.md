# Composable private-payments events

`map_private_payments` consumes successful canonical Ethereum block receipt logs and emits the versioned `null.payments.v1.PaymentEvents` protobuf. Public context identifies chain, block/hash, transaction, emitter and log index; a oneof separates envelope, distribution, consumption and note payloads. Consumers can compose this module into wallet discovery, an index or public accounting without introducing decrypted fields. NULL consumption has no source-distribution link.

The decoder imports the generated Solidity ABI at build time. ERC-5564 uses its published Announcement ABI. A protocol discriminator keeps ERC-5564 public metadata distinct from NULL authenticated ciphertext. No employee names, amounts, wallet keys or secret query parameters exist in the normalized message.

Build after generating `contracts/abi/NullPool.json`:

```sh
cargo build --release --target wasm32-unknown-unknown
substreams pack substreams.yaml -o ../../subgraph/null-private-payments.spkg
substreams run substreams.yaml map_private_payments --params 'map_private_payments=chain_id=11155111;null_pool=ACTUAL_POOL_ADDRESS;erc5564=VERIFIED_ANNOUNCER_ADDRESS' --start-block ACTUAL_DEPLOYMENT_BLOCK
```

Omit `;erc5564=...` to index only NULL. Supply your provider endpoint/token through the Substreams CLI configuration. Never put recipient keys in module parameters. Bind `chain_id` to that endpoint's network when deploying; the block protobuf is chain-generic. Configure persistent consumers to process undo signals and roll back by block hash before advancing their cursor. Replaying a block gives stable public event identities.

Verified on September 7, 2026: the Rust/WASM build and package generation passed with Rust 1.88.0 and Substreams CLI 1.22.0. Two Rust tests cover shared NULL/ERC-5564 fields, deterministic replay, and malformed context. The `graph_out` module produces canonical EntityChanges, using the schema from `proto/entity.proto` (upstream [StreamingFast entity-change schema](https://github.com/streamingfast/substreams-entity-change/blob/develop/proto/sf/substreams/sink/entity/v1/entity.proto), Apache-2.0).

**Hosting boundary:** Graph Studio rejected `subgraph.sps.yaml` on September 7 with "Substreams-powered Subgraphs ... are no longer supported." This manifest is a compatibility reference, not the supported Studio deployment path. Keep the working event subgraph on `v0.1.0`. Run this package against a standalone Substreams provider instead. The documented Sepolia endpoint is `sepolia.eth.streamingfast.io:443`; a bounded request returned `Unauthenticated` without a provider token. No successful live Substreams execution is claimed. Configure a provider credential privately through the CLI before recording the live module demo; never substitute the Graph Studio deploy key.

For the prize demo, show this shared event model over NULL and ERC-5564 and a live provider run with a real consumer. A successful build or an independent live event subgraph alone does not establish a composed live pipeline.

Upstream interfaces: [Ethereum block/log views](https://github.com/streamingfast/substreams-ethereum/blob/develop/core/src/block_view.rs), [Substreams Rust SDK](https://github.com/streamingfast/substreams-rs).
