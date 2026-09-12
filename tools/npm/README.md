# NULL payouts — developer preview

Embed ENS-based private payouts in your application. Bring your UI, wallet connection, organization authorizer, and encrypted local recovery. NULL provides recipient resolution, encrypted payout preparation, proof orchestration, discovery, and transaction reconciliation.

This is an **unaudited testnet preview**. The public deployment recorded in the repository is Sepolia v0.2. Partial withdrawals require the separately deployed v0.3 pool; v0.3 currently has local real-proof verification only. Installing this package does not deploy or upgrade a pool.

## Install

Install the public developer preview:

```sh
npm install @samarth208p/null-payouts@preview
```

For source development, `pnpm pack:npm` builds a local tarball that can also be installed with `npm install /absolute/path/to/samarth208p-null-payouts-0.1.0-preview.2.tgz`.

Requires Node.js 22.16+ for Node use. Ships ESM JavaScript and TypeScript declarations. Preparation can run in Node; local recovery, browser workers, and the default proof client require a browser application and bundler. CommonJS `require` is not supported.

## Prepare a payout

```ts
import { resolvePayoutRecipients, preparePayout } from '@samarth208p/null-payouts';

// ens: a configured viem Sepolia public client.
// context: { chainId: 11155111n, poolAddress: yourVerifiedPoolAddress }.
const recipients = await resolvePayoutRecipients(ens, [
  { reference: 'invoice-42', name: 'alice.eth', amount: '25' },
]);
// Display names, destination fingerprints and amounts; obtain payer confirmation.
const draft = await preparePayout({ ens, context, recipients });
const encrypted = draft.publicBundle;
```

This is a host-integration fragment, not a payment. The illustrative ENS name must resolve to a supported Sepolia ENSv2 NULL payment profile. Amounts use six token decimals. Approval, treasury funding, proof generation, backup, consent and submission are separate steps. Do not serialize private drafts or send them to analytics or a server.

## Imports

| Entry point | Provides |
| --- | --- |
| `@samarth208p/null-payouts` | Resolve recipients and prepare encrypted drafts |
| `@samarth208p/null-payouts/client` | `PayoutClient`, `NullLiveClient`, checkpoint storage and integration types |
| `@samarth208p/null-payouts/jobs` | Sequential payout batches of up to eight recipients |
| `@samarth208p/null-payouts/withdrawals` | Multi-note withdrawal planning and orchestration |
| `@samarth208p/null-payouts/cre` | Exact local CRE result validation |
| `@samarth208p/null-payouts/sdk` | Low-level cryptography, profile generation, protocol and witness helpers |
| `@samarth208p/null-payouts/ens` | ENS profile resolution and record management |
| `@samarth208p/null-payouts/wallet` | Local encrypted identity backup and recovery |
| `@samarth208p/null-payouts/prover` | Browser proof worker and proof types |
| `@samarth208p/null-payouts/prover/runtime` | Proving runtime for a host-managed worker |

All NULL internals are included. No other unpublished `@null-protocol/*` packages are needed. The integration guide's original workspace imports such as `@null-protocol/sdk` become `@samarth208p/null-payouts/sdk` in an installed consumer. The Privy server adapter remains a separate source integration.

## Browser setup

The default proof worker ships as JavaScript beside its runtime. Use a bundler that handles `new Worker(new URL(..., import.meta.url))`. For Vite:

```ts
import { defineConfig } from 'vite';
export default defineConfig({
  worker: { format: 'es' },
  build: { target: 'es2022' },
});
```

Provide a reviewed deployment manifest, matching circuit artifacts and verification-key hashes, RPC/indexer URLs, encrypted checkpoint persistence, authorization, and wallet or sponsor transport. Circuit artifacts are hosted separately and verified by hash; they are not embedded in this npm package. Noir and Barretenberg retain the protocol's pinned versions.

Gas sponsorship requires your own endpoint and gas funds. A sponsor does not authorize or fund the payout. Unknown submissions require reconciliation before retrying. Jobs are in-memory; recovery after reload requires encrypted checkpoints and chain history.

Public ENS profiles, deposits, withdrawal amounts/addresses and timing remain visible. The protocol keeps the recipient allocation and claim source out of plaintext public inputs; it does not guarantee that observers cannot infer who paid a recipient or the original payout amount. In v0.2, withdrawing a whole recipient note exposes its full amount. v0.3 partial withdrawals keep the original note amount private in that proof, but timing, amounts, reused wallets and small pool activity can still link payments. CRE support here verifies local simulation output, not remote attestation. No audited privacy guarantee or production readiness is claimed.

See [INTEGRATION.md](./INTEGRATION.md) and the [source repository](https://github.com/Samarth208P/null).

## Release status

MIT licensed; see [LICENSE](./LICENSE). Third-party dependencies retain their own licenses. No publishing lifecycle script runs during installation.
