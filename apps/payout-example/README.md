# Embed NULL in your app

The adapter includes larger ENS payout jobs, recipient claims, multi-note withdrawal jobs, wallet/sponsored submission, encrypted recovery and reconciliation. A sponsor callback connects your own authenticated gas-paying backend. It is not a NULL-hosted service. Partial withdrawals require v0.3, verified locally but not deployed on the reference Sepolia pool. See the [integration guide](../../docs/SDK_INTEGRATION.md).

Two examples use the same payout API as the reference web app:

- [`src/prepare.ts`](src/prepare.ts) runs read-only ENS resolution and genuine local encryption from the command line. It never signs, proves, funds, or sends a payment.
- [`src/integration.ts`](src/integration.ts) exports `createEmbeddedPayouts`, a typechecked host adapter for your web app. It accepts your deployment configuration and encrypted persistence callback, then exposes payout, recipient, and treasury operations without importing React, Privy UI, or the reference app's state.

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm example:payouts
pnpm example:payouts your-recipient.eth 0.01
```

The default `receive.nullpay2026.eth` is a live Sepolia verification profile, not a recipient account to fund. If that name expires or its resolver changes, the example should fail; supply a current compatible name. Public RPC availability is required. No `.env` file or service credentials are needed for this read-only example.

For a browser integration, create your application under `apps/`, add `@null-protocol/payouts` and the required lower-level packages as `workspace:*` dependencies, and use a bundler that supports TypeScript and ESM. Retain the matching circuit files and manifest when moving to a separate repository. These are unpublished source packages, so copying this example alone into another repository is insufficient.

The factory deliberately requires the host to implement payer review, authorization, encrypted key/checkpoint storage, and progress/error UI. It does not silently create a custodial backend or send recovery secrets to a service. Use [`docs/SDK_INTEGRATION.md`](../../docs/SDK_INTEGRATION.md) for the full contract.
