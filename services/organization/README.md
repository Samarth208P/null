# Privy organization approval gateway

The organization service authenticates the configured Privy member, verifies the dedicated wallet and its controls, prepares an exact payment intent, and asks Privy to sign only after owner authorization. **The current live configuration is one owner with threshold one. A completed Privy-approved financial action remains pending.** It does not demonstrate multi-person governance.

The service receives public circuit inputs and signature requests, not payroll rows, ENS names, recipient keys, or private allocation amounts. ENS is resolved and rechecked in the browser. The signature binds the distribution commitment, envelope root, chain, pool, nonce and deadline. The browser uses the verified compact signature as a private circuit witness; the server does not generate the proof.

## Controls

- Verify access tokens and server-configured organization membership. Selecting Organization in the UI grants no authority.
- Verify wallet address, organization entity, expected owner quorum membership/threshold, policies where configured, and absence of bypass signers.
- Bind short-lived approval tickets to the authenticated user/session. Consume tickets atomically before signing.
- Use strong-consistency Netlify Blobs for shared pending tickets. Rate limits are per function instance, not a distributed abuse quota.
- Reject an unsigned wallet raw-sign request. This live rejection has been verified, but is not evidence of a completed signed payment.

The general authorization adapter supports additional approver signatures, but the shipped browser setup and configured wallet use one owner. No claim is made that multiple independent approvers exercised it.

## API

| Route | Method | Purpose |
| --- | --- | --- |
| `/health` | GET | Configuration probe; `approvalExecution: "not-tracked"` explicitly distinguishes health from historical payment evidence |
| `/api/organization/config` | GET | Authenticated wallet and quorum configuration |
| `/api/organization/prepare-identity` | POST | Prepare an identity-only signing challenge |
| `/api/organization/identify` | POST | Verify the owner-approved challenge and recover the public key |
| `/api/organization/prepare` | POST | Validate distribution or treasury-withdrawal public inputs and prepare a ticket |
| `/api/organization/authorize` | POST | Consume the ticket, submit authorization signatures to Privy, return a verified compact signature |

## Run and demonstrate

Run `pnpm organization` locally or deploy the [Netlify function](../../netlify/functions/organization.ts) together with the frontend. Follow [Netlify configuration](../../docs/NETLIFY_SUBMISSION.md); never put server credentials in browser variables.

The real owner must sign in, choose **Use Privy organization**, save the resulting local policy backup, register that policy, then complete a funded payment to a confirmed ENS recipient. Identity-only signing moves no funds and does not complete the financial demo. Preserve the actual transaction receipt before claiming success. See [current readiness](../../docs/SUBMISSION_READINESS.md) and [adapter implementation](../../packages/auth/src/server.ts).
