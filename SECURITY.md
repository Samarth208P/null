# Security status

**Unaudited hackathon prototype. Testnet only. Do not use production-value assets.**

Circuit negative tests and complete local/public-chain payment rehearsals have run. Passing cases are not an audit or a complete adversarial assessment. See [v0.3 verification](docs/PAYOUT_V3_VERIFICATION.md) and the [historical Sepolia receipt](deployments/payment-flow-sepolia-v2.json). Independent cryptographic review, wider invariants/fuzzing and production operational hardening remain necessary.

The canonical Sepolia v0.2 pool supports full-note withdrawals and policy-approved treasury refunds. The new immutable v0.3 pool adds recipient partial withdrawals with exact private change and has passed a complete local-chain run with genuine proofs. It is not deployed publicly; existing v0.2 funds do not migrate automatically. There is no admin seizure function. Losing note openings can make funds unrecoverable.

The critical trust boundaries are the generated verifier and SRS, matching circuit/hash encodings, token behavior, immutable runtime addresses, local random generation, client-side key custody, organization authorization, confidential compiler delivery integrity and authenticated chain history.

Do not add logging that includes payroll, witness material, profile secrets, private signatures, note openings or recovery passwords. Do not put confidential material in URLs, analytics, Graph filters, server actions or relayer payloads. Browser `VITE_` variables are public.

Deployment tooling and live clients fail closed on absent addresses, incompatible versions, incorrect hashes, stale roots and mismatching public inputs. Hosted providers are replaceable; recipient keys are never uploaded. Standard metadata anonymity, compromised endpoints and employer knowledge remain outside the protocol guarantee.

Use the privacy matrix in [docs/PRIVACY_GUARANTEES.md](docs/PRIVACY_GUARANTEES.md) when describing the product. Do not claim an audit, live sponsor success, production anonymity or a complete test suite.

ENS is required in the high-level payout API and live reference flow, not by the circuit or pool contract. Name lookups and public profiles expose metadata; ENS does not establish a person's legal identity. Claims, recovery and withdrawals remain available after name expiry.

Payout and withdrawal jobs are in-memory sequential coordinators, not durable queues or all-or-nothing transactions. Persist encrypted checkpoints before each send and retain confirmed receipts. A timeout or `not-observed` result never justifies a replacement payment. After reload, recover and reconcile chain state before creating another job. Do not serialize private notes into an ordinary job database.

Partial-withdrawal change uses a new secret opening. The original Payment ID alone cannot recover that remainder: preserve the updated encrypted funds checkpoint/backup before broadcast. A confirmed transaction with `localRecoverySaved: false` succeeded on chain; it must not be labelled failed and retried.

The bundled relayer is a reference broadcaster. CORS and per-IP limits do not authenticate a customer or enforce a sponsor budget. Integrators must authenticate requests, constrain chain/pool/method, manage spending limits and fund a separate server-side gas key. The sponsor callback receives only public operations. Simulation cannot eliminate execution races or fees.

Deposits, withdrawals, their amounts, wallets and timing remain public. The new change commitment appears in the withdrawal transaction. Small anonymity sets, repeated exits and funding/timing patterns can reveal relationships. Do not promise “no trace.” The new local flow used an isolated organization signer; a Privy owner-approved financial rehearsal remains outstanding. CRE evidence remains CLI local simulation without remote enclave attestation.
