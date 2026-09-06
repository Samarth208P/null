# Authenticated organization approvals

This small Node service hosts the real Privy organization adapter. It accepts only public distribution intent fields and request authorization signatures. Payroll, recipient profiles, spending/viewing keys and private proving witnesses have no HTTP input route here. Confidential compilation remains inside the separately configured CRE TEE workflow.

This Privy integration is optional. The free local approval path uses [the treasury CLI](../../tools/TREASURY.md) and needs no Privy account. To enable this service, fill its required values in the single private root `.env` using [the root template](../../.env.example), then run `pnpm organization` from the workspace root. The script uses Node's built-in environment-file support (Node 22.16 or later) to load root `.env`, with existing shell variables taking precedence.

The service binds `127.0.0.1:8788` on your computer. Both local frontend origins are included in the root example. Set public `VITE_ORGANIZATION_URL=http://127.0.0.1:8788` only when this integration is configured. Vite exposes only `VITE_` values; no app secret belongs under that prefix. Local startup does not configure a Privy account or its wallet controls: the service remains unavailable until the required integration values below are supplied. [Provider access and usage limits](../../docs/FREE_SEPOLIA.md) remain separate from local operation.

Configure exactly one business organization per service instance:

- Privy app ID and server app secret.
- Existing organization wallet ID and address, organization entity ID, owner quorum ID and required policy IDs.
- `PRIVY_ORGANIZATION_MINIMUM_APPROVALS` equal to the intended real owner-quorum threshold. A changed threshold fails closed.
- Comma-separated `PRIVY_ORGANIZATION_MEMBER_IDS` containing exact allowed Privy DIDs. This controls who can request approval; Privy owner-quorum membership separately controls who can sign it.
- The deployed Sepolia chain/pool context and explicit allowed frontend origins.

The official `@privy-io/node` 0.34.0 `utils().auth().verifyAccessToken` verifies ES256 signature, issuer, app audience and expiry through the app's verification key/JWKS. The service then checks the verified DID against its own membership configuration. It never accepts an organization ID or user ID from the request. SDK logging is disabled, and tokens, signatures and response witnesses are never logged.

Endpoints:

| Endpoint | Behavior |
| --- | --- |
| `GET /health` | Configuration state only; it does not claim a successful approval or live control check |
| `GET /api/organization/config` | Authenticated member-only wallet/control metadata after checking live Privy controls |
| `POST /api/organization/prepare` | Authenticated member sends `{publicInputs,expected:{chainId,poolAddress,commitment,envelopeRoot}}`; chain ID is a decimal string. The server verifies local intent binding and configured context, checks live Privy controls, and returns the exact request plus a short-lived approval ticket |
| `POST /api/organization/authorize` | Same verified member/session sends `{ticket,signatures}`. The ticket selects the stored exact inputs; the request cannot substitute a new intent, wallet or expiry. Privy enforces the actual quorum and policies, and the adapter verifies the resulting circuit signature |

Tickets contain only public inputs and context, expire with the prepared request (normally two minutes), and are consumed before signing. Refresh/reprepare after a failed or expired authorization. An in-memory ticket store is intentional for this single-process reference service; restarting discards pending approvals. It does not persist keys, signatures or payroll. HTTP payloads are limited to 32 KiB, pending intents to 500, and requests to 30/minute per direct socket and 20/minute per verified DID. Configure a trusted edge rate limiter behind a proxy; arbitrary X-Forwarded-For headers are not trusted.

Use the browser `authorizeOrganizationDistribution` helper exported by `@null-protocol/auth`. It obtains a fresh access token, checks that the prepared request contains exactly the locally computed intent digest, asks `useAuthorizationSignature().generateAuthorizationSignature` for approval, then submits the ticket/signature. Pass the expected signer derived from the private auth-policy public key. The helper verifies the returned signature/public key again locally. Return `result.compactSignature` from the protocol client's distribution `authorize(intent)` callback.

For a quorum greater than one, supply `collectAdditionalSignatures(request, count)` to collect signatures over the identical prepared request. The helper fails with `NULL_PRIVY_APPROVALS_REQUIRED` if those approvals cannot be collected; login or a single signature never masquerades as satisfying a larger quorum. Keep the returned compact signature/public key in private circuit witness memory and send only the resulting ZK proof to the relayer.

Compilation was performed; session authentication and wallet authorization were not executed against a live Privy account. Primary references: [Privy access tokens](https://docs.privy.io/authentication/user-authentication/access-tokens), [token verification](https://docs.privy.io/authentication/user-authentication/tokens), and the installed official server SDK declarations/source for `verifyAccessToken`.
