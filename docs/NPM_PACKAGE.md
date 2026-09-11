# Installable npm preview

NULL can be distributed as one `@samarth208p/null-payouts` package. The build compiles the payout SDK and its internal NULL dependencies together, rewrites their imports to package-local ESM paths, emits TypeScript declarations, and includes the browser proof worker. Third-party dependencies retain their pinned versions. Existing workspace packages continue to use source exports for development.

Published September 11, 2026: [`@samarth208p/null-payouts@0.1.0-preview.1`](https://www.npmjs.com/package/@samarth208p/null-payouts/v/0.1.0-preview.1), MIT licensed, public access, `preview` tag.

```sh
npm install @samarth208p/null-payouts@preview
```

## Build and install

```sh
pnpm pack:npm
```

This creates `dist/npm/samarth208p-null-payouts-0.1.0-preview.1.tgz`. From another project:

```sh
npm install /absolute/path/to/null/dist/npm/samarth208p-null-payouts-0.1.0-preview.1.tgz
```

Use ordinary JavaScript or TypeScript imports:

```ts
import { preparePayout, resolvePayoutRecipients } from '@samarth208p/null-payouts';
import { PayoutClient, NullLiveClient } from '@samarth208p/null-payouts/client';
import { PayoutJob } from '@samarth208p/null-payouts/jobs';
import { WithdrawalJob } from '@samarth208p/null-payouts/withdrawals';
import { createPrivacyProfile } from '@samarth208p/null-payouts/sdk';
import { encryptRecovery } from '@samarth208p/null-payouts/wallet';
```

The package also exports `/ens`, `/cre`, `/prover`, and `/prover/runtime`. These import paths work in the published package. Workspace examples importing `@null-protocol/sdk`, `@null-protocol/ens`, or `@null-protocol/wallet` should use these package subpaths in a standalone consumer. `@null-protocol/client` integration types are available through `/client`; the Privy server adapter remains a separate source integration.

For browser setup, use the [interactive docs](https://null-protocol.netlify.app/#/developers/quickstart). For AI-assisted integration, download the [NULL skill](../skills/null-payouts/SKILL.md) from the repository or the [AI guide](https://null-protocol.netlify.app/#/developers/ai). The skill is distributed separately from the `0.1.0-preview.1` tarball.

Node.js 22.16+ is supported for preparation. The default live proof client requires a browser bundler. With Vite, use `worker: { format: 'es' }` and `build: { target: 'es2022' }`. CommonJS is not a supported entry point.

The tarball contains compiled modules, declarations, package metadata and guides. It does not include deployment credentials, recovery files, the reference app, contracts to deploy, or the large circuit artifacts. Hosts still configure verified artifacts, the deployment manifest, RPC/indexer, authorization, funding, encrypted recovery and transport. Installing the package does not enable v0.3 on the existing v0.2 pool.

## Verify an independent consumer

```sh
pnpm test:npm
```

The test builds and packs the package, checks its file allowlist, and installs it in a fresh operating-system temporary directory outside the workspace. It tests Node ESM imports, genuine encrypted preparation with fixture ENS reads, encrypted identity recovery, batch partitioning, and proof-worker URL resolution. It then typechecks a consumer with NodeNext module resolution and builds it with Vite, checking emitted worker and WASM assets. The temporary consumer is retained for inspection. Installation requires access to npm for pinned dependencies.

Use `node tools/test-npm.mjs --registry` after building the exact released version to test installation from npm. This mode also checks that npm's integrity hash matches the local packed artifact.

This is package integration verification. It does not execute the browser proving runtime, a real proof, a live ENS lookup, a wallet approval, or a payment. Run the existing protocol and real-proof checks separately when changing those implementations.

## Publish after release decisions

No registry publication is performed by build, pack or test. The release name is `@samarth208p/null-payouts`, under the owner's npm account. The source workspace keeps its internal `@null-protocol/*` names; consumers use the public package's subpaths.

The owner selected MIT for this release. The root license is included in the tarball; third-party dependencies retain their own terms. Publish from the `samarth208p` npm account. Update the preview version for each release and keep the unaudited/testnet status explicit.

After those decisions, rebuild and test the exact release, authenticate with the owning npm account, and publish the reviewed tarball:

```sh
npm publish ./dist/npm/samarth208p-null-payouts-0.1.0-preview.1.tgz --access public --tag preview
```

The intended consumer command after successful publication is:

```sh
npm install @samarth208p/null-payouts@preview
```

See [npm's scoped public package guide](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/) for current account and registry requirements. `tools/npm/payouts.package.json` holds release metadata; `tools/npm/README.md` is the packaged readme. The build uses an explicit module list and derives external dependencies from emitted module imports, failing on missing or inconsistent dependency versions.
