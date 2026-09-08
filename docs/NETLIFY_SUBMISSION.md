# Deploy the reviewed submission without a commit

The root `netlify.toml` builds the web app and the organization function. Local CLI deployment includes the current working tree; no Git commit is required. Do not deploy a drag-and-drop frontend folder alone: that omits the approval API.

1. Run `netlify login` yourself, then link the existing **null-protocol** site. Select the existing site rather than creating a duplicate.
2. In that site's Netlify environment settings, configure the server variables below for the Functions scope. Copy them privately from your own configuration. Do not paste values in chat, place them in a public file, or prefix them with `VITE_`.
3. Set `ORGANIZATION_ALLOWED_ORIGINS=https://null-protocol.netlify.app`. A preview deployment also needs its own explicitly allowed origin if you want to test authenticated approvals there.
4. Preserve the existing public `VITE_PRIVY_APP_ID`, `VITE_POOL_ADDRESS`, deployment block, RPC and Graph URLs in the Builds scope. Production defaults to its own origin for the organization API when the saved URL is blank or loopback.
5. Run `pnpm check`, `pnpm test:submission`, and `pnpm build`, then deploy with the Netlify CLI from the repository root using the existing site's configuration. Include Functions. Verify the new deployment before recording the demo.

Required server variables:

```text
PRIVY_APP_ID
PRIVY_APP_SECRET
PRIVY_ORGANIZATION_MEMBER_IDS
PRIVY_ORGANIZATION_WALLET_ID
PRIVY_ORGANIZATION_WALLET_ADDRESS
PRIVY_ORGANIZATION_OWNER_QUORUM_ID
PRIVY_ORGANIZATION_ENTITY_ID
PRIVY_ORGANIZATION_CONTROL_MODE=owner-quorum
PRIVY_ORGANIZATION_MINIMUM_APPROVALS=1
NULL_CHAIN_ID=11155111
NULL_POOL_ADDRESS
ORGANIZATION_ALLOWED_ORIGINS=https://null-protocol.netlify.app
```

The dedicated owner-quorum wallet intentionally has no policy IDs and no bypass signers. The default `policies-and-quorum` configuration still requires its policy IDs. Never silently replace an existing controlled wallet with a permissive configuration.

The function uses [Netlify Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/) with strong consistency and conditional writes. Pending approvals survive separate function instances. Each ticket is bound to the verified Privy user/session, expires quickly, and is consumed before signing. Stored intents contain public inputs and session identifiers; signatures, payroll and wallet secrets are not persisted there. Expired tickets and consumed tombstones should be purged periodically for longer-running installations. Rate limiting is currently per function instance, not a distributed abuse quota.

Verify after deployment:

- Unauthenticated `/api/organization/config` returns JSON 401 when configured, not the SPA's HTML and not a 503 configuration error.
- Sign in as the actual configured organization owner. Open the organization setup in Funds and select **Use Privy organization**. This requests an identity-only signature to obtain the public key; it moves no funds.
- Back up the local policy opening before registering it. Registration is a separate Sepolia transaction. The prior local signer policy does not authorize the new Privy wallet.
- Complete a real owner-approved payment and save its transaction hashes. Neither the unsigned-request rejection test nor successful function bundling counts as a completed Privy workflow.

The Netlify CLI was not logged in during preparation. Function bundling passed locally; deployed storage and owner approval remain unverified until these steps run.
