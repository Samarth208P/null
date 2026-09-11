# Chainlink CRE payroll compiler

NULL registers a real `handlerInTee` to fetch authenticated private payroll and compile eight padded encrypted delivery envelopes. **The execution evidence is local CRE CLI simulation. No remote enclave execution, deployment, or attestation is verified.** Local simulation does not protect payroll from the operator of the local machine.

The handler gets the payroll API token through the CRE secret capability, fetches the batch, validates it, and calls the shared deterministic compiler. Only public commitment roots, transport data, and ciphertext leave the handler. Recipient spending/viewing private keys are never an input; the payroll contains public payment profiles, amounts, private references, and secret batch entropy. In the application, those profiles come from confirmed ENS receiving names.

Source: [workflow](src/main.ts), [shared compiler](src/compiler.ts), and [simulation harness](../../cre-starter/scripts/simulate-payroll.ts). The confidential deployment target is distinct from the local compiler fallback. A WASM build alone is not execution evidence.

## Reproduce execution

```sh
pnpm cre:simulate
# Or export the private input from the payment wizard:
pnpm cre:simulate --input "PATH_TO_PRIVATE_INPUT.json"
```

Run from the repository root after authenticating with `cre login`. The wrapper selects the staging target and HTTP trigger non-interactively. It serves an authenticated loopback fixture, runs the actual CRE CLI, validates the returned public bundle against independent compilation, and writes a receipt. It sends no transaction. On authentication failure, finish browser login and rerun; do not treat a cached result as fresh execution.

Import `payment-result.json` into the same browser draft. When the CRE check is enabled, mismatched or stale output keeps review locked. File equality verifies integrity against the draft, not the origin of the file. This check is an explicit local simulation option in the application; there is no automatic remote CRE orchestration.

The [September 11 receipt](../../deployments/cre-simulation-2026-09-11.json) records successful synthetic execution, authenticated retrieval, and eight encrypted envelopes. Neither a simulation nor successful output import establishes payment broadcast or Privy approval.

## Private input

The payroll endpoint is a collection route; the handler appends `/<batchId>`. Use the browser export or [payroll parser](src/compiler.ts) for the exact schema:

- `batchId`: private batch reference.
- `batchEntropyHex`: fresh nonzero 32-byte secret entropy; never publish or reuse it.
- `recipients`: one to eight entries with `employeeRef`, atomic integer-string `amountAtomic`, and `stealthMetaAddress` in validated `st:eth:` public-profile format.

The standalone compiler accepts public profiles and does not itself resolve ENS. The browser resolves and revalidates ENS before supplying keys; the pool does not check names on chain. Do not publish private exports, bearer tokens, recovery files, or raw confidential logs. See [CRE project setup](../../cre-starter/README.md) and [readiness](../../docs/SUBMISSION_READINESS.md).
