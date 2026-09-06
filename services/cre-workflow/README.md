# Confidential distribution compiler

`src/main.ts` registers an actual CRE `handlerInTee` using the published `@chainlink/cre-sdk` 1.19.1 interfaces. The Nitro handler obtains its payroll API credential with `TeeRuntime.getSecret`, calls `HTTPClient.sendRequest` with that same TEE runtime, validates payroll, compiles eight encrypted slots, and returns only public ciphertext and roots. It never switches sensitive work to the DON runtime. It cannot spend treasury funds or create recipient spend/view keys.

The authenticated HTTP trigger accepts only `{batchId, expectedCommitment, expectedEnvelopeRoot}`. The caller first compiles locally and supplies those exact expected roots. The payroll API returns `{batchId, batchEntropyHex, recipients}` where each recipient has `{employeeRef, amountAtomic, stealthMetaAddress}`. Amounts are base-10 integer atomic units. `batchEntropyHex` is a unique secret 32-byte value for this exact batch, shared only with the authorized employer and the TEE. Persist it with encrypted employer recovery data; never reuse it for another batch or publish it in trigger input/config/logs. The payroll service must authorize and bind its batch ID to the exact immutable dataset and entropy. Random entropy is not generated with CRE's deterministic general-purpose random source.

AES-256-GCM uses the same wire format as the SDK. The TEE selects the pure JavaScript `@noble/ciphers` implementation because browser WebCrypto is absent from CRE WASM. The workflow source and dependency graph compiled to `build/compiler.wasm` using SDK 1.19.1 and Javy 8.1.0. Rebuild with `pnpm --filter @null-protocol/cre-workflow build` (Bun required). A successful WASM build does not establish successful enclave execution.

Copy `config.staging.example.json` to `config.staging.json`, replace the deployment address and endpoint, configure the authorized trigger signer, and bind the payroll secret in the CRE secret manager. Keep actual secrets and payroll outside source control. `workflow.yaml` selects `src/main.ts` and the staging config. Use the installed CRE CLI's `workflow simulate` and `workflow deploy` commands when authorized; this repository does not claim these were executed. The default example deliberately cannot run against a live pool.

The independent local path works without CRE:

```sh
pnpm --filter @null-protocol/cre-workflow compile:local --input private-payroll.json --context context.json --output public-bundle.json
```

`context.json` contains chainId and poolAddress. The output is marked `local-fallback` and `confidentialExecution: false`. The CLI refuses to overwrite an existing file. Do not deploy this CLI as a server accepting plaintext payroll. Existing recipients always discover and claim from chain history independently of this compiler.

No confidential simulation, deployment ID, TEE attestation or sponsor success has been recorded. Capture those artifacts before representing the integration as live. See [sponsor compliance](../../docs/SPONSOR_COMPLIANCE.md).

Interfaces were checked against the [official published SDK source](https://github.com/smartcontractkit/cre-sdk-typescript), specifically its `sdk/workflow`, `sdk/runtime`, HTTP capability and `tee_runtime` example. Runtime guidance: [CRE TypeScript WASM runtime](https://docs.chain.link/cre/concepts/typescript-wasm-runtime).
