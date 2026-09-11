# @null-protocol/auth

Browser and server adapters bind Privy organization approval to NULL's exact distribution or treasury-withdrawal intent. **The current configured wallet uses one owner, threshold one.** Multi-approver collection is an adapter extension point; it is not a demonstrated multi-person production workflow.

- Sign the circuit's Poseidon digest with raw secp256k1 signing; do not use `personal_sign` or add Ethereum message prefixes.
- Validate chain, pool, commitments, envelope root and deadline before requesting approval. Treasury withdrawal also binds the public recipient and amount.
- Recover and independently verify the returned signer and compact signature locally. The compact signature is a private circuit witness and must not be logged or added to relay payloads.
- The organization HTTP service authenticates membership and supplies expiring single-use tickets. The adapter alone is not an authentication boundary.

## Browser integration

Use `authorizeOrganizationDistribution` from [src/index.ts](src/index.ts). It requires an absolute service-origin `endpoint`, `appId`, `expectedSigner`, `publicInputs`, the exact `expected` context, `getAccessToken`, and `generateAuthorizationSignature`. The endpoint is the origin, not `/api/organization`; the adapter appends the API path. Supply `collectAdditionalSignatures` only for an intentionally configured larger quorum. The live application checks every required ENS name before calling this adapter.

The complete browser call is in [LiveOperation.tsx](../../apps/web/src/components/LiveOperation.tsx). `identifyOrganizationSigner` obtains the public key through an owner-approved identity challenge; it is not a payment.

## Server integration

Use `createPrivyOrganizationAuthorizer` from [src/server.ts](src/server.ts). Its typed configuration requires wallet, organization entity, quorum, expected owners, policy/control mode, threshold, chain and pool in addition to app credentials. The [organization service](../../services/organization/src/server.ts) is the complete host example, including verified sessions and ticket storage. Do not call the server adapter from the browser or expose the app secret.

`prepare(publicInputs, expected)` creates a canonical request; `authorize({ publicInputs, expected, requestExpiryMs, signatures })` verifies controls and returns the checked signature. Tickets belong to the HTTP service, not to the raw adapter API.

Live unsigned-request rejection has been verified. A real owner-approved financial action remains outstanding; see [submission readiness](../../docs/SUBMISSION_READINESS.md).
