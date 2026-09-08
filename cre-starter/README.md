# NULL confidential payroll: local CRE simulation

This TypeScript workflow receives a public batch reference and expected roots through an HTTP trigger, fetches synthetic payroll through an authenticated loopback API inside a `handlerInTee` callback, and returns eight encrypted NULL envelopes. The actual CRE CLI simulation passed on 2026-09-06, including equality with an independent local compilation of the complete public bundle.

This is a local simulation: it does not establish remote enclave execution or attestation. No workflow or secret was uploaded, deployed, or activated, and no chain transaction was sent.

## Run it again

From the NULL repository root, `C:\PC\Codes\null`:

```powershell
node --import tsx cre-starter/scripts/simulate-payroll.ts
```

The helper starts its authenticated fixture API on `127.0.0.1:8791`, invokes the actual CLI, validates its output, and closes the API on success or failure. It stops if that port is occupied. CRE runs from `cre-starter` with these arguments:

```text
cre workflow simulate payroll --target staging-settings --non-interactive --trigger-index 0 --http-payload <absolute-public-trigger-path> --env <absolute-repository-root-.env-path>
```

Use the helper for a complete run: it supplies the temporary API and authentication. Adding `--prepare` to the helper only computes public fixtures; it does not simulate CRE.

Actual successful output included:

```text
[USER LOG] NULL payroll simulation: validated batch and compiled 8 encrypted envelopes.
```

The verified receipt records `verified: true`, `encryptedEnvelopes: 8`, and `authenticatedFixtureFetches: 1`. The helper checks the returned bundle with `parsePublicBundle`, compares the complete bundle against the independent local result, and requires the completion log and an authenticated API fetch. A mismatch fails the command.

## Toolchain and provenance

The project was generated with non-interactive `cre init` using Chainlink's official [`hello-confidential-workflows-ts` template](https://github.com/smartcontractkit/cre-templates/tree/main/starter-templates/hello-confidential-workflows). The project-local [CRE skill](../.agents/skills/chainlink-cre-skill/SKILL.md) and official template supplied the CLI, configuration, and confidential-workflow patterns.

Verified versions: CRE CLI **1.32.0**, Bun **1.3.13**, and the template's pinned `@chainlink/cre-sdk` **1.18.0**. The installed skill requires **Bun 1.2.21 or newer** for TypeScript. Existing NULL monorepo dependencies are also required: this starter directly imports the pure compiler in `services/cre-workflow/src/compiler.ts` and its workspace packages.

To restore dependencies in this checkout:

```powershell
# From the repository root:
pnpm install --frozen-lockfile
cd cre-starter/payroll
bun install
bun x cre-setup
cd ../..
```

`bun x cre-setup` is the Bun command equivalent of `bunx cre-setup`; the `bunx` executable was absent on this Windows installation. WASM tooling setup completed using `bun x`.

`payroll/main.ts` installs a pure JavaScript base64 decoder from pinned `@scure/base` **1.2.6** before dynamically importing the workflow. The generated browser bundle left `atob` undefined in Javy/QuickJS, while `poseidon-lite` needs it to initialize constants. This fixed the actual simulation failure without changing the NULL compiler.

## Configuration and data boundaries

- `payroll/workflow.ts` accepts only `batchId`, `expectedCommitment`, and `expectedEnvelopeRoot`. Configuration requires `simulationOnly: true` and the loopback payroll URL. The handler keeps the bearer, HTTP response, and compilation on `TeeRuntime`; it makes no DON crossover, report, or chain-write call. Its fixed log is for simulation only.
- The helper reads the current public `../apps/web/public/deployment.json` and checks that the staging workflow configuration uses the same chain and pool. These bind the encrypted output; the workflow does not read or write the chain. The withdrawal release uses Sepolia pool `0x734da58C285D211e7C0ad904f522c221c982447E`.
- Two fictional recipients use explicitly public demo scalars and deterministic demo entropy. These public demo values provide no wallet security. Never fund their derived addresses or reuse them for real payroll. The raw batch stays in memory; the API serves only that immutable batch.
- There is one `.env`, at the repository root. Only CRE consumes it opaquely; the helper does not read or change it. A fresh random bearer is passed through the child environment as `NULL_CRE_SIMULATION_TOKEN`, mapped by `secrets.yaml` to `PAYROLL_API_TOKEN`. It is never written to files, command arguments, or logs.
- CLI output is captured before saving or displaying it. Output containing the bearer or raw payroll field names is withheld. The receipt explicitly records `remoteExecutionVerified: false` and `attestationVerified: false`.

Ignored public artifacts under `cre-starter/.artifacts/`:

| File | Purpose |
| --- | --- |
| `http-payload.json` | Public batch reference and expected roots |
| `expected-public-result.json` | Independently compiled expected ciphertext bundle |
| `simulation.log` | Actual CLI output after the log-content check |
| `simulation-receipt.json` | Verified local result, roots, and authenticated fetch count |

Fixture files are immutable: a rerun reuses identical content and refuses to replace different content. Each full run replaces the receipt with `verified: false` and `status: running` before preparing its inputs, then records `passed` or `failed` with timestamps. A failed attempt cannot retain an earlier successful receipt. `--prepare` leaves the receipt unchanged; the log contains the latest captured CLI output that passed the log-content check.

## Continuing toward a live integration

Future work is an authenticated HTTPS immutable-batch API, an authorized HTTP-trigger address, and a verified completed-result connection into the local NULL app. This starter accepts only the synthetic fixture. Remove the simulation log and review the confidentiality boundary before production use: confidential execution protects the data computed over; the workflow binary itself remains visible to the DON.

Standard CRE Early Access remains disabled. `cre account access --help` confirmed the command has no command-specific flags; `cre account access` checked access and offered a new request. That new prompt was declined because the earlier standard request is already submitted, preserving the existing request. Approval has not been granted.

Confidential Workflows additionally require the separate [Confidential Workflows access request](https://docs.chain.link/cre/account/confidential-workflows-access). Request confirmation of a free allowance before selecting hosted execution or infrastructure. Local simulation requires neither deployment approval nor paid services. Deployment, activation, secret upload, and the live app connection remain future authorized work.

Official references: [confidential workflow pattern](https://docs.chain.link/cre/guides/workflow/using-confidential-workflows/making-workflow-confidential-ts), [TypeScript WASM runtime](https://docs.chain.link/cre/concepts/typescript-wasm-runtime), [standard deployment access](https://docs.chain.link/cre/account/deploy-access).
