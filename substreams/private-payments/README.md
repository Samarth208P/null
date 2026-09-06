# Composable private-payments events

`map_private_payments` consumes successful canonical Ethereum block receipt logs and emits the versioned `null.payments.v1.PaymentEvents` protobuf. Public context identifies chain, block/hash, transaction, emitter and log index; a oneof separates envelope, distribution, consumption and note payloads. Consumers can compose this module into wallet discovery, an index or public accounting without introducing decrypted fields. NULL consumption has no source-distribution link.

The decoder imports the generated Solidity ABI at build time. ERC-5564 uses its published Announcement ABI. A protocol discriminator keeps ERC-5564 public metadata distinct from NULL authenticated ciphertext. No employee names, amounts, wallet keys or secret query parameters exist in the normalized message.

Build after generating `contracts/abi/NullPool.json`:

```sh
cargo build --release --target wasm32-unknown-unknown
substreams pack substreams.yaml
substreams run substreams.yaml map_private_payments --params 'map_private_payments=chain_id=11155111;null_pool=ACTUAL_POOL_ADDRESS;erc5564=VERIFIED_ANNOUNCER_ADDRESS' --start-block ACTUAL_DEPLOYMENT_BLOCK
```

Omit `;erc5564=...` to index only NULL. Supply your provider endpoint/token through the Substreams CLI configuration. Never put recipient keys in module parameters. Bind `chain_id` to that endpoint's network when deploying; the block protobuf is chain-generic. Configure persistent consumers to process undo signals and roll back by block hash before advancing their cursor. Replaying a block gives stable public event identities.

This source has not been built here because Rust/Substreams tooling is not installed. No `.spkg`, provider execution or downstream Substreams-powered subgraph deployment is claimed. The supplied event-based Graph subgraph is an independently deployable adapter over the same event model; it does not claim to consume this module until an actual Substreams sink integration is deployed.

Upstream interfaces: [Ethereum block/log views](https://github.com/streamingfast/substreams-ethereum/blob/develop/core/src/block_view.rs), [Substreams Rust SDK](https://github.com/streamingfast/substreams-rs).
