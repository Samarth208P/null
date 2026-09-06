# Security status

**Unaudited hackathon prototype. Testnet only. Do not use production-value assets.**

The user explicitly deferred testing for this development pass. Circuit negative tests, invariants, fuzzing, adversarial recipient/relayer cases, privacy audits and end-to-end validation remain required before release. Passing a compiler is not evidence of soundness.

The MVP has no withdrawal or administrative asset-recovery path. A successful deposit should be treated as entering a prototype with no public exit. There is no admin seizure function. Losing treasury openings can make notes unrecoverable.

The critical trust boundaries are the generated verifier and SRS, matching circuit/hash encodings, token behavior, immutable runtime addresses, local random generation, client-side key custody, organization authorization, confidential compiler delivery integrity and authenticated chain history.

Do not add logging that includes payroll, witness material, profile secrets, private signatures, note openings or recovery passwords. Do not put confidential material in URLs, analytics, Graph filters, server actions or relayer payloads. Browser `VITE_` variables are public.

Deployment tooling and live clients fail closed on absent addresses, incompatible versions, incorrect hashes, stale roots and mismatching public inputs. Hosted providers are replaceable; recipient keys are never uploaded. Standard metadata anonymity, compromised endpoints and employer knowledge remain outside the protocol guarantee.

Use the privacy matrix in [docs/PRIVACY_GUARANTEES.md](docs/PRIVACY_GUARANTEES.md) when describing the product. Do not claim an audit, live sponsor success, production anonymity or a complete test suite.
