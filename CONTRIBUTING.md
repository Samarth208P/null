# Development

Use the pinned workspace versions and keep protocol encodings aligned across TypeScript, Noir and Solidity. `PRD.md` preserves the original protocol specification. Use `PRODUCT.md`, the current integration guide and submission readiness for implemented behavior and release boundaries; document architectural departures in `docs/ADR/`.

Keep confidential operations in local workers and public network payloads explicitly allowlisted. Do not serialize an entire compiled distribution object to a service: it contains allocation openings. Export only the dedicated public bundle or public proof operation.

After changing shared formulas, rebuild circuit/verifier artifacts and generated ABIs together. A deployment manifest must bind the resulting sources, artifacts, verification keys and runtime bytecode. Do not silently reuse a version for different semantics.

Run `pnpm check`, `pnpm test:submission`, `pnpm test:payouts` and `pnpm build` for relevant shared/client changes. Circuit changes also need the matching negative tests, regenerated artifacts and genuine-proof rehearsal. Existing tests are recorded in `docs/PAYOUT_V3_VERIFICATION.md`; they do not replace independent security review, broader invariants or a privacy audit. Keep compilation, local proof execution and public deployment evidence distinct.
