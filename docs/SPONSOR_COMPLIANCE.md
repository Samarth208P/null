# Sponsor integration status

**Historical implementation snapshot:** the external-evidence gaps below describe an earlier development stage. For current recorded execution and remaining actions, use [submission readiness](SUBMISSION_READINESS.md) and the [sponsor evidence walkthrough](SPONSOR_EVIDENCE.md). In particular, successful local CRE simulation, live ENS reads and published Graph discovery now have evidence; a complete Privy-approved payout remains pending in the available record.

This file separates developed integrations from demonstrated external execution. Source implementation, local source compilation and a hosted sponsor deployment are different milestones. No placeholder address, local draft or login is evidence of an onchain private distribution.

| Integration | Implemented source | External evidence still required |
| --- | --- | --- |
| Privy | Canonical raw secp256k1 circuit-intent request; owner-quorum, organization entity, required policies and signer-address validation; private signature witness; browser login/wallet surface; authenticated organization API and exact-intent browser approval helper | Real configured organization wallet, registered auth-policy commitment, successful exact-intent quorum approval, resulting verified distribution transaction |
| Chainlink CRE | Actual `handlerInTee` with Nitro constraint; TEE secret retrieval and payroll HTTP request; deterministic eight-slot compiler; exact local/TEE commitment comparison; public-only output; independent local compiler; WASM source build | Successful confidential simulation/deployment, supported TEE access, workflow ID, attestation/evidence, sanitized execution output |
| The Graph | Public standardized Graph schema; generated-ABI mappings for NULL and optional ERC-5564; browser broad-range queries with RPC fallback; reusable protobuf Substreams normalizer source | Deployed Graph endpoint and live provider data; Rust/Substreams compilation/package; deployed composable Substreams sink if claiming a Substreams-powered subgraph |

The Graph mapping source was compiled locally for both event adapters with inert build-only addresses. Its production manifest generator requires a real deployed manifest. The CRE source compiled to WASM using SDK 1.19.1 and Javy 8.1.0. Authentication credentials, deployment keys and provider endpoints were not supplied, so no external sponsor operation is represented as completed. Tests were intentionally left for the user-requested later phase.

## Trust boundaries

Privy governs new organization actions. The owner request signs the exact 32-byte Poseidon digest verified inside the distribution circuit; it is not an unbound personal-sign message. The request also includes the API wallet ID and short expiry for Privy authorization. The server app secret alone cannot replace owner-quorum signatures on the configured owner-only wallet. Privy availability does not govern previously published recipient claims.

The TEE sees the employer's payroll rows, public recipient profiles and a batch-specific entropy value. It does not hold recipient spending/viewing keys, treasury signing secrets or unilateral spending authority. Public expected roots bind local preflight to TEE output. Encryption semantics remain outside the ZK circuit; a malicious payroll input source or compiler can withhold or corrupt delivery and cause denial of service. Matching deterministic compilation mitigates implementation disagreement, not compromised employer endpoints.

The Graph and RPC providers see broad public block-range queries and client network metadata. Secret viewing/filtering stays in the browser. A transport schema does not itself establish anonymity. ERC-5564 announcement metadata can be public plaintext and is explicitly separated with `protocol: ERC5564`; NULL public ciphertext remains fixed length. The Substreams adapter and event subgraph currently implement the same message model independently; a live Substreams-to-subgraph composition is not yet claimed.

The relayer sees proofs, public roots/nullifiers/commitments, ciphertext and network metadata. It cannot change a valid proof's output commitment. A broadcast result is not a final receipt. Another gas wallet can use the self-broadcast CLI without a hosted relay.

## Evidence to record after deployment

Record sanitized transaction hashes, actual deployment addresses/runtime code hashes, immutable circuit/proving artifact checksums, Graph deployment ID/query block, CRE workflow execution ID and evidence of the configured Privy owner-quorum threshold/policy. Do not record payroll inputs, deterministic batch entropy, recipient private keys, authorization signatures or private proving witnesses in public logs. Do not mark qualification complete until the external event exists and its evidence is reviewable.

## Primary implementation references

- [Privy raw secp256k1 signing](https://docs.privy.io/api-reference/wallets/ethereum/secp256k1-sign)
- [Privy authorization request construction](https://docs.privy.io/controls/authorization-keys/using-owners/sign/utility-functions)
- [Privy wallet controls](https://docs.privy.io/api-reference/wallets/get) and [owner quorum metadata](https://docs.privy.io/api-reference/key-quorums/get)
- [Official Chainlink TypeScript SDK](https://github.com/smartcontractkit/cre-sdk-typescript) — published 1.19.1 `handlerInTee`, `TeeRuntime`, HTTP capability and runner declarations inspected during implementation
- [The Graph manifests and mappings](https://thegraph.com/docs/en/subgraphs/developing/creating/subgraph-manifest/) and [cursor pagination](https://thegraph.com/docs/en/subgraphs/querying/graphql-api/)
- [Substreams Ethereum block/log interface](https://github.com/streamingfast/substreams-ethereum/blob/develop/core/src/block_view.rs)
- [ERC-5564](https://eips.ethereum.org/EIPS/eip-5564)
