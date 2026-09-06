# Privy organization authorization

The browser-safe entry point builds a request to sign the circuit's exact Poseidon intent digest. It does not use personal_sign or add an Ethereum message prefix. Input order comes from the SDK and the immutable circuit: the envelope root, output, treasury nullifiers, nonce, deadline, chain and pool are all bound.

The server entry point (`@null-protocol/auth/server`) uses the documented Privy REST wallet RPC with owner authorization signatures. Configure an existing Ethereum treasury wallet with an organization entity, owner key quorum, no additional bypass signers and explicit policies. Pass the wallet ID/address, owner quorum ID, organization entity ID and required policy IDs to `createPrivyOrganizationAuthorizer`. It reads current wallet controls before every prepare/sign operation and fails closed on drift. Privy verifies the actual distinct quorum keys; counting supplied signatures locally is only a preliminary rejection check.

An application backend must authenticate company membership before invoking the adapter, keep its app secret out of Vite environment variables, and never log requests or returned signature witnesses. The adapter is a library, not an unauthenticated signing endpoint. The supplied [organization service](../../services/organization/README.md) hosts it behind verified Privy access tokens, a server-controlled member allowlist and session-bound intent tickets.

1. Locally compile and preflight the distribution, then assemble the 15 circuit public inputs.
2. Call `prepare(publicInputs, expectedCompiledContext)` on the authenticated organization backend.
3. Show the exact distribution to each approver. Use Privy React `useAuthorizationSignature().generateAuthorizationSignature(request)` on the returned structured request. Collect the required quorum signatures over that same request and expiry.
4. Call `authorize` with those signatures and the identical inputs/context/expiry. Privy enforces owner and policy controls; the adapter verifies the recovered signer against the configured wallet.
5. Keep `compactSignature` and `publicKey` in the private distribution witness. Send only the resulting ZK proof and public inputs to the relayer.

Account login alone is not a treasury authorization. No live wallet approval or sponsor qualification is asserted by this source implementation.

`authorizeOrganizationDistribution` is the browser helper for that service. Supply the API endpoint, app ID, expected signer, exact public inputs/compiled context, Privy `getAccessToken` callback and `generateAuthorizationSignature` callback. It checks the prepared digest locally before user authorization and verifies the final compact signature/public key. Quorums greater than one require an explicit `collectAdditionalSignatures` callback over the identical request.

Sources: [Privy raw secp256k1 signing](https://docs.privy.io/api-reference/wallets/ethereum/secp256k1-sign), [authorization request construction](https://docs.privy.io/controls/authorization-keys/using-owners/sign/utility-functions), [wallet control metadata](https://docs.privy.io/api-reference/wallets/get).
