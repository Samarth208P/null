# ENSv2 payment names

Verified on Ethereum Sepolia on September 8, 2026. This is a real ENSv2 integration with confirmed registration and permission transactions. Resolution does not use a mock service, a static name-to-profile map, or an ordinary wallet-address substitute.

## What users do

In **Individual → Inbox → Set up payment name**, enter a Sepolia ENS name, check it, save the NULL recovery backup, and choose **Link my Payment ID**. The connected Privy wallet signs the record update. NULL waits for confirmation and reads the record back before offering to copy the name. If several wallets are connected, choose the one that owns the name or holds the record permission.

The existing Privy recipient wallet `0x7fD5B5B80E9F7a811b1d27Ec20879185fB987433` now owns **inbox.nullpay2026.eth**. It has permission to set this name's `null.paymentProfile` text record and received 0.0005 Sepolia ETH for gas. **Its Payment ID has not been published.** The signed-in recipient must restore/save their own recovery backup and consent to publication in the app. No recipient private key is sent to a resolver or service.

In **Organization → New payment**, use the **ENS name or Payment ID** field. Check and confirm the name, then prepare the payment. CSV imports accept the same destinations using `name,amount,paymentDestination`; the previous `privacyProfile` heading remains compatible. The live CSV template contains headings only, with no invented recipients.

## Why ENSv2 matters here

- Hierarchical registry: `nullpay2026.eth` points to a real UserRegistry, which registers recipient subnames as ENSv2 tokens.
- Permissioned Resolver: a recipient's Privy wallet can edit exactly one key on one name. The app uses `authorizeTextRoles`, not a broad text/admin grant. The administrator can revoke that grant.
- Universal Resolver: names and aliases resolve through viem's canonical Sepolia proxy, with CCIP-Read support. The application does not pin a Universal Resolver implementation address.
- Destination safety: the normalized name, canonical public profile, profile hash, resolver, owner and observation block form a checked snapshot. Ownership changes, resolver changes and key rotation require review; they never silently rewrite an encrypted batch.
- Record aliases: `pay.nullpay2026.eth` resolves to the same profile as `receive.nullpay2026.eth`. The app resolves aliases through the Universal Resolver and rejects direct edits to alias nodes.

`null.paymentProfile` is a NULL-specific ENSIP-5 text key, not an ENS-standard record name. It holds two public keys in the existing `st:eth:` format. It never holds amounts, an employee roster, encrypted recovery material, or private spending/viewing keys. Publishing a name links it publicly to this profile; names do not provide recovery or anonymity for the name/profile association.

## Implementation boundaries

| Area | Source |
| --- | --- |
| Normalization, hierarchy/expiry checks, resolution snapshots, scoped write preflight | `packages/ens/src/index.ts` |
| ENS entry and changed-destination review | `apps/web/src/components/PaymentDestination.tsx` |
| Privy wallet signing, publication consent, delegation and revocation | `apps/web/src/components/PaymentNameManager.tsx` |
| Pending transaction recovery and receipt binding | `apps/web/src/lib/ens-pending.ts` |
| Checked destination → encrypted batch → CRE gate | `apps/web/src/pages/DistributionWizard.tsx` |
| Rechecks before preparing, Privy approval and submission | `apps/web/src/components/LiveOperation.tsx` |
| Actual Sepolia transaction evidence | `deployments/ens-sepolia.json` |
| Reproducible namespace/permission verification | `tools/ens-sepolia.mts` |
| Assign a subname without publishing a recipient profile | `tools/ens-assign-name.mts` |

Read requests use a single observed block for the record, resolver and hierarchy. An expired registered child is rejected even if its parent's wildcard resolver still contains an old record. A transfer changes the pinned owner. Token IDs are not cached. User input follows ENSIP-15 normalization and is not limited to `.eth` syntax; the current integration targets the Sepolia ENSv2 hierarchy.

Writes discover the name's resolver again, verify its official PermissionedResolver implementation through the VerifiableFactory, and simulate the exact call from the selected wallet before requesting a signature. Unsupported resolver versions fail closed. The supported beta revision is `97a57293f3b4279d94b571e678edb53ce62638f4`; review the deployment metadata when ENS upgrades the beta.

When a transaction hash is returned, its public request and hash survive a reload in session storage. Receipt reconciliation checks sender, destination and calldata. An uncertain update is not automatically submitted again. If the browser is closed before the wallet returns a hash, inspect the wallet's activity before repeating the action.

Payment-name snapshots and recipient drafts live in the authenticated workspace's memory. Restore the NULL backup to regain the same Payment ID on another device. Names, including the test namespace, require renewal. The verification registry was deployed for the one-year test namespace and is not a public registration service or a production registry configuration.

## Verification

```sh
pnpm ens:status           # Live reads and eth_call preflight; no keys needed, no transactions
pnpm test:submission      # Includes ENS safety and pending-receipt tests
pnpm check
pnpm build
```

The September 8 run confirmed registration, scoped publishing, actual record rotation, restoration, alias creation and revocation. Contract simulation explicitly rejected the editor's attempts to change another text key, another name, the wallet-address record and permission grants; after revocation, its payment-record update was rejected too. The final test editor has no record access.

The resolved live profile was passed to the real NULL compiler. The matching recipient keys discovered the correct 0.1 test-USDC allocation locally. **That cryptographic check did not send an onchain payment.**

Browser verification used the real components with a test-only authenticated session provider. ENS RPC requests were live. A browser-created ENS payment was exported, run through the actual CRE CLI, and imported back into the same draft. A stale batch result was rejected; the exact result unlocked review and preserved the ENS recipient. This proves local CRE simulation and output matching, not remote TEE deployment or a Privy-approved financial transfer.

The deployed names and records can be checked without credentials using `pnpm ens:status` or by searching the names in the [official ENS Sepolia explorer](https://explorer.ens.dev):

- Primary payment profile: `receive.nullpay2026.eth`
- Payment alias: `pay.nullpay2026.eth`
- Privy recipient subname: `inbox.nullpay2026.eth`
- [Permissioned Resolver on Sepolia](https://sepolia.etherscan.io/address/0x674be7717ed119C26c7f81dC1BE424fFb5AEf8b5)
- [Subname registry on Sepolia](https://sepolia.etherscan.io/address/0x3f59C62b03673a321A0bA12857afA46617aE9040)

`receive.nullpay2026.eth` and its alias are verification profiles. Do not use them as substitutes for a user's own recipient profile or send them real value.

## Setup tooling

`pnpm ens:plan` previews the setup. `pnpm ens:verify` runs the Sepolia-only setup using the existing protected deployer configuration; it has a 0.015 test-ETH gas budget and funds an isolated editor with 0.0005 test ETH. A completed run performs only a fresh read on rerun. The official ENS Sepolia registrar charges its freely mintable MockUSDC test token; it is separate from NULL's test-USDC asset. All ENS operations use actual contracts and receipts.

To assign another neutral recipient subname, preview first:

```sh
node --import tsx tools/ens-assign-name.mts --wallet RECIPIENT_ADDRESS --label NEUTRAL_LABEL
```

Append `--broadcast` only when intending to create that public name and scoped permission. This does not publish the recipient's Payment ID. The tool caps gas at 0.003 test ETH and supplies 0.0005 test ETH if the recipient needs name-update gas. Both setup tools save transaction hashes before broadcast; reconcile any incomplete journal before retrying. They do not transfer payroll funds or bypass Privy approval.

Official references: [app integration](https://docs.ens.domains/ensv2/tutorial-app-developers/), [Permissioned Resolver](https://docs.ens.domains/ensv2/permissioned-resolver/), [hierarchical registry setup](https://docs.ens.domains/ensv2/tutorial-contract-developers/), [Sepolia deployments](https://docs.ens.domains/learn/deployments/), and [ETHOnline ENS requirements](https://ethglobal.com/events/ethonline2026/prizes/ens).
