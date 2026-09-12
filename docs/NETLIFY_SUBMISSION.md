# Deploy the reviewed submission

## Environment impact of the payout SDK update

No new Netlify environment variables are required for the SDK/developer entry and ENS batch UI. Keep the existing v0.2 pool, manifest, Privy and organization settings. The relayer is a separate Node service; optional `RELAYER_MAX_GAS` belongs on that server, not in this site's organization function. Never add the relay signing key as a `VITE_` variable.

Production builds ignore a loopback `VITE_RELAYER_URL` and offer connected-wallet submission. Local development retains its local relayer. To offer hosted sponsorship, configure an accessible public relayer URL; deploying this site does not host that separate service.

`VITE_DEFAULT_ENVIRONMENT` and `VITE_DEPLOYMENT_BLOCK` are obsolete and no longer read. They can be removed from Netlify if present, but leaving them there does not block this release. Sepolia mode comes from code and the deployment block comes from the verified manifest. The historical values below document the older deployment.

Partial withdrawals still need a real v0.3 pool/verifier deployment with matching artifacts and configuration. Do not change production addresses just to enable a UI flag. Local environment files are not automatically synchronized to Netlify.

September 11 release `6aa3c2a2f2baaeb953c29c25` is deployed and verified. The required ENS frontend and updated organization function are live. See [release evidence](../deployments/submission-release-2026-09-11.json). This deployment does not establish a completed Privy-owner financial action or publish the working-tree source changes to GitHub.

## Git-based deployment

### Withdrawal release values

These production values were applied to the existing `null-protocol` site through the authenticated Netlify CLI API on 2026-09-08. Local `.env` changes do not automatically update Netlify.

```text
VITE_POOL_ADDRESS=0x734da58C285D211e7C0ad904f522c221c982447E
VITE_DEPLOYMENT_BLOCK=11659529
VITE_DEPLOYMENT_MANIFEST_URL=/deployment.json
VITE_GRAPH_URL=https://api.studio.thegraph.com/query/1758859/null-protocol/v0.2.0
NULL_POOL_ADDRESS=0x734da58C285D211e7C0ad904f522c221c982447E
NULL_CHAIN_ID=11155111
```

The site's current plan does not support separate variable scopes. Production values use its default scopes; only explicitly public values have the `VITE_` prefix. Privy credentials retain server-only names and are never included in browser source. Deployer keys, recovery keys and private payroll settings were not transferred. Include the new public `deployment.json` and all four circuit artifacts through the normal build. See [withdrawal verification](WITHDRAWAL_VERIFICATION.md).

Commit all reviewed source files, including the new `packages/ens` workspace package, app components, lockfile and public deployment manifests. Push to the existing Netlify site's configured production branch. The root `netlify.toml` builds `apps/web/dist` and bundles the organization Function. Keep private inputs, backups, credentials and `.artifacts` out of the commit.

The frontend production build passes locally. **A Git deployment does not copy your local environment into Netlify.** The required production server and public settings have now been copied and verified without logging their values. The earlier hosted organization API returned HTTP 503 because those server settings were missing; the release must return JSON 401 for an unauthenticated request after deployment. Real owner approval is a separate check.

## Optional CLI deployment

For this pnpm workspace, select the app explicitly to avoid an interactive monorepo prompt. After a successful local build, deploy both the assets and freshly bundled function with:

```powershell
pnpm build
$projectRoot = (Get-Location).Path
netlify deploy --prod --filter @null-protocol/web --no-build --dir "$projectRoot/apps/web/dist" --functions "$projectRoot/netlify/functions" --skip-functions-cache --json
```

Run this from the repository root. Use absolute paths: with `--filter`, the CLI may resolve a relative Functions path from `apps/web` and silently omit the function. A successful asset upload is not enough; verify `/api/organization/config` returns JSON `401` and the direct function health route returns JSON. Do not pass `--context` with `--no-build`; this CLI accepts it only when building.

The root `.npmrc` pins isolated dependency linking without a global virtual store. On Windows, stop local test servers before reinstalling packages that contain loaded native modules. Use the pinned lockfile; do not upgrade dependencies to repair a file lock. The September 11 managed-build attempt was canceled after its automatic install stalled; it was not published. See [current readiness](SUBMISSION_READINESS.md) for the verified replacement release.

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

The Netlify CLI is authenticated and linked to the existing site, which tracks `Samarth208P/null` on `main`. Function bundling passed locally. An authenticated owner approval still needs to exercise deployed storage and the actual Privy signature flow.
