# Confidential distribution compiler

`src/main.ts` registers an actual CRE `handlerInTee` using the published `@chainlink/cre-sdk` 1.19.1 interfaces. The Nitro handler obtains its payroll API credential with `TeeRuntime.getSecret`, calls `HTTPClient.sendRequest` with that same TEE runtime, validates payroll, compiles eight encrypted slots, and returns only public ciphertext and roots. It never switches sensitive work to the DON runtime. It cannot spend treasury funds or create recipient spend/view keys.

The authenticated HTTP trigger accepts only `{batchId, expectedCommitment, expectedEnvelopeRoot}`. The caller first compiles locally and supplies those exact expected roots. The payroll API returns `{batchId, batchEntropyHex, recipients}` where each recipient has `{employeeRef, amountAtomic, stealthMetaAddress}`. Amounts are base-10 integer atomic units. `batchEntropyHex` is a unique secret 32-byte value for this exact batch, shared only with the authorized employer and the TEE. Persist it with encrypted employer recovery data; never reuse it for another batch or publish it in trigger input/config/logs. The payroll service must authorize and bind its batch ID to the exact immutable dataset and entropy. Random entropy is not generated with CRE's deterministic general-purpose random source.

AES-256-GCM uses the same wire format as the SDK. The TEE selects the pure JavaScript `@noble/ciphers` implementation because browser WebCrypto is absent from CRE WASM. The workflow source and dependency graph compiled to `build/compiler.wasm` using SDK 1.19.1 and Javy 8.1.0. Rebuild with `pnpm --filter @null-protocol/cre-workflow build` (Bun required). A successful WASM build does not establish successful enclave execution.

Use the repository root `.env` for all local credentials. No service-level `.env` is needed. From the repository root:

```sh
pnpm --filter @null-protocol/cre-workflow status:cre
pnpm --filter @null-protocol/cre-workflow setup:env --init-credentials
pnpm --filter @null-protocol/cre-workflow build:cli
```

`--init-credentials` creates a separate `NULL_CRE_TRIGGER_PRIVATE_KEY` and its `NULL_CRE_TRIGGER_ADDRESS`, plus a random `NULL_PAYROLL_API_TOKEN`. It preserves existing values, uses the protected root environment writer, and never prints secrets. This trigger signer authorizes off-chain HTTP requests and needs no ETH. `setup:env` without that option only reads `.env` and generates configuration. Setup returns exit status 2 while required fields are missing; initialized credentials remain saved.

Set `NULL_PAYROLL_BASE_URL` to an authorized, reachable HTTPS endpoint ending in the application's batches path. The workflow requests `${NULL_PAYROLL_BASE_URL}/${batchId}` with `Authorization: Bearer ${NULL_PAYROLL_API_TOKEN}`. The endpoint must authenticate that token and return the exact immutable batch described above. These are application-owned API values; Chainlink does not issue them. The local API below provides the required data contract. Local web development needs no public web hosting, but a deployed enclave cannot fetch payroll from a localhost-only API. Do not expose plaintext payroll through an unauthenticated tunnel or upload it to a general workflow trigger.

After the endpoint is configured, rerun `setup:env`. It checks the Sepolia manifest and writes `.artifacts/cre/config.staging.json`, which is Git-ignored and denied by the local web server. That file contains public configuration only. The `authorizedPublicKey` field holds the trigger signer's **EVM address**, as required by `KEY_TYPE_ECDSA_EVM`; it is not a raw secp256k1 public key. The tracked `secrets.yaml` contains only secret names. The CLI wrappers explicitly read the root `.env`, and `project.yaml` supplies a free public Sepolia RPC.

`workflow.yaml` explicitly selects the Chainlink-hosted **private** registry. This avoids mainnet workflow-registry transactions and linked deployment wallets. Registry selection does not grant deployment access or confidential execution. Standard deployment approval and separate Confidential Workflows private-beta approval are required. The installed account's actual state can be checked with `status:cre`; submit the ordinary account request with `cre account access` when authorized. No API key is needed for the current CLI login; `CRE_API_KEY` is optional for unattended CI.

After both approvals, a verified HTTPS payroll API, and confirmation that the account's hosted execution allowance is free, the remaining explicit operations are:

```sh
cd services/cre-workflow
cre secrets create secrets.yaml --project-root . --env ../../.env --target staging-settings --secrets-auth browser
cre workflow deploy . --project-root . --env ../../.env --target staging-settings
```

The first command uploads the API token to Chainlink's secret manager; generating local config does not upload it. The second deploys the private-registry workflow. Store its returned ID as `NULL_CRE_WORKFLOW_ID` in the root `.env`. The CLI below can sign a public trigger request to the fixed private gateway. The gateway returns an acceptance receipt, not the completed compiler output; setting a workflow ID alone does not make the UI execute CRE or receive results. Do not put the trigger key, API token, or `CRE_API_KEY` in any `VITE_` variable.

The CLI's `build:cli` command compiles locally without uploading or executing the workflow. Local `workflow simulate` can make real HTTP requests, so use only a controlled synthetic fixture and omit `--broadcast`. Private registry management needs no gas, but the public documentation does not promise permanently free hosted TEE execution; confirm the granted allowance before deployment.

The local authenticated payroll API works without CRE access. Import an existing, user-provided payroll JSON file with an absolute path, then start the server:

```sh
pnpm --filter @null-protocol/cre-workflow payroll:import --input C:/path/to/private-payroll.json
pnpm --filter @null-protocol/cre-workflow payroll:serve
```

The importer accepts only the `{batchId, batchEntropyHex, recipients}` schema above, one to eight valid recipients, valid privacy profiles, unique canonical recipient references, and at most 65,536 UTF-8 bytes. It creates no recipients or batch entropy. It preserves the input bytes in `.artifacts/cre/payroll/<batchId>.json`, applies current-user-only file permissions before writing private data, and atomically refuses an existing batch ID. Source JSON files remain the caller's responsibility; keep them private. Use a new batch ID and fresh batch entropy for a different dataset.

The server binds **only `127.0.0.1`**, using `NULL_PAYROLL_PORT` from the root `.env` or port **8789** by default. Its only data route is `GET /batches/<batchId>`, authenticated with the existing `NULL_PAYROLL_API_TOKEN`. It compares bearer credentials in constant time, accepts no request body, rejects browser origins, provides no CORS headers, disables response caching, and logs neither batch IDs nor payroll. There is no upload, list, update, delete, or remote binding route. The local address is `http://127.0.0.1:8789/batches`; do not use that HTTP address as `NULL_PAYROLL_BASE_URL` for a deployed workflow. Public HTTPS routing and its provider costs require a separate, authorized setup.

An HTTPS reverse proxy must preserve the bearer header and rewrite its upstream `Host` to `127.0.0.1:<NULL_PAYROLL_PORT>`; the API rejects other hosts. Keep its loopback binding and browser-origin rejection in place.

The independent local compilation path also works without CRE:

```sh
pnpm --filter @null-protocol/cre-workflow compile:local --input private-payroll.json --context context.json --output public-bundle.json
```

`context.json` contains chainId and poolAddress. The output is marked `local-fallback` and `confidentialExecution: false`. The CLI refuses to overwrite an existing file. Do not deploy this CLI as a server accepting plaintext payroll. Existing recipients always discover and claim from chain history independently of this compiler.

## Signed public trigger and result checks

Prepare a local JSON file containing exactly `batchId`, `expectedCommitment`, and `expectedEnvelopeRoot`, using the roots from the independently reviewed local compilation. Both roots must be 32-byte hex values. Payroll rows, amounts, recipient references, keys, and batch entropy are rejected as extra fields; they must never be placed in this trigger file.

From the repository root:

```sh
pnpm --filter @null-protocol/cre-workflow trigger:cre --input .artifacts/cre/public-trigger.json
# After deployment/access and free execution allowance are confirmed:
pnpm --filter @null-protocol/cre-workflow trigger:cre --input .artifacts/cre/public-trigger.json --execute
```

Input paths resolve from the repository root. The default command performs a local plan only. `--execute` requires the deployed workflow ID, separate trigger key/address, matching Sepolia manifest, and generated CRE configuration. It uses the official private gateway, canonical sorted JSON, a SHA-256 request digest, and a 60-second ETH JWT signed with the trigger key. Neither the key nor JWT is printed or saved. It sends only the public trigger object. The scheme follows the [official request protocol](https://docs.chain.link/cre/guides/workflow/using-triggers/http-trigger/triggering-deployed-workflows) and [TypeScript signing reference](https://github.com/smartcontractkit/cre-sdk-typescript/blob/main/packages/cre-http-trigger/src/create-jwt.ts).

The CLI saves a public receipt under `.artifacts/cre/trigger-<request-id>.json`. An `accepted` receipt means only that the gateway admitted the trigger. It does not confirm completion, return the bundle, or verify TEE attestation. Uncertain responses are recorded without automatic retries; check the request/execution in CRE before sending again. The documented [execution commands](https://docs.chain.link/cre/reference/cli/execution) expose status, events, and logs. No undocumented result endpoint or polling schema is assumed here.

When the exact completed callback output has been obtained through an independently verified route, save that object locally and validate it against the same reviewed trigger:

```sh
pnpm --filter @null-protocol/cre-workflow trigger:cre --input .artifacts/cre/public-trigger.json --result .artifacts/cre/completed-output.json
```

The result must contain exactly `{mode: "cre-tee", publicBundle: ...}`, matching this workflow's return type. The verifier rejects extra fields, requires eight valid fixed-size envelopes, recomputes their root with the SDK, and checks both expected roots plus the Sepolia chain and pool. It saves the validated public bundle under `.artifacts/cre/verified-bundle-*.json`. This local file check does not authenticate the result's CRE origin or prove enclave execution. Automated completed-output retrieval and UI integration remain separate work; no remote trigger was executed while preparing this command.

No confidential simulation, deployment ID, TEE attestation or sponsor success has been recorded. The local build succeeds with CRE CLI 1.32.0 and SDK 1.19.1. Capture execution artifacts before representing the integration as live. See [sponsor compliance](../../docs/SPONSOR_COMPLIANCE.md).

Interfaces were checked against the [official published SDK source](https://github.com/smartcontractkit/cre-sdk-typescript), specifically its `sdk/workflow`, `sdk/runtime`, HTTP capability and `tee_runtime` example. Runtime guidance: [CRE TypeScript WASM runtime](https://docs.chain.link/cre/concepts/typescript-wasm-runtime).

Official setup references: [private registry](https://docs.chain.link/cre/guides/operations/deploying-to-private-registry-ts), [deploy access](https://docs.chain.link/cre/account/deploy-access), [confidential access](https://docs.chain.link/cre/account/confidential-workflows-access), [deployed secrets](https://docs.chain.link/cre/guides/workflow/secrets/using-secrets-deployed), and [HTTP trigger authorization](https://docs.chain.link/cre/guides/workflow/using-triggers/http-trigger/configuration-ts).
