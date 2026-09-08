# Local integration setup

All runtime credentials belong in the ignored root `.env`. `pnpm dev:all` starts the local web app on `127.0.0.1:5173` and relayer on `127.0.0.1:8787`. It also starts the authenticated payroll API on `127.0.0.1:8789` when its token is configured, and the organization service only when all its settings and browser URL are configured. Only `VITE_` values are public browser configuration. Restart or reload the web app after environment changes; a sequence of Vite environment restarts can leave an old browser tab disconnected until it is reloaded.

## Current update — 2026-09-07

The dedicated owner-quorum wallet is now provisioned and its live controls were verified. The default setup:privy command explicitly reuses this configuration. The new identity-only approval obtains its public key before NULL policy registration. For current local and Netlify setup, follow [the deployment guide](NETLIFY_SUBMISSION.md).

The event subgraph is deployed. Substreams now builds and passes tests, but Studio rejects SPS hosting and standalone execution requires a provider credential. The browser now exports a payment to the real CRE simulator and imports its checked result. [Current readiness](SUBMISSION_READINESS.md) supersedes the historical limitations and setup advice below.

## Historical verification on 2026-09-06

- Privy app credentials were accepted by the live API, and the owner completed email login in the local app.
- A single-user owner quorum and a Privy organization were created and their IDs saved in root `.env`. `pnpm setup:privy` reuses them and checks their ownership. It does not create a new organization on each run.
- The live Privy policy API returned HTTP 400, code `invalid_data`, cause `invalid_enum_value` at `rules.0.method` for `secp256k1_sign`. No organization signing wallet or permissive fallback policy was created. The local treasury signer and its registered policy remain available.
- CRE CLI was updated from 1.0.11 to 1.32.0 while retaining the existing login. Its authenticated status showed deployment access not enabled and the private registry available. The standard deployment-access request was submitted and is pending review; confidential-workflow beta access is separate.
- A separate CRE trigger key and payroll API bearer were generated in root `.env`. Neither needs test ETH. The compiler built locally; this does not establish a remote TEE execution.
- The Graph manifest was generated from `deployments/11155111.json`; code generation and WASM build passed. No Studio credentials were available, so no external Graph deployment occurred.

## Privy

Run `pnpm privy:status` for credential and resource presence checks. Run `pnpm setup:privy` only with the confirmed owner DID in `PRIVY_ORGANIZATION_MEMBER_IDS`; it provisions or verifies the one-owner demo organization. API mutation attempts use a local resource/request journal to avoid duplicate creation after uncertain responses.

Keep `VITE_ORGANIZATION_URL` blank until a provider-supported policy for the exact raw-signature operation is verified. Filling IDs alone cannot complete the authorization flow. Do not replace raw signing with `personal_sign` or typed-data signing: the circuit expects a different digest. Do not enable unrestricted wildcard signing to work around the provider's policy schema.

A future Privy wallet also needs its own NULL policy opening and onchain registration. The existing local treasury policy is bound to the local signer. Quorums larger than one additionally need the app's multi-approver collection flow.

References: [Privy policies](https://docs.privy.io/controls/policies/overview), [raw signing](https://docs.privy.io/api-reference/wallets/ethereum/secp256k1-sign).

## CRE

`pnpm cre:status` checks the CLI session and registries. `pnpm cre:build` builds the workflow with the installed CRE CLI. `pnpm setup:cre --init-credentials` reuses or initializes the dedicated local credentials. Set `NULL_PAYROLL_BASE_URL` to a real authenticated HTTPS batches API, then run `pnpm setup:cre` to generate `.artifacts/cre/config.staging.json` from root `.env`; the tracked secrets file contains names only.

The included `pnpm payroll:serve` binds only to loopback and requires the root API bearer; it is also started by `pnpm dev:all`. `pnpm payroll:import --input <private-batch.json>` validates and preserves an immutable batch in protected local storage. No batch was generated or imported during setup. A deployed workflow will need an authorized HTTPS connection to this API; localhost cannot be used as its remote endpoint.

Deployment needs standard access approval, separate Confidential Workflows beta enrollment, secret upload, and an actual API that supplies the immutable payroll batch expected by the compiler. The local frontend can stay local. Hosted confidential execution must have an explicitly free allowance to satisfy this project's cost constraint. No mainnet registry or paid service is configured.

`pnpm cre:trigger --input <public-trigger.json>` validates and plans a public trigger locally; `--execute` signs and sends it after deployment. The documented gateway returns acceptance and an execution ID, not the completed compiler bundle. `--result <completed-output.json>` checks a separately obtained result against the expected roots, chain, pool, and envelopes. This file check does not authenticate CRE provenance or TEE execution. An authenticated completed-output retrieval path and its UI connection remain unfinished; see the [workflow instructions](../services/cre-workflow/README.md#signed-public-trigger-and-result-checks).

References: [deployment access](https://docs.chain.link/cre/account/deploy-access), [confidential access](https://docs.chain.link/cre/account/confidential-workflows-access), [private registry](https://docs.chain.link/cre/guides/operations/deploying-to-private-registry-ts).

## Graph

Set `GRAPH_STUDIO_SLUG`, `GRAPH_STUDIO_DEPLOY_KEY`, and `GRAPH_VERSION_LABEL` in root `.env`. `pnpm graph:deploy` prints a local plan; `pnpm graph:deploy --deploy` deploys to the fixed Studio development service. Put the returned development query endpoint in `VITE_GRAPH_URL`. The app continues to use RPC when that URL is blank.

The deploy key is never a `VITE_` value. Studio development deployment is separate from onchain network publication. The configured command does not publish to the decentralized network or enable billing. See the [Studio guide](https://thegraph.com/docs/en/subgraphs/developing/deploying-publishing/using-subgraph-studio/).
