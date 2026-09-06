# Development

Use the pinned workspace versions and keep protocol encodings aligned across TypeScript, Noir and Solidity. `PRD.md` is the source specification; document departures in `docs/ADR/`.

Keep confidential operations in local workers and public network payloads explicitly allowlisted. Do not serialize an entire compiled distribution object to a service: it contains allocation openings. Export only the dedicated public bundle or public proof operation.

After changing shared formulas, rebuild circuit/verifier artifacts and generated ABIs together. A deployment manifest must bind the resulting sources, artifacts, verification keys and runtime bytecode. Do not silently reuse a version for different semantics.

The current development pass excludes tests by user request. Before a security or release phase, implement the PRD's circuit negatives, Foundry invariants, cross-language vectors, privacy audits and end-to-end flows. Keep compiler output and actual runtime validation clearly distinguished.
