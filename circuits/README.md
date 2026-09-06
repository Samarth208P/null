# NULL circuits

All three circuits use private witnesses, canonical field encodings, fixed arities and purpose-separated hashes. Solidity checks the public chain/pool context, current block deadline and accepted root history.

| Circuit | Public input order |
| --- | --- |
| `shield` | version, chain, pool, amount, treasuryBody, authPolicy |
| `create_distribution` | version, chain, pool, noteRoot, authRoot, nullifier0, nullifier1, distributionCommitment, envelopeRootHi128, envelopeRootLo128, changeBody, transportTagHi128, transportTagLo128, nonce, validUntil |
| `claim` | version, chain, pool, globalDistributionRoot, claimNullifier, privateBody, nonce, validUntil |

Each `main.nr` accepts one `inputs` public array with that exact order. All other arguments are private. SDK witness builders use the corresponding source ABI. Generated artifact ABIs are authoritative.

Run `node tools/build-circuits.mjs` from the repository root to compile through pinned Noir WASM. Add `--verifiers` to generate the ZK-enabled EVM verification keys and Solidity verifier source. No native Nargo/BB installation is required. `circuits/Nargo.toml` also permits native Nargo compilation at the pinned version.

Claims recompute a hidden allocation, hidden allocation root and hidden distribution commitment, then prove membership in the global distribution tree. They enforce a real positive allocation, deterministic consumption nullifier, exact hidden output amount, nonzero owner secret and an ECDSA signature under the hidden one-time key. The signed digest includes the output commitment and public relay context.

Distribution proofs constrain both note inputs, the optional phantom input, registered organization policy membership and its hidden secp256k1 authorization, eight allocation flags/amounts, value conservation and the change/distribution commitments. Shield proofs bind a public entry amount to the hidden treasury note body.

No witness/proof tests have been executed as part of this development request. Compilation and generated checksums alone do not establish circuit soundness, cross-language hash equivalence or deployed behavior. The acceptance work described in the PRD remains deferred.
